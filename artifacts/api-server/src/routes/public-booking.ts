import { and, eq, ne, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CheckBookingAvailabilityBody,
  CheckBookingAvailabilityParams,
  CheckBookingAvailabilityResponse,
  CreatePublicBookingBody,
  CreatePublicBookingParams,
  CreatePublicBookingResponse,
  GetPublicSalonParams,
  GetPublicSalonResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  barbersTable,
  clientsTable,
  db,
  salonsTable,
  servicesTable,
  type WorkingHours,
} from "@workspace/db";
import {
  addMinutes,
  localDateString,
  timeToMinutes,
  toAppointment,
  toBarber,
  toDateString,
  toService,
} from "./shared";

const router: IRouter = Router();
const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function localMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function dateWeekday(date: string): string {
  return weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? "monday";
}

function validHours(
  hours: WorkingHours,
  day: string,
): { open: string; close: string; closed: boolean } {
  const entry = hours[day];
  if (!entry) {
    return day === "sunday"
      ? { open: "09:00", close: "18:00", closed: true }
      : { open: "09:00", close: "18:00", closed: false };
  }
  return { ...entry, closed: entry.closed ?? false };
}

async function getAvailability(
  salonId: string,
  date: string,
  serviceId: string,
  barberId?: string | null,
) {
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
  if (!service) return null;

  const [salon] = await db
    .select()
    .from(salonsTable)
    .where(eq(salonsTable.id, salonId))
    .limit(1);
  if (!salon) return null;

  const barberConditions = [
    eq(barbersTable.salonId, salonId),
    eq(barbersTable.active, true),
    ...(barberId ? [eq(barbersTable.id, barberId)] : []),
  ];
  const barbers = await db
    .select()
    .from(barbersTable)
    .where(and(...barberConditions));
  const existingAppointments = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.salonId, salonId),
        eq(appointmentsTable.date, date),
        ne(appointmentsTable.status, "cancelled"),
        ne(appointmentsTable.status, "no_show"),
      ),
    );

  const day = dateWeekday(date);
  const salonHours = validHours(salon.openingHours ?? {}, day);
  const now = date === localDateString() ? localMinutesNow() : -1;

  const slots: Array<{
    startTime: string;
    barberId: string;
    barberName: string;
  }> = [];
  for (const barber of barbers) {
    const barberHasHours = Boolean(barber.workingHours?.[day]);
    const hours = barberHasHours
      ? validHours(barber.workingHours, day)
      : salonHours;
    const open = hours.open || salonHours.open;
    const close = hours.close || salonHours.close;
    if (hours.closed) continue;

    for (
      let minute = timeToMinutes(open);
      minute + service.durationMinutes <= timeToMinutes(close);
      minute += 30
    ) {
      if (minute <= now) continue;
      const startTime = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const endTime = addMinutes(startTime, service.durationMinutes);
      const overlaps = existingAppointments.some(
        (appointment) =>
          appointment.barberId === barber.id &&
          appointment.startTime < endTime &&
          appointment.endTime > startTime,
      );
      if (!overlaps) {
        slots.push({
          startTime,
          barberId: barber.id,
          barberName: barber.name,
        });
      }
    }
  }
  return { service, barbers, slots };
}

router.get(
  "/public/salons/:slug",
  async (req, res): Promise<void> => {
    const params = GetPublicSalonParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [salon] = await db
      .select()
      .from(salonsTable)
      .where(eq(salonsTable.slug, params.data.slug))
      .limit(1);
    if (!salon) {
      res.status(404).json({ error: "Salon not found" });
      return;
    }
    const [services, barbers] = await Promise.all([
      db
        .select()
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.salonId, salon.id),
            eq(servicesTable.active, true),
          ),
        ),
      db
        .select()
        .from(barbersTable)
        .where(
          and(
            eq(barbersTable.salonId, salon.id),
            eq(barbersTable.active, true),
          ),
        ),
    ]);
    res.json(
      GetPublicSalonResponse.parse({
        name: salon.name,
        slug: salon.slug,
        address: salon.address,
        phone: salon.phone,
        whatsapp: salon.whatsapp,
        logoUrl: salon.logoUrl,
        services: services.map(toService),
        barbers: barbers.map(toBarber),
      }),
    );
  },
);

router.post(
  "/public/salons/:slug/availability",
  async (req, res): Promise<void> => {
    const params = CheckBookingAvailabilityParams.safeParse(req.params);
    const parsed = CheckBookingAvailabilityBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : !parsed.success
            ? parsed.error.message
            : "Invalid availability request",
      });
      return;
    }
    const [salon] = await db
      .select({ id: salonsTable.id })
      .from(salonsTable)
      .where(eq(salonsTable.slug, params.data.slug))
      .limit(1);
    if (!salon) {
      res.status(404).json({ error: "Salon not found" });
      return;
    }
    const availability = await getAvailability(
      salon.id,
      toDateString(parsed.data.date),
      parsed.data.serviceId,
      parsed.data.barberId ?? undefined,
    );
    if (!availability) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.json(CheckBookingAvailabilityResponse.parse(availability.slots));
  },
);

router.post(
  "/public/salons/:slug/bookings",
  async (req, res): Promise<void> => {
    const params = CreatePublicBookingParams.safeParse(req.params);
    const parsed = CreatePublicBookingBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : !parsed.success
            ? parsed.error.message
            : "Invalid booking request",
      });
      return;
    }
    const [salon] = await db
      .select()
      .from(salonsTable)
      .where(eq(salonsTable.slug, params.data.slug))
      .limit(1);
    if (!salon) {
      res.status(404).json({ error: "Salon not found" });
      return;
    }

    const input = parsed.data;
    const date = toDateString(input.date);
    const availability = await getAvailability(
      salon.id,
      date,
      input.serviceId,
      input.barberId,
    );
    const slot = availability?.slots.find(
      (item) =>
        item.startTime === input.startTime && item.barberId === input.barberId,
    );
    if (!availability || !slot) {
      res.status(409).json({ error: "Time slot is no longer available" });
      return;
    }

    const [barber] = await db
      .select()
      .from(barbersTable)
      .where(
        and(
          eq(barbersTable.id, slot.barberId),
          eq(barbersTable.salonId, salon.id),
        ),
      )
      .limit(1);
    if (!barber) {
      res.status(404).json({ error: "Barber not found" });
      return;
    }

    const [existingClient] = await db
      .select()
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.salonId, salon.id),
          eq(clientsTable.phone, input.clientPhone),
        ),
      )
      .limit(1);
    const [client] = existingClient
      ? [existingClient]
      : await db
          .insert(clientsTable)
          .values({
            salonId: salon.id,
            name: input.clientName,
            phone: input.clientPhone,
          })
          .returning();

    const [appointment] = await db
      .insert(appointmentsTable)
      .values({
        salonId: salon.id,
        date,
        startTime: input.startTime,
        endTime: addMinutes(input.startTime, availability.service.durationMinutes),
        status: "confirmed",
        price: Number(availability.service.price),
        clientId: client.id,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        barberId: barber.id,
        barberName: barber.name,
        serviceId: availability.service.id,
        serviceName: availability.service.name,
        notes: input.notes ?? null,
      })
      .returning();

    res
      .status(201)
      .json(
        CreatePublicBookingResponse.parse(toAppointment(appointment)),
      );
  },
);

export default router;
