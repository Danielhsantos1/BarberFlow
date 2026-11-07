// Gera as telas do Kortta preenchidas com os dados fictícios (screens/demo-data.cjs),
// reproduzindo a marcação e as classes do App.tsx, e captura PNGs + caixas de recorte.
// Uso: node scripts/build-screens.cjs <dir-com-node_modules-do-@tailwindcss/cli>
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const sdir = path.join(root, 'screens');
const twDir = process.argv[2];
const D = require(path.join(sdir, 'demo-data.cjs'));
const icons = JSON.parse(fs.readFileSync(path.join(sdir, 'icons.json'), 'utf8'));

const icon = (name, size = 16, cls = '') => icons[name]
  .replace(/width="24"/, `width="${size}"`).replace(/height="24"/, `height="${size}"`)
  .replace(/class="([^"]*)"/, `class="$1 ${cls}"`);
const money = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const initials = n => n.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const datePt = d => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const statusText = { scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu' };

const POLE = 'repeating-linear-gradient(135deg, #e63946 0 6px, #ffffff 6px 12px, #1d4ed8 12px 18px, #ffffff 18px 24px)';
const navItems = [
  ['/dashboard', 'Visão geral', 'layout-dashboard'], ['/agenda', 'Agenda', 'calendar-days'], ['/clientes', 'Clientes', 'users'],
  ['/equipe', 'Equipe', 'scissors'], ['/servicos', 'Serviços', 'shopping-bag'], ['/financeiro', 'Financeiro', 'circle-dollar-sign'],
  ['/estoque', 'Estoque', 'package'], ['/marketing', 'Marketing', 'gift'], ['/configuracoes', 'Configurações', 'settings'],
];

const brand = `<div class="flex items-center gap-3"><div aria-hidden class="h-10 w-10 rounded-xl ring-1 ring-black/10 shadow-[inset_0_0_0_2px_rgba(255,255,255,.85)]" style="background:${POLE}"></div><div><div class="brand-display font-bold text-xl leading-none">kortta</div><div class="mt-1 text-[9px] uppercase tracking-[.24em] text-[#94a1b5]">gestão de barbearias</div></div></div>`;

function shell(current, label, body) {
  const nav = navItems.map(([href, l, ic]) => `<a class="nav-link ${href === current ? 'active' : ''}">${icon(ic, 16)}<span>${l}</span>${href === '/agenda' ? '<span class="ml-auto h-1.5 w-1.5 rounded-full bg-[#e63946]"></span>' : ''}</a>`).join('');
  return `<div class="app-shell flex min-h-[100dvh]">
  <div class="hidden w-[248px] shrink-0 lg:block"><aside class="sidebar flex h-full min-h-[100dvh] flex-col px-4 py-5">
    <a class="px-2 pb-7">${brand}</a>
    <div class="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.2em] text-[#5f6f86]">Workspace</div>
    <nav class="space-y-1">${nav}</nav>
    <div class="mt-auto border-t border-[#ffffff1c] pt-4"><div class="mb-4 flex items-center gap-3 rounded-xl bg-[#ffffff0b] p-3"><div class="grid h-9 w-9 place-items-center rounded-lg bg-[#e63946] text-xs font-bold text-[#ffffff]">${D.salon.initials}</div><div class="min-w-0 flex-1"><div class="truncate text-xs font-semibold text-[#dbe4f2]">${D.salon.name}</div><div class="mt-1 truncate text-[10px] text-[#7c8ca4]">Plano ${D.salon.plan}</div></div>${icon('chevron-down', 14, 'text-[#5e6e85]')}</div><button class="nav-link w-full">${icon('log-out', 16)}Sair da conta</button></div>
  </aside></div>
  <div class="min-w-0 flex-1"><header class="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#d9e2f0] bg-[#eef2f9ee] px-5 backdrop-blur-md sm:px-8"><div class="flex items-center gap-3"><div class="text-xs text-[#6b7d97]">Kortta <span class="mx-2 text-[#b0baca]">/</span><span class="font-semibold text-[#1d3353]">${label}</span></div></div><div class="flex items-center gap-3"><span class="hidden text-xs text-[#5e6e85] sm:block">${D.TODAY.long}</span><div class="grid h-9 w-9 place-items-center rounded-full border border-[#cdd5e1] bg-[#d6e0f0] text-[11px] font-bold text-[#6d131b]">${D.salon.initials}</div></div></header>
  <main class="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">${body}</main></div>
</div>`;
}

function appointmentLine(a) {
  return `<div class="flex flex-wrap items-center gap-3 px-5 py-4"><div class="w-12 font-mono text-xs font-semibold text-[#a11c27]">${a.startTime}</div><div class="grid h-9 w-9 place-items-center rounded-full bg-[#d9e2f0] text-[10px] font-bold text-[#4b5b74]">${initials(a.clientName)}</div><div class="min-w-0 flex-1"><div class="truncate text-xs font-semibold">${a.clientName}</div><div class="mt-1 truncate text-[10px] text-[#6a7c97]">${a.serviceName} · ${a.barberName}</div></div><span class="rounded-full bg-[#e5ebf5] px-2.5 py-1 text-[10px] font-semibold text-[#881821]">${statusText[a.status]}</span><div class="w-20 text-right text-xs font-semibold">${money(a.price)}</div></div>`;
}

function dashboard() {
  const d = D.dashboard;
  const cards = [
    ['Agendamentos hoje', String(d.todayAppointments), 'na agenda', 'calendar-days'],
    ['Receita do mês', money(d.monthlyRevenue), 'faturamento acumulado', 'circle-dollar-sign'],
    ['Clientes ativos', String(d.clientCount), 'na sua base', 'users'],
    ['Serviços', String(d.serviceCount), 'no catálogo', 'scissors'],
  ].map(([l, v, det, ic], i) => `<div class="surface p-5" data-crop="kpi${i}"><div class="flex items-center justify-between"><span class="text-xs text-[#5e6e85]">${l}</span><span class="grid h-9 w-9 place-items-center rounded-lg bg-[#e4ebf5] text-[#a91e29]">${icon(ic, 17)}</span></div><div class="brand-display mt-5 text-2xl font-semibold">${v}</div><div class="mt-1 text-[11px] text-[#7d8da4]">${det}</div></div>`).join('');
  const top = Math.max(1, ...D.weeklyRevenue.map(p => p.revenue));
  const bars = D.weeklyRevenue.map((p, i) => `<div class="flex h-full flex-1 flex-col items-center justify-end gap-2"><div class="text-[9px] text-[#6e809a]">${p.revenue ? money(p.revenue).replace(/R\$\s/, '') : ''}</div><div class="w-full max-w-12 rounded-t-md ${i === D.weeklyRevenue.length - 1 ? 'gold-rule' : 'bg-[#cad2de]'}" style="height:${Math.max(5, p.revenue / top * 100)}%"></div><span class="text-[10px] text-[#6e809a]">${p.label}</span></div>`).join('');
  const topS = D.topServices.map((s, i) => `<div class="flex items-center gap-3 px-5 py-4"><span class="grid h-8 w-8 place-items-center rounded-lg bg-[#e4ebf5] text-xs font-bold text-[#921a24]">0${i + 1}</span><div class="min-w-0 flex-1"><div class="truncate text-xs font-semibold">${s.name}</div><div class="mt-1 text-[10px] text-[#6e809a]">${s.bookings} atendimentos</div></div><div class="text-xs font-semibold">${money(s.revenue)}</div></div>`).join('');
  const upcoming = D.today.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').slice(0, 5).map(appointmentLine).join('');
  return shell('/dashboard', 'Visão geral', `<div class="space-y-7">
    <div class="flex flex-wrap items-end justify-between gap-4"><div><div class="text-[10px] font-bold uppercase tracking-[.2em] text-[#a21d28]">${D.TODAY.weekday} • seu resumo</div><h1 class="brand-display mt-2 text-3xl font-semibold">Boa tarde. Vamos ao trabalho.</h1><p class="mt-2 text-sm text-[#5e6e85]">Aqui está o pulso da sua barbearia hoje.</p></div><a class="btn-primary inline-flex items-center gap-2">${icon('plus', 16)}Novo agendamento</a></div>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">${cards}</div>
    <div class="grid gap-5 xl:grid-cols-[1.35fr_.8fr]"><div class="surface p-5 sm:p-6" data-crop="chart"><div class="flex items-center justify-between"><div><div class="text-xs text-[#5e6e85]">Movimento da semana</div><div class="brand-display mt-1 text-lg font-semibold">Receita por dia</div></div><span class="rounded-lg bg-[#e5ebf5] px-3 py-2 text-[10px] font-semibold text-[#8f1923]">7 dias</span></div><div class="mt-7 flex h-[190px] items-end gap-3 border-b border-[#d6e0ef] pb-1">${bars}</div></div>
      <div class="surface overflow-hidden" data-crop="top"><div class="flex items-center justify-between border-b border-[#dee6f2] p-5"><div><div class="text-xs text-[#5e6e85]">Mais procurados</div><div class="brand-display mt-1 text-lg font-semibold">Serviços em alta</div></div>${icon('bar-chart-3', 18, 'text-[#a01c27]')}</div><div class="divide-y divide-[#e4ebf5]">${topS}</div></div></div>
    <div class="surface overflow-hidden"><div class="flex items-center justify-between border-b border-[#dee6f2] p-5"><div><div class="text-xs text-[#5e6e85]">O que vem a seguir</div><div class="brand-display mt-1 text-lg font-semibold">Próximos atendimentos</div></div><a class="text-xs font-semibold text-[#941a24]">Ver agenda ${icon('arrow-right', 13, 'ml-1 inline')}</a></div><div class="divide-y divide-[#e4ebf5]">${upcoming}</div></div>
  </div>`);
}

function resourcePage({ current, label, title, eyebrow, description, createLabel, singular, toolbar = '', count, search, headers, rows, actions }) {
  const th = headers.map(h => `<th class="px-5 py-3 font-semibold">${h}</th>`).join('') + (actions ? '<th class="px-5 py-3 text-right font-semibold">Ações</th>' : '');
  const tr = rows.map(cells => `<tr class="border-t border-[#e4ebf5]">${cells.map(c => `<td class="px-5 py-4 text-sm">${c}</td>`).join('')}${actions ? '<td class="px-5 py-3 text-right"><div class="flex justify-end gap-2"><button class="btn-secondary px-3 py-1.5 text-xs">Editar</button><button class="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#a74e41]">Excluir</button></div></td>' : ''}</tr>`).join('');
  return shell(current, label, `<section class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4"><div><div class="text-[10px] font-bold uppercase tracking-[.2em] text-[#a21d28]">${eyebrow}</div><h1 class="brand-display mt-2 text-3xl font-semibold">${title}</h1><p class="mt-2 text-sm text-[#5e6e85]">${description}</p></div><button class="btn-primary inline-flex items-center gap-2" data-crop="create">${icon('plus', 16)}${createLabel}</button></div>
    ${toolbar}
    <div class="surface overflow-hidden"><div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#dee6f2] px-5 py-4"><div class="text-xs text-[#5e6e85]">${count} ${count === 1 ? singular : singular + 's'}</div>${search ? `<label class="relative">${icon('search', 15, 'absolute left-3 top-1/2 -translate-y-1/2 text-[#6a7c97]')}<input class="field w-56 py-2 pl-9 text-xs" placeholder="Buscar..."></label>` : ''}</div>
    <div class="overflow-x-auto"><table class="w-full min-w-[650px] text-left" data-crop="table"><thead><tr class="bg-[#f5f7fb] text-[10px] uppercase tracking-[.12em] text-[#6d7e98]">${th}</tr></thead><tbody>${tr}</tbody></table></div></div>
  </section>`);
}

const span = v => `<span class="text-[#1f3659]">${v}</span>`;
const wa = `<a class="inline-flex items-center gap-1 text-[10px] font-semibold text-[#901923]">${icon('message-circle', 13)}Falar no WhatsApp</a>`;

function agenda() {
  const opts = s => Object.entries(statusText).map(([v, l]) => `<option value="${v}" ${v === s ? 'selected' : ''}>${l}</option>`).join('');
  return resourcePage({
    current: '/agenda', label: 'Agenda', title: 'Agenda', eyebrow: 'Operação diária', description: 'Acompanhe horários, cadeira e status de cada atendimento.',
    createLabel: 'Novo agendamento', singular: 'agendamento', search: true, actions: true, count: D.today.length,
    toolbar: `<div class="flex items-center gap-3" data-crop="toolbar"><label class="text-xs font-semibold text-[#505e73]">Data</label><div class="field flex max-w-48 items-center justify-between py-2 text-sm">07/11/2026 ${icon('calendar-days', 15, 'text-[#3b4a63]')}</div><span class="text-xs text-[#5e6e85]">${D.today.length} horários</span></div>`,
    headers: ['Horário', 'Cliente', 'WhatsApp', 'Profissional', 'Serviço', 'Valor', 'Status'],
    rows: D.today.map(a => [span(a.startTime), span(`${a.clientName} · ${a.clientPhone}`), wa, span(a.barberName), span(a.serviceName), `<b>${money(a.price)}</b>`, `<select class="field w-32 py-1.5 text-xs">${opts(a.status)}</select>`]),
  });
}

function marketing() {
  return resourcePage({
    current: '/marketing', label: 'Marketing', title: 'Marketing', eyebrow: 'Um motivo para voltar', description: 'Cupons simples para movimentar a agenda.',
    createLabel: 'Nova campanha', singular: 'campanha', count: D.campaigns.length,
    headers: ['Campanha', 'Desconto', 'Utilizações', 'Período', 'Status', 'WhatsApp'],
    rows: D.campaigns.map(c => [
      `<div class="font-semibold">${c.name}<div class="mt-1 font-mono text-[10px] font-medium tracking-wider text-[#8e1923]">${c.code}</div></div>`,
      `<b>${c.discountPct}%</b>`, span(c.redemptionCount),
      `<span class="text-xs">${datePt(c.startsAt)} — ${datePt(c.endsAt)}</span>`,
      `<span class="rounded-full px-3 py-1 text-[10px] font-semibold ${c.active ? 'bg-[#e9f1e9] text-[#4e7950]' : 'bg-[#f3e8e4] text-[#99513f]'}">${c.active ? 'Ativa' : 'Encerrada'}</span>`, wa,
    ]),
  });
}

const page = body => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="screens.css"></head><body>${body}</body></html>`;
const pages = { dashboard: dashboard(), agenda: agenda(), marketing: marketing() };
for (const [n, b] of Object.entries(pages)) fs.writeFileSync(path.join(sdir, `${n}.html`), page(b));

// CSS: Tailwind v4 + as classes próprias do app (copiadas de artifacts/barberflow/src/index.css)
const appCss = fs.readFileSync(path.resolve(root, '../../artifacts/barberflow/src/index.css'), 'utf8');
const custom = appCss.slice(appCss.indexOf(':root { color-scheme'));
const input = `@import "${path.join(twDir, 'node_modules/tailwindcss/index.css')}" source(none);
@source "./*.html";
@font-face { font-family: 'Space Grotesk'; font-weight: 500; src: url(../fonts/SpaceGrotesk-500.woff); }
@font-face { font-family: 'Space Grotesk'; font-weight: 600; src: url(../fonts/SpaceGrotesk-600.woff); }
@font-face { font-family: 'Space Grotesk'; font-weight: 700; src: url(../fonts/SpaceGrotesk-700.woff); }
@font-face { font-family: 'DM Sans'; font-weight: 400; src: url(../fonts/DMSans-400.woff); }
@font-face { font-family: 'DM Sans'; font-weight: 500; src: url(../fonts/DMSans-500.woff); }
@font-face { font-family: 'DM Sans'; font-weight: 700; src: url(../fonts/DMSans-700.woff); }
@font-face { font-family: 'DM Sans'; font-weight: 600; src: url(../fonts/DMSans-700.woff); }
body { font-family: 'DM Sans', sans-serif; background: #eef2f9; color: #1f1f1f; -webkit-font-smoothing: antialiased; }
${custom}`;
fs.writeFileSync(path.join(sdir, 'input.css'), input);
execFileSync(path.join(twDir, 'node_modules/.bin/tailwindcss'), ['-i', path.join(sdir, 'input.css'), '-o', path.join(sdir, 'screens.css')], { stdio: 'inherit', cwd: sdir });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const boxes = {};
  for (const n of Object.keys(pages)) {
    await page.goto('file://' + path.join(sdir, `${n}.html`));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(root, 'assets', `demo-${n}.png`) });
    boxes[n] = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-crop]')].map(el => { const r = el.getBoundingClientRect(); return [el.dataset.crop, [r.x, r.y, r.width, r.height].map(v => Math.round(v * 10) / 10)]; })));
  }
  fs.writeFileSync(path.join(sdir, 'crops.json'), JSON.stringify({ viewport: [1600, 900], scale: 2, boxes, dashboard: require(path.join(sdir, 'demo-data.cjs')).dashboard }, null, 1));
  await browser.close();
  console.log('ok', JSON.stringify(boxes));
})();
