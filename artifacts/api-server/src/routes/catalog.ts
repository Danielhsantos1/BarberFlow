import { and, asc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateBarberBody,
  CreateBarberResponse,
  CreateClientBody,
  CreateClientResponse,
  CreateServiceBody,
  CreateServiceResponse,
  DeleteBarberParams,
  DeleteClientParams,
  DeleteServiceParams,
  ListBarbersResponse,
  ListClientsQueryParams,
  ListClientsResponse,
  ListServicesResponse,
  UpdateBarberBody,
  UpdateBarberParams,
  UpdateBarberResponse,
  UpdateClientBody,
  UpdateClientParams,
  UpdateClientResponse,
  UpdateServiceBody,
  UpdateServiceParams,
  UpdateServiceResponse,
} from "@workspace/api-zod";
import {
  barbersTable,
  clientsTable,
  db,
  servicesTable,
  type WorkingHours,
} from "@workspace/db";
import { requireSalonRoles } from "../middlewares/auth";
import {
  toBarber,
  toClient,
  toDateString,
  toService,
} from "./shared";

const router: IRouter = Router();

router.get("/clients", async (req, res): Promise<void> => {
  const params = ListClientsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const search = params.data.search?.trim();
  const rows = await db
    .select()
    .from(clientsTable)
    .where(
      and(
        eq(clientsTable.salonId, req.salonId!),
        ...(search
          ? [
              or(
                ilike(clientsTable.name, `%${search}%`),
                ilike(clientsTable.phone, `%${search}%`),
                ilike(clientsTable.email, `%${search}%`),
              )!,
            ]
          : []),
      ),
    )
    .orderBy(asc(clientsTable.name));
  res.json(ListClientsResponse.parse(rows.map(toClient)));
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db
    .insert(clientsTable)
    .values({
      salonId: req.salonId!,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email ?? null,
      preferredStyle: parsed.data.preferredStyle ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(CreateClientResponse.parse(toClient(client)));
});

router.patch("/clients/:clientId", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : !parsed.success
          ? parsed.error.message
          : "Invalid client update",
    });
    return;
  }

  const updates: Partial<typeof clientsTable.$inferInsert> = {};
  const input = parsed.data;
  if (input.name !== undefined) updates.name = input.name;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.email !== undefined) updates.email = input.email;
  if (input.preferredStyle !== undefined) {
    updates.preferredStyle = input.preferredStyle;
  }
  if (input.notes !== undefined) updates.notes = input.notes;

  const [client] = await db
    .update(clientsTable)
    .set(updates)
    .where(
      and(
        eq(clientsTable.id, params.data.clientId),
        eq(clientsTable.salonId, req.salonId!),
      ),
    )
    .returning();
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.json(UpdateClientResponse.parse(toClient(client)));
});

router.delete("/clients/:clientId", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db
    .delete(clientsTable)
    .where(
      and(
        eq(clientsTable.id, params.data.clientId),
        eq(clientsTable.salonId, req.salonId!),
      ),
    )
    .returning({ id: clientsTable.id });
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.sendStatus(204);
});

router.get("/barbers", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(barbersTable)
    .where(eq(barbersTable.salonId, req.salonId!))
    .orderBy(asc(barbersTable.name));
  res.json(ListBarbersResponse.parse(rows.map(toBarber)));
});

router.post(
  "/barbers",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateBarberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [barber] = await db
      .insert(barbersTable)
      .values({
        salonId: req.salonId!,
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        specialties: parsed.data.specialties ?? [],
        commissionPct: parsed.data.commissionPct ?? 40,
        workingHours:
          (parsed.data.workingHours as WorkingHours | undefined) ?? {},
      })
      .returning();
    res.status(201).json(CreateBarberResponse.parse(toBarber(barber)));
  },
);

router.patch(
  "/barbers/:barberId",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const params = UpdateBarberParams.safeParse(req.params);
    const parsed = UpdateBarberBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
      error: !params.success
        ? params.error.message
        : !parsed.success
          ? parsed.error.message
          : "Invalid barber update",
      });
      return;
    }
    const input = parsed.data;
    const updates: Partial<typeof barbersTable.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.specialties !== undefined) updates.specialties = input.specialties;
    if (input.commissionPct !== undefined) {
      updates.commissionPct = input.commissionPct;
    }
    if (input.active !== undefined) updates.active = input.active;
    if (input.workingHours !== undefined) {
      updates.workingHours = input.workingHours as WorkingHours;
    }

    const [barber] = await db
      .update(barbersTable)
      .set(updates)
      .where(
        and(
          eq(barbersTable.id, params.data.barberId),
          eq(barbersTable.salonId, req.salonId!),
        ),
      )
      .returning();
    if (!barber) {
      res.status(404).json({ error: "Profissional não encontrado" });
      return;
    }
    res.json(UpdateBarberResponse.parse(toBarber(barber)));
  },
);

router.delete(
  "/barbers/:barberId",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const params = DeleteBarberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [barber] = await db
      .update(barbersTable)
      .set({ active: false })
      .where(
        and(
          eq(barbersTable.id, params.data.barberId),
          eq(barbersTable.salonId, req.salonId!),
        ),
      )
      .returning({ id: barbersTable.id });
    if (!barber) {
      res.status(404).json({ error: "Profissional não encontrado" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/services", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.salonId, req.salonId!))
    .orderBy(asc(servicesTable.name));
  res.json(ListServicesResponse.parse(rows.map(toService)));
});

router.post(
  "/services",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateServiceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [service] = await db
      .insert(servicesTable)
      .values({
        salonId: req.salonId!,
        name: parsed.data.name,
        category: parsed.data.category,
        durationMinutes: parsed.data.durationMinutes,
        price: parsed.data.price,
        description: parsed.data.description ?? null,
      })
      .returning();
    res.status(201).json(CreateServiceResponse.parse(toService(service)));
  },
);

router.patch(
  "/services/:serviceId",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const params = UpdateServiceParams.safeParse(req.params);
    const parsed = UpdateServiceBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
      error: !params.success
        ? params.error.message
        : !parsed.success
          ? parsed.error.message
          : "Invalid service update",
      });
      return;
    }
    const input = parsed.data;
    const updates: Partial<typeof servicesTable.$inferInsert> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.category !== undefined) updates.category = input.category;
    if (input.durationMinutes !== undefined) {
      updates.durationMinutes = input.durationMinutes;
    }
    if (input.price !== undefined) updates.price = input.price;
    if (input.active !== undefined) updates.active = input.active;
    if (input.description !== undefined) {
      updates.description = input.description;
    }

    const [service] = await db
      .update(servicesTable)
      .set(updates)
      .where(
        and(
          eq(servicesTable.id, params.data.serviceId),
          eq(servicesTable.salonId, req.salonId!),
        ),
      )
      .returning();
    if (!service) {
      res.status(404).json({ error: "Serviço não encontrado" });
      return;
    }
    res.json(UpdateServiceResponse.parse(toService(service)));
  },
);

router.delete(
  "/services/:serviceId",
  requireSalonRoles("owner", "admin"),
  async (req, res): Promise<void> => {
    const params = DeleteServiceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [service] = await db
      .update(servicesTable)
      .set({ active: false })
      .where(
        and(
          eq(servicesTable.id, params.data.serviceId),
          eq(servicesTable.salonId, req.salonId!),
        ),
      )
      .returning({ id: servicesTable.id });
    if (!service) {
      res.status(404).json({ error: "Serviço não encontrado" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
