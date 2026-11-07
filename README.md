# BarberFlow

SaaS de operação para barbearias: agenda online, clientes, equipe, serviços, caixa, estoque e campanhas.

## Pré-requisitos

- Node.js 24
- pnpm 10 (`corepack enable` já instala a versão certa)
- Um banco PostgreSQL (Neon, Supabase, Railway ou local)
- Uma conta no [Clerk](https://dashboard.clerk.com) para o login

## Rodando localmente

```bash
pnpm install
cp .env.example .env        # preencha DATABASE_URL e as chaves do Clerk
pnpm db:push                # cria as tabelas no banco
pnpm dev                    # sobe API (8080) e web (5173) juntos
```

Abra http://localhost:5173. Em desenvolvimento o Vite repassa `/api` para a API.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | API + web em modo desenvolvimento |
| `pnpm dev:api` / `pnpm dev:web` | Só um dos dois |
| `pnpm db:push` | Aplica o schema do Drizzle no banco (dev) |
| `pnpm run typecheck` | Checagem de tipos em todos os pacotes |
| `pnpm run build` | Typecheck + build de tudo |
| `pnpm start` | Roda a build de produção (API servindo o front) |
| `pnpm --filter @workspace/api-spec run codegen` | Regenera hooks e schemas Zod a partir do OpenAPI |

## Deploy

### Vercel (atual)

O projeto já está configurado (`vercel.json` + `scripts/vercel-build.mjs`): o site vai para a CDN e a API roda como uma função serverless em `/api`. Cada push na `main` publica automaticamente.

Variáveis no painel da Vercel (Settings → Environment Variables): `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`. Depois de mudar variáveis, faça um **Redeploy**.

### Servidor Node tradicional (Render, Railway, VPS)

Em produção é **um único serviço Node**: a API serve o front já buildado.

- Build: `pnpm install --frozen-lockfile && pnpm run build`
- Start: `pnpm start`
- Variáveis: `NODE_ENV=production`, `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` (precisa existir **no build**, pois vai embutida no front). `PORT` normalmente é definida pela plataforma.
- Healthcheck: `GET /api/healthz`

Funciona em Render, Railway, Fly.io ou qualquer VPS.

## Stack

- pnpm workspaces, TypeScript 5.9
- Frontend: React + Vite + Tailwind
- API: Express 5 (bundle com esbuild)
- Banco: PostgreSQL + Drizzle ORM
- Auth: Clerk
- Validação: Zod, `drizzle-zod`
- Codegen da API: Orval (a partir do OpenAPI)

## Onde fica cada coisa

- `artifacts/barberflow/src/` — app web e fluxo de agendamento público
- `artifacts/api-server/src/routes/` — rotas de salão, agenda, catálogo, financeiro, estoque, campanhas e agendamento público
- `artifacts/api-server/src/middlewares/auth.ts` — sessão Clerk e checagem de papel no salão
- `lib/api-spec/openapi.yaml` — contrato da API (fonte do client gerado)
- `lib/db/src/schema/barberflow.ts` — tabelas e vínculos de usuários com salões

## Decisões de arquitetura

- O Clerk cuida do login; vínculo com o salão e papéis são validados pela API.
- Cada conta Clerk pertence a um salão. Todas as consultas administrativas são filtradas por esse salão.
- O agendamento público não exige login; rotas administrativas exigem sessão Clerk e vínculo com o salão.
- Ações de WhatsApp abrem uma conversa `wa.me` pré-preenchida (não há envio automático).
- A comparação de planos é informativa; checkout e cobrança ainda não estão conectados.

## Cuidados

- Depois de editar `lib/api-spec/openapi.yaml`, rode o codegen antes de usar os tipos gerados.
- Os horários do agendamento público usam o horário de funcionamento do salão em intervalos de 30 minutos.
- Interface em português (Brasil); valores em reais.
