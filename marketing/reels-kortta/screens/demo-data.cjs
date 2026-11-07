// Dados 100% fictícios da "Barbearia Dom Corte", usados nas telas do vídeo.
// Coerência garantida pelas checagens no fim do arquivo:
//  - receita do mês = soma das barras da semana (1 a 7 de novembro) = soma dos atendimentos concluídos do mês
//  - agendamentos de hoje (não cancelados) = 12
//  - "Serviços em alta" = ranking dos atendimentos concluídos no mês

const TODAY = { iso: '2026-11-07', weekday: 'sábado', long: 'sábado, 7 de novembro', input: '2026-11-07' };

const salon = { name: 'Barbearia Dom Corte', initials: 'BD', plan: 'Gratuito', whatsapp: '(11) 4002-1150' };

const barbers = ['Rafael Mendes', 'Caio Nunes', 'Lucas Ferreira', 'Bruno Almeida'];

const services = [
  { name: 'Corte clássico', price: 45, duration: 40 },
  { name: 'Degradê', price: 50, duration: 45 },
  { name: 'Corte + barba', price: 80, duration: 70 },
  { name: 'Barba completa', price: 35, duration: 30 },
  { name: 'Acabamento', price: 20, duration: 20 },
  { name: 'Sobrancelha', price: 15, duration: 15 },
  { name: 'Pigmentação', price: 30, duration: 30 },
  { name: 'Corte infantil', price: 40, duration: 30 },
  { name: 'Hidratação capilar', price: 45, duration: 30 },
  { name: 'Combo premium', price: 100, duration: 90 },
];
const price = name => services.find(s => s.name === name).price;

// Agenda de hoje (sábado, 07/11/2026). Status existentes no sistema: scheduled, confirmed, completed, cancelled, no_show.
const today = [
  ['09:00', 'Gabriel Martins', '(11) 98412-3307', 'Rafael Mendes', 'Degradê', 'completed'],
  ['09:00', 'Felipe Costa', '(11) 97735-1182', 'Caio Nunes', 'Corte + barba', 'completed'],
  ['09:30', 'Matheus Oliveira', '(11) 99248-6610', 'Lucas Ferreira', 'Barba completa', 'completed'],
  ['10:00', 'André Ribeiro', '(11) 98871-0459', 'Bruno Almeida', 'Combo premium', 'completed'],
  ['10:00', 'Pedro Henrique', '(11) 96650-2274', 'Rafael Mendes', 'Corte clássico', 'completed'],
  ['10:30', 'Vinícius Rocha', '(11) 99103-8845', 'Caio Nunes', 'Corte + barba', 'completed'],
  ['11:00', 'Thiago Moreira', '(11) 97324-5518', 'Lucas Ferreira', 'Degradê', 'completed'],
  ['13:30', 'Leonardo Santos', '(11) 98157-9032', 'Rafael Mendes', 'Corte + barba', 'confirmed'],
  ['14:00', 'Eduardo Lima', '(11) 99586-4471', 'Caio Nunes', 'Degradê', 'confirmed'],
  ['14:30', 'Diego Carvalho', '(11) 97012-6638', 'Lucas Ferreira', 'Corte infantil', 'confirmed'],
  ['15:00', 'Rodrigo Teixeira', '(11) 98243-1795', 'Bruno Almeida', 'Pigmentação', 'scheduled'],
  ['15:30', 'Henrique Barros', '(11) 96938-2056', 'Rafael Mendes', 'Corte clássico', 'scheduled'],
  ['16:00', 'Marcelo Pires', '(11) 99364-7720', 'Caio Nunes', 'Hidratação capilar', 'cancelled'],
].map(([startTime, clientName, clientPhone, barberName, serviceName, status]) => ({
  startTime, clientName, clientPhone, barberName, serviceName, status, price: price(serviceName),
}));

// Receita por dia (dom 01/11 → sáb 07/11). Sábado = só o que já foi concluído hoje.
const todayRevenue = today.filter(a => a.status === 'completed').reduce((s, a) => s + a.price, 0);
const weeklyRevenue = [
  { label: 'dom', revenue: 620 },
  { label: 'seg', revenue: 1240 },
  { label: 'ter', revenue: 1385 },
  { label: 'qua', revenue: 1460 },
  { label: 'qui', revenue: 1535 },
  { label: 'sex', revenue: 1770 },
  { label: 'sáb', revenue: todayRevenue },
];

// Atendimentos concluídos no mês, por serviço
const monthCompleted = {
  'Degradê': 41, 'Corte + barba': 38, 'Corte clássico': 27, 'Barba completa': 18, 'Acabamento': 12,
  'Sobrancelha': 10, 'Combo premium': 7, 'Pigmentação': 6, 'Corte infantil': 5, 'Hidratação capilar': 1,
};
const topServices = Object.entries(monthCompleted)
  .map(([name, bookings]) => ({ name, bookings, revenue: bookings * price(name) }))
  .sort((a, b) => b.bookings - a.bookings)
  .slice(0, 4);

const monthlyRevenue = weeklyRevenue.reduce((s, d) => s + d.revenue, 0);
const dashboard = {
  todayAppointments: today.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length,
  monthlyRevenue,
  clientCount: 186,
  serviceCount: services.length,
};

const campaigns = [
  { name: 'Semana do Degradê', code: 'DEGRADE15', discountPct: 15, redemptionCount: 22, startsAt: '2026-11-02', endsAt: '2026-11-08', active: true },
  { name: 'Combo Corte + Barba', code: 'COMBO10', discountPct: 10, redemptionCount: 37, startsAt: '2026-11-01', endsAt: '2026-11-30', active: true },
  { name: 'Cliente que indica amigo', code: 'INDICA20', discountPct: 20, redemptionCount: 0, startsAt: '2026-11-16', endsAt: '2026-12-31', active: true },
  { name: 'Promoção de retorno', code: 'VOLTA10', discountPct: 10, redemptionCount: 41, startsAt: '2026-09-01', endsAt: '2026-10-31', active: false },
];

// ---- checagens de coerência ----
const assert = (c, m) => { if (!c) throw new Error('Dados incoerentes: ' + m); };
const monthFromServices = Object.entries(monthCompleted).reduce((s, [n, q]) => s + q * price(n), 0);
assert(monthlyRevenue === 8450, `receita do mês ${monthlyRevenue}`);
assert(monthFromServices === monthlyRevenue, `serviços ${monthFromServices} ≠ receita ${monthlyRevenue}`);
assert(dashboard.todayAppointments === 12, `hoje ${dashboard.todayAppointments}`);
for (const a of today.filter(x => x.status === 'completed')) assert(monthCompleted[a.serviceName] > 0, a.serviceName);

module.exports = { TODAY, salon, barbers, services, today, weeklyRevenue, topServices, dashboard, campaigns };
