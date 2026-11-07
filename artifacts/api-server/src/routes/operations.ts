import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateCampaignBody,
  CreateCampaignResponse,
  CreateInventoryItemBody,
  CreateInventoryItemResponse,
  CreateTransactionBody,
  CreateTransactionResponse,
  DeleteInventoryItemParams,
  GetFinanceSummaryQueryParams,
  GetFinanceSummaryResponse,
  ListCampaignsResponse,
  ListInventoryResponse,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  UpdateInventoryItemResponse,
} from "@workspace/api-zod";
import {
  campaignsTable,
  db,
  inventoryItemsTable,
  transactionsTable,
} from "@workspace/db";
import { requireSalonRoles } from "../middlewares/auth";
import {
  toCampaign,
  toDateString,
  toInventoryItem,
  toTransaction,
} from "./shared";

const router: IRouter = Router();

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function nextMonthStart(value: string): string {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
}

router.get("/finance", async (req, res): Promise<void> => {
  const params = GetFinanceSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const selectedMonth =
    params.data.month ?? new Date().toISOString().slice(0, 7);
  const month = `${selectedMonth}-01`;
  const from = monthStart(month);
  const end = nextMonthStart(month);
  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.salonId, req.salonId!),
        gte(transactionsTable.date, from),
        lt(transactionsTable.date, end),
      ),
    )
    .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt));

  const income = transactions
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = transactions
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const [year, monthNumber] = selectedMonth.split("-").map(Number);
  const trendStart = new Date(Date.UTC(year, monthNumber - 6, 1))
    .toISOString()
    .slice(0, 10);
  const trendRows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.salonId, req.salonId!),
        gte(transactionsTable.date, trendStart),
        lt(transactionsTable.date, end),
      ),
    );
  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 6 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return {
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date),
      revenue: trendRows
        .filter(
          (item) =>
            item.kind === "income" && item.date.startsWith(key),
        )
        .reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });

  res.json(
    GetFinanceSummaryResponse.parse({
      month: selectedMonth,
      income,
      expenses,
      net: income - expenses,
      transactions: transactions.map(toTransaction),
      monthlyTrend,
    }),
  );
});

router.post(
  "/finance/transactions",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateTransactionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [transaction] = await db
      .insert(transactionsTable)
      .values({
        salonId: req.salonId!,
        description: parsed.data.description,
        kind: parsed.data.kind,
        category: parsed.data.category,
        amount: parsed.data.amount,
        date: toDateString(parsed.data.date),
      })
      .returning();
    res
      .status(201)
      .json(CreateTransactionResponse.parse(toTransaction(transaction)));
  },
);

router.get("/inventory", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.salonId, req.salonId!))
    .orderBy(asc(inventoryItemsTable.name));
  res.json(ListInventoryResponse.parse(rows.map(toInventoryItem)));
});

router.post(
  "/inventory",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateInventoryItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [item] = await db
      .insert(inventoryItemsTable)
      .values({
        salonId: req.salonId!,
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        minimumQuantity: parsed.data.minimumQuantity,
        unit: parsed.data.unit,
        supplier: parsed.data.supplier ?? null,
        unitCost: parsed.data.unitCost ?? 0,
      })
      .returning();
    res
      .status(201)
      .json(CreateInventoryItemResponse.parse(toInventoryItem(item)));
  },
);

router.patch(
  "/inventory/:itemId",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const params = UpdateInventoryItemParams.safeParse(req.params);
    const parsed = UpdateInventoryItemBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : !parsed.success
            ? parsed.error.message
            : "Invalid inventory update",
      });
      return;
    }
    const input = parsed.data;
    const updates: Partial<typeof inventoryItemsTable.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.quantity !== undefined) updates.quantity = input.quantity;
    if (input.minimumQuantity !== undefined) {
      updates.minimumQuantity = input.minimumQuantity;
    }
    if (input.unit !== undefined) updates.unit = input.unit;
    if (input.supplier !== undefined) updates.supplier = input.supplier;
    if (input.unitCost !== undefined) updates.unitCost = input.unitCost;

    const [item] = await db
      .update(inventoryItemsTable)
      .set(updates)
      .where(
        and(
          eq(inventoryItemsTable.id, params.data.itemId),
          eq(inventoryItemsTable.salonId, req.salonId!),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Inventory item not found" });
      return;
    }
    res.json(UpdateInventoryItemResponse.parse(toInventoryItem(item)));
  },
);

router.delete(
  "/inventory/:itemId",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const params = DeleteInventoryItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [item] = await db
      .delete(inventoryItemsTable)
      .where(
        and(
          eq(inventoryItemsTable.id, params.data.itemId),
          eq(inventoryItemsTable.salonId, req.salonId!),
        ),
      )
      .returning({ id: inventoryItemsTable.id });
    if (!item) {
      res.status(404).json({ error: "Inventory item not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/campaigns", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.salonId, req.salonId!))
    .orderBy(desc(campaignsTable.createdAt));
  res.json(ListCampaignsResponse.parse(rows.map(toCampaign)));
});

router.post(
  "/campaigns",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateCampaignBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [campaign] = await db
      .insert(campaignsTable)
      .values({
        salonId: req.salonId!,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        discountPct: parsed.data.discountPct,
        startsAt: parsed.data.startsAt
          ? toDateString(parsed.data.startsAt)
          : null,
        endsAt: parsed.data.endsAt ? toDateString(parsed.data.endsAt) : null,
      })
      .returning();
    res.status(201).json(CreateCampaignResponse.parse(toCampaign(campaign)));
  },
);

export default router;
