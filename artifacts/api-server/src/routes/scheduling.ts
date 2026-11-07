import { and, asc, count, eq, gte, lte, ne, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  DeleteAppointmentParams,
  GetDashboardResponse,
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  UpdateAppointmentResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  barbersTable,
  clientsTable,
  db,
  servicesTable,
  transactionsTable,
} from "@workspace/db";
import { requireSalonRoles } from "../middlewares/auth";
import {
  addMinutes,
  localDateString,
  toAppointment,
  toDateString,
  timeToMinutes,
} from "./shared";

const router: IRouter = Router();

async function getAssignedService(salonId: string, serviceId: string) {
  const [service] = await db
    .select()
    .from(servicesTable)
    .where(
      and(
        eq(servicesTable.id, serviceId),
        eq(servicesTable.salonId, salonId),
        eq(servicesTable.active, true),
      ),
    )
    .limit(1);
  return service;
}

async function getAssignedBarber(salonId: string, barberId: string) {
  const [barber] = await db
    .select()
    .from(barbersTable)
    .where(
      and(
        eq(barbersTable.id, barberId),
        eq(barbersTable.salonId, salonId),
        eq(barbersTable.active, true),
      ),
    )
    .limit(1);
  return barber;
}

async function hasConflict(
  salonId: string,
  barberId: string,
  date: string,
  startTime: string,
  endTime: string,
  exceptId?: string,
): Promise<boolean> {
  const overlapping = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.salonId, salonId),
        eq(appointmentsTable.barberId, barberId),
        eq(appointmentsTable.date, date),
        sql`${appointmentsTable.startTime} < ${endTime}`,
        sql`${appointmentsTable.endTime} > ${startTime}`,
        ne(appointmentsTable.status, "cancelled"),
        ne(appointmentsTable.status, "no_show"),
        ...(exceptId ? [ne(appointmentsTable.id, exceptId)] : []),
      ),
    )
    .limit(1);
  return overlapping.length > 0;
}

