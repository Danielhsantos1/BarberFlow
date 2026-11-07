import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type WorkingHours = Record<
  string,
  { open: string; close: string; closed?: boolean }
>;

export const salonsTable = pgTable(
  "salons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    cnpj: text("cnpj"),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    whatsapp: text("whatsapp").notNull(),
    logoUrl: text("logo_url"),
    openingHours: jsonb("opening_hours")
      .$type<WorkingHours>()
      .notNull()
      .default({}),
    plan: text("plan").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("salons_slug_unique").on(table.slug)],
);

export const membershipsTable = pgTable(
  "salon_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("salon_memberships_user_idx").on(table.clerkUserId),
    uniqueIndex("salon_memberships_user_unique").on(table.clerkUserId),
  ],
);

export const clientsTable = pgTable(
  "salon_clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    visits: integer("visits").notNull().default(0),
    loyaltyPoints: integer("loyalty_points").notNull().default(0),
    preferredStyle: text("preferred_style"),
    notes: text("notes"),
    lastVisit: date("last_visit", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("salon_clients_tenant_idx").on(table.salonId),
    index("salon_clients_phone_idx").on(table.salonId, table.phone),
  ],
);

export const barbersTable = pgTable(
  "salon_barbers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    specialties: text("specialties").array().notNull().default([]),
    commissionPct: real("commission_pct").notNull().default(40),
    active: boolean("active").notNull().default(true),
    workingHours: jsonb("working_hours")
      .$type<WorkingHours>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("salon_barbers_tenant_idx").on(table.salonId)],
);

export const servicesTable = pgTable(
  "salon_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    price: real("price").notNull(),
    active: boolean("active").notNull().default(true),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("salon_services_tenant_idx").on(table.salonId)],
);

export const appointmentsTable = pgTable(
  "salon_appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    date: date("appointment_date", { mode: "string" }).notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    status: text("status").notNull().default("confirmed"),
    price: real("price").notNull(),
    clientId: uuid("client_id").references(() => clientsTable.id, {
      onDelete: "set null",
    }),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),
    barberId: uuid("barber_id")
      .notNull()
      .references(() => barbersTable.id),
    barberName: text("barber_name").notNull(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => servicesTable.id),
    serviceName: text("service_name").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("salon_appointments_tenant_date_idx").on(table.salonId, table.date),
    index("salon_appointments_barber_date_idx").on(
      table.barberId,
      table.date,
    ),
  ],
);

export const transactionsTable = pgTable(
  "salon_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id"),
    description: text("description").notNull(),
    kind: text("kind").notNull(),
    category: text("category").notNull(),
    amount: real("amount").notNull(),
    date: date("transaction_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("salon_transactions_tenant_date_idx").on(table.salonId, table.date),
    uniqueIndex("salon_transactions_appointment_unique").on(
      table.appointmentId,
    ),
  ],
);

export const inventoryItemsTable = pgTable(
  "salon_inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: real("quantity").notNull().default(0),
    minimumQuantity: real("minimum_quantity").notNull().default(0),
    unit: text("unit").notNull().default("un"),
    supplier: text("supplier"),
    unitCost: real("unit_cost").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("salon_inventory_tenant_idx").on(table.salonId)],
);

export const campaignsTable = pgTable(
  "salon_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salonsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    discountPct: real("discount_pct").notNull(),
    active: boolean("active").notNull().default(true),
    redemptionCount: integer("redemption_count").notNull().default(0),
    startsAt: date("starts_at", { mode: "string" }),
    endsAt: date("ends_at", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("salon_campaigns_tenant_idx").on(table.salonId),
    uniqueIndex("salon_campaign_code_unique").on(table.salonId, table.code),
  ],
);
