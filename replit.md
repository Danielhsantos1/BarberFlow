# BarberFlow

SaaS de operação para barbearias: agenda online, clientes, equipe, serviços, caixa, estoque e campanhas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/barberflow run dev` — run the web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit-managed Clerk
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/barberflow/src/` — React web app and public booking flow
- `lib/api-spec/openapi.yaml` — API contract and generated client source
- `lib/db/src/schema/barberflow.ts` — PostgreSQL tables and tenant memberships
- `artifacts/api-server/src/routes/` — salon, scheduling, catalog, finance, inventory, campaigns, and public booking routes
- `artifacts/api-server/src/middlewares/auth.ts` — Clerk session and salon-role checks

## Architecture decisions

- Clerk manages sign-in; salon membership and role checks are enforced by the API.
- Each Clerk account currently resolves to one salon workspace. All administrative queries are scoped to that salon.
- Public booking is unauthenticated; administrative routes require a Clerk session and salon membership.
- WhatsApp actions open a pre-filled `wa.me` conversation. Automated message delivery is not enabled.
- Plan comparison is informational; subscription checkout and paid-plan enforcement are not connected yet.

## Product

Owners can manage appointments, clients, barbers, services, financial entries, inventory, coupons, and salon settings. Customers can book from a salon-specific public page. Completing an appointment records revenue and awards a loyalty point.

## User preferences

- Interface language: Portuguese (Brazil); monetary values use Brazilian reais.
- Visual direction: premium barbershop identity with black, gold, white, and dark gray.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before using generated types.
- Push development schema changes with `pnpm --filter @workspace/db run push`.
- Public booking slots use the salon's configured opening hours and 30-minute increments.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
