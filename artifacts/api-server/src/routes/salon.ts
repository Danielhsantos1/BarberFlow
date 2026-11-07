import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateSalonBody,
  CreateSalonResponse,
  GetCurrentSalonResponse,
  UpdateCurrentSalonBody,
  UpdateCurrentSalonResponse,
} from "@workspace/api-zod";
import {
  db,
  membershipsTable,
  salonsTable,
} from "@workspace/db";
import {
  findSalonMembership,
  requireAuthenticatedUser,
  requireSalonMembership,
  requireSalonRoles,
} from "../middlewares/auth";
import type { WorkingHours } from "@workspace/db";

const router: IRouter = Router();

function toSalon(row: typeof salonsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    cnpj: row.cnpj,
    address: row.address,
    phone: row.phone,
    whatsapp: row.whatsapp,
    logoUrl: row.logoUrl,
    openingHours: row.openingHours,
    plan: row.plan,
    createdAt: row.createdAt.toISOString(),
  };
}

function makeSlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "barbearia"}-${randomUUID().slice(0, 6)}`;
}

const defaultHours: WorkingHours = {
  monday: { open: "09:00", close: "19:00" },
  tuesday: { open: "09:00", close: "19:00" },
  wednesday: { open: "09:00", close: "19:00" },
  thursday: { open: "09:00", close: "19:00" },
  friday: { open: "09:00", close: "19:00" },
  saturday: { open: "09:00", close: "16:00" },
  sunday: { open: "09:00", close: "13:00", closed: true },
};

router.get(
  "/salon/current",
  requireAuthenticatedUser,
  async (req, res): Promise<void> => {
    const userId = req.clerkUserId;
    if (!userId) {
      res.status(401).json({ error: "Faça login para continuar" });
      return;
    }

    const membership = await findSalonMembership(userId);
    if (!membership) {
      res.status(404).json({ error: "Cadastre sua barbearia para continuar" });
      return;
    }

    const [salon] = await db
      .select()
      .from(salonsTable)
      .where(eq(salonsTable.id, membership.salonId))
      .limit(1);
    if (!salon) {
      res.status(404).json({ error: "Barbearia não encontrada" });
      return;
    }

    res.json(
      GetCurrentSalonResponse.parse({
        salon: toSalon(salon),
        role: membership.role,
      }),
    );
  },
);

router.post(
  "/salon",
  requireAuthenticatedUser,
  async (req, res): Promise<void> => {
    const parsed = CreateSalonBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!req.clerkUserId) {
      res.status(401).json({ error: "Faça login para continuar" });
      return;
    }

    const existing = await findSalonMembership(req.clerkUserId);
    if (existing) {
      res.status(409).json({ error: "Sua conta já está vinculada a uma barbearia" });
      return;
    }

    const input = parsed.data;
    const result = await db.transaction(async (tx) => {
      const [salon] = await tx
        .insert(salonsTable)
        .values({
          name: input.name,
          slug: makeSlug(input.name),
          cnpj: input.cnpj ?? null,
          address: input.address,
          phone: input.phone,
          whatsapp: input.whatsapp,
          openingHours: (input.openingHours as WorkingHours | undefined) ??
            defaultHours,
        })
        .returning();

      await tx.insert(membershipsTable).values({
        salonId: salon.id,
        clerkUserId: req.clerkUserId!,
        role: "owner",
      });

      return { salon, role: "owner" as const };
    });

    res.status(201).json(
      CreateSalonResponse.parse({
        salon: toSalon(result.salon),
        role: result.role,
      }),
    );
  },
);

router.patch(
  "/salon/current",
  requireAuthenticatedUser,
  requireSalonMembership,
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = UpdateCurrentSalonBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!req.salonId) {
      res.status(404).json({ error: "Barbearia não encontrada" });
      return;
    }

    const input = parsed.data;
    const updates: Partial<typeof salonsTable.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.cnpj !== undefined) updates.cnpj = input.cnpj;
    if (input.address !== undefined) updates.address = input.address;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.whatsapp !== undefined) updates.whatsapp = input.whatsapp;
    if (input.logoUrl !== undefined) updates.logoUrl = input.logoUrl;
    if (input.openingHours !== undefined) {
      updates.openingHours = input.openingHours as WorkingHours;
    }

    const [salon] = await db
      .update(salonsTable)
      .set(updates)
      .where(and(eq(salonsTable.id, req.salonId)))
      .returning();
    if (!salon) {
      res.status(404).json({ error: "Barbearia não encontrada" });
      return;
    }

    res.json(UpdateCurrentSalonResponse.parse(toSalon(salon)));
  },
);

export default router;