async function recordCompletion(
  salonId: string,
  appointment: typeof appointmentsTable.$inferSelect,
): Promise<void> {
  const [existing] = await db
    .select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(eq(transactionsTable.appointmentId, appointment.id))
    .limit(1);
  if (!existing) {
    await db.insert(transactionsTable).values({
      salonId,
      appointmentId: appointment.id,
      description: `${appointment.serviceName} · ${appointment.clientName}`,
      kind: "income",
      category: "Serviços",
      amount: Number(appointment.price),
      date: appointment.date,
    });
    if (appointment.clientId) {
      const [client] = await db
        .select()
        .from(clientsTable)
        .where(
          and(
            eq(clientsTable.id, appointment.clientId),
            eq(clientsTable.salonId, salonId),
          ),
        )
        .limit(1);
      if (client) {
        await db
          .update(clientsTable)
          .set({
            visits: client.visits + 1,
            loyaltyPoints: client.loyaltyPoints + 1,
            lastVisit: appointment.date,
          })
          .where(eq(clientsTable.id, client.id));
      }
    }
  }
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const salonId = req.salonId!;
  const today = localDateString();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [todayCount] = await db
    .select({ value: count() })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.salonId, salonId),
        eq(appointmentsTable.date, today),
        ne(appointmentsTable.status, "cancelled"),
        ne(appointmentsTable.status, "no_show"),
      ),
    );
  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.salonId, salonId),
        gte(transactionsTable.date, monthStart),
        lte(transactionsTable.date, today),
      ),
    );
  const clientsCount = await db
    .select({ value: count() })
    .from(clientsTable)
    .where(eq(clientsTable.salonId, salonId));
  const servicesCount = await db
    .select({ value: count() })
    .from(servicesTable)
    .where(
      and(
        eq(servicesTable.salonId, salonId),
        eq(servicesTable.active, true),
      ),
    );
  const upcoming = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.salonId, salonId),
        gte(appointmentsTable.date, today),
        ne(appointmentsTable.status, "cancelled"),
        ne(appointmentsTable.status, "no_show"),
      ),
    )
    .orderBy(asc(appointmentsTable.date), asc(appointmentsTable.startTime))
    .limit(6);
  const completed = await db
    .select({
      serviceName: appointmentsTable.serviceName,
      price: appointmentsTable.price,
    })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.salonId, salonId),
        eq(appointmentsTable.status, "completed"),
        gte(appointmentsTable.date, monthStart),
        lte(appointmentsTable.date, today),
      ),
    );

  const topMap = new Map<string, { bookings: number; revenue: number }>();
  for (const appointment of completed) {
    const current = topMap.get(appointment.serviceName) ?? {
      bookings: 0,
      revenue: 0,
    };
    current.bookings += 1;
    current.revenue += Number(appointment.price);
    topMap.set(appointment.serviceName, current);
  }
  const topServices = [...topMap.entries()]
    .map(([name, metrics]) => ({ name, ...metrics }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 4);

  const weeklyRevenue = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00-03:00`);
    date.setDate(date.getDate() - (6 - index));
    const label = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    }).format(date);
    const key = localDateString(date);
    return {
      label: label.replace(".", ""),
      revenue: transactions
        .filter((row) => row.kind === "income" && row.date === key)
        .reduce((sum, row) => sum + Number(row.amount), 0),
    };
  });

  res.json(
    GetDashboardResponse.parse({
      todayAppointments: Number(todayCount?.value ?? 0),
      monthlyRevenue: transactions
        .filter((row) => row.kind === "income")
        .reduce((sum, row) => sum + Number(row.amount), 0),
      clientCount: Number(clientsCount[0]?.value ?? 0),
      serviceCount: Number(servicesCount[0]?.value ?? 0),
      upcomingAppointments: upcoming.map(toAppointment),
      topServices,
      weeklyRevenue,
    }),
  );
});

router.get("/appointments", async (req, res): Promise<void> => {
  const parsed = ListAppointmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const from = toDateString(parsed.data.from);
  const to = toDateString(parsed.data.to);
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.salonId, req.salonId!),
        ...(from ? [gte(appointmentsTable.date, from)] : []),
        ...(to ? [lte(appointmentsTable.date, to)] : []),
        ...(parsed.data.status
          ? [eq(appointmentsTable.status, parsed.data.status)]
          : []),
      ),
    )
    .orderBy(asc(appointmentsTable.date), asc(appointmentsTable.startTime));
  res.json(ListAppointmentsResponse.parse(rows.map(toAppointment)));
});

router.post(
  "/appointments",
  async (req, res): Promise<void> => {
    const parsed = CreateAppointmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const input = parsed.data;
    const salonId = req.salonId!;
    const [service, barber] = await Promise.all([
      getAssignedService(salonId, input.serviceId),
      getAssignedBarber(salonId, input.barberId),
    ]);
    if (!service || !barber) {
      res.status(400).json({ error: "Escolha um serviço e um profissional ativos" });
      return;
    }

    const date = toDateString(input.date);
    const endTime = addMinutes(input.startTime, service.durationMinutes);
    if (
      await hasConflict(
        salonId,
        barber.id,
        date,
        input.startTime,
        endTime,
      )
    ) {
      res.status(409).json({ error: "Este profissional já tem um horário marcado nesse período" });
      return;
    }

    let clientId = input.clientId ?? null;
    if (clientId) {
      const [client] = await db
        .select()
        .from(clientsTable)
        .where(
          and(
            eq(clientsTable.id, clientId),
            eq(clientsTable.salonId, salonId),
          ),
        )
        .limit(1);
      if (!client) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
      }
    } else {
      const [existingClient] = await db
        .select()
        .from(clientsTable)
        .where(
          and(
            eq(clientsTable.salonId, salonId),
            eq(clientsTable.phone, input.clientPhone),
          ),
        )
        .limit(1);
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const [client] = await db
          .insert(clientsTable)
          .values({
            salonId,
            name: input.clientName,
            phone: input.clientPhone,
          })
          .returning();
        clientId = client.id;
      }
    }

    const [appointment] = await db
      .insert(appointmentsTable)
      .values({
        salonId,
        date,
        startTime: input.startTime,
        endTime,
        status: "confirmed",
        price: Number(service.price),
        clientId,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        barberId: barber.id,
        barberName: barber.name,
        serviceId: service.id,
        serviceName: service.name,
        notes: input.notes ?? null,
      })
      .returning();
    res.status(201).json(
      CreateAppointmentResponse.parse(toAppointment(appointment)),
    );
  },
);

router.patch(
  "/appointments/:appointmentId",
  async (req, res): Promise<void> => {
    const params = UpdateAppointmentParams.safeParse(req.params);
    const parsed = UpdateAppointmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : !parsed.success
            ? parsed.error.message
            : "Invalid appointment update",
      });
      return;
    }

    const salonId = req.salonId!;
    const [existing] = await db
      .select()
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.id, params.data.appointmentId),
          eq(appointmentsTable.salonId, salonId),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    const input = parsed.data;
    const serviceId = input.serviceId ?? existing.serviceId;
    const barberId = input.barberId ?? existing.barberId;
    const [service, barber] = await Promise.all([
      getAssignedService(salonId, serviceId),
      getAssignedBarber(salonId, barberId),
    ]);
    if (!service || !barber) {
      res.status(400).json({ error: "Escolha um serviço e um profissional ativos" });
      return;
    }
    const date = input.date ? toDateString(input.date) : existing.date;
    const startTime = input.startTime ?? existing.startTime;
    const endTime = addMinutes(startTime, service.durationMinutes);
    if (
      await hasConflict(
        salonId,
        barber.id,
        date,
        startTime,
        endTime,
        existing.id,
      )
    ) {
      res.status(409).json({ error: "Este profissional já tem um horário marcado nesse período" });
      return;
    }

    const [updated] = await db
      .update(appointmentsTable)
      .set({
        date,
        startTime,
        endTime,
        serviceId: service.id,
        serviceName: service.name,
        price: Number(service.price),
        barberId: barber.id,
        barberName: barber.name,
        status: input.status ?? existing.status,
        notes: input.notes === undefined ? existing.notes : input.notes,
      })
      .where(
        and(
          eq(appointmentsTable.id, existing.id),
          eq(appointmentsTable.salonId, salonId),
        ),
      )
      .returning();

    if (updated.status === "completed" && existing.status !== "completed") {
      await recordCompletion(salonId, updated);
    }
    res.json(UpdateAppointmentResponse.parse(toAppointment(updated)));
  },
);

router.delete(
  "/appointments/:appointmentId",
  async (req, res): Promise<void> => {
    const params = DeleteAppointmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [appointment] = await db
      .update(appointmentsTable)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(appointmentsTable.id, params.data.appointmentId),
          eq(appointmentsTable.salonId, req.salonId!),
        ),
      )
      .returning({ id: appointmentsTable.id });
    if (!appointment) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
