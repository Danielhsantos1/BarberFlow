import {
  appointmentsTable,
  barbersTable,
  campaignsTable,
  clientsTable,
  inventoryItemsTable,
  salonsTable,
  servicesTable,
  transactionsTable,
} from "@workspace/db";

export function toDateString(value: Date | string | null | undefined): string {
  if (value == null) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function localDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addMinutes(startTime: string, minutes: number): string {
  const [hours, mins] = startTime.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function toAppointment(row: typeof appointmentsTable.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    price: Number(row.price),
    clientId: row.clientId,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    barberId: row.barberId,
    barberName: row.barberName,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    notes: row.notes,
  };
}

export function toClient(row: typeof clientsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    visits: row.visits,
    loyaltyPoints: row.loyaltyPoints,
    preferredStyle: row.preferredStyle,
    notes: row.notes,
    lastVisit: row.lastVisit,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBarber(row: typeof barbersTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    specialties: row.specialties,
    commissionPct: Number(row.commissionPct),
    active: row.active,
    workingHours: row.workingHours,
  };
}

export function toService(row: typeof servicesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    durationMinutes: row.durationMinutes,
    price: Number(row.price),
    active: row.active,
    description: row.description,
  };
}

export function toTransaction(row: typeof transactionsTable.$inferSelect) {
  return {
    id: row.id,
    description: row.description,
    kind: row.kind,
    category: row.category,
    amount: Number(row.amount),
    date: row.date,
  };
}

export function toInventoryItem(row: typeof inventoryItemsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity),
    minimumQuantity: Number(row.minimumQuantity),
    unit: row.unit,
    supplier: row.supplier,
    unitCost: Number(row.unitCost),
    lowStock: Number(row.quantity) <= Number(row.minimumQuantity),
  };
}

export function toCampaign(row: typeof campaignsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    discountPct: Number(row.discountPct),
    active: row.active,
    redemptionCount: row.redemptionCount,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  };
}

export function toSalon(row: typeof salonsTable.$inferSelect) {
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
