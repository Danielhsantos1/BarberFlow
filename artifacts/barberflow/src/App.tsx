import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check,
  ChevronDown, CircleDollarSign, Copy, ExternalLink, Gift, LayoutDashboard, LogOut, MessageCircle,
  Menu, Package, Plus, Scissors, Search, Settings, ShoppingBag, Sparkles, Users, X,
} from 'lucide-react';
import {
  getGetCurrentSalonQueryKey, getGetDashboardQueryKey, getGetFinanceSummaryQueryKey,
  getListAppointmentsQueryKey, getListBarbersQueryKey,
  getListCampaignsQueryKey, getListClientsQueryKey, getListInventoryQueryKey,
  getListServicesQueryKey, useCheckBookingAvailability, useCreateAppointment,
  useCreateBarber, useCreateCampaign, useCreateClient, useCreateInventoryItem,
  useCreatePublicBooking, useCreateSalon, useCreateService, useCreateTransaction,
  useDeleteAppointment, useDeleteBarber, useDeleteClient, useDeleteInventoryItem,
  useDeleteService, useGetCurrentSalon, useGetDashboard, useGetFinanceSummary,
  useGetPublicSalon, useHealthCheck, useListAppointments, useListBarbers,
  useListCampaigns, useListClients, useListInventory, useListServices,
  useUpdateAppointment, useUpdateBarber, useUpdateClient, useUpdateCurrentSalon,
  useUpdateInventoryItem, useUpdateService,
  type SalonInput, type Transaction,
} from '@workspace/api-client-react';
import type { Appointment } from '@workspace/api-client-react';
import './index.css';
import { PrivacyPage, TermsPage } from './pages/legal';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
if (!clerkPubKey) throw new Error('VITE_CLERK_PUBLISHABLE_KEY não definida no .env (veja .env.example)');

function whatsappHref(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const internationalNumber = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${internationalNumber}?text=${encodeURIComponent(message)}`;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#e63946', colorForeground: '#e5ebf5', colorMutedForeground: '#94a1b5',
    colorDanger: '#d34f4f', colorBackground: '#15243b', colorInput: '#1b2e4c',
    colorInputForeground: '#e5ebf5', colorNeutral: '#e5ebf5', fontFamily: 'DM Sans',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#15243b] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#20375a]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#e5ebf5] font-semibold', headerSubtitle: 'text-[#94a1b5]',
    socialButtonsBlockButtonText: 'text-[#dce5f2]', formFieldLabel: 'text-[#d3deee]',
    footerActionLink: 'text-[#ea414f]', footerActionText: 'text-[#94a1b5]',
    dividerText: 'text-[#94a1b5]', identityPreviewEditButton: 'text-[#ea414f]',
    formFieldSuccessText: 'text-[#82b89a]', alertText: 'text-[#e5ebf5]',
    logoBox: 'mb-3', logoImage: 'h-10', socialButtonsBlockButton: 'border-[#27446f] bg-[#192b46]',
    formButtonPrimary: 'bg-[#e63946] text-[#0e1928] hover:bg-[#eb4b58]',
    formFieldInput: 'bg-[#1b2e4c] text-[#ffffff] border-[#27446f]',
    footerAction: 'border-t border-[#20375a]', dividerLine: 'bg-[#26426c]',
    alert: 'bg-[#1b2e4c] border-[#294774]', otpCodeFieldInput: 'bg-[#1b2e4c] text-white',
    formFieldRow: 'mb-4', main: 'gap-4',
  },
};

const navItems = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/equipe', label: 'Equipe', icon: Scissors },
  { href: '/servicos', label: 'Serviços', icon: ShoppingBag },
  { href: '/financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/marketing', label: 'Marketing', icon: Gift },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];
const routeNames: Record<string, string> = Object.fromEntries(navItems.map(item => [item.href, item.label]));
const money = (value?: number) => (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const datePt = (date?: string) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'BF';
const errorText = (error: unknown): string => {
  const fallback = 'Não foi possível concluir. Tente novamente.';
  const status = (error as { status?: number } | null)?.status;
  const apiMessage = (error as { data?: { error?: unknown } } | null)?.data?.error;
  if (status === 400) return 'Confira os dados preenchidos e tente novamente.';
  if (status && status < 500 && typeof apiMessage === 'string') return apiMessage;
  return fallback;
};
const isNotFound = (error: unknown) => (error as { status?: number } | null)?.status === 404;

// Dia da semana e saudação no horário de Brasília (não no fuso do servidor/navegador).
const nowInBrazil = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const todayWeekday = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
const greeting = () => { const h = nowInBrazil().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

// Marca Kortta: "poste de barbeiro" listrado (vermelho, branco, azul).
const POLE_STRIPES = 'repeating-linear-gradient(135deg, #e63946 0 6px, #ffffff 6px 12px, #1d4ed8 12px 18px, #ffffff 18px 24px)';

function Brand({ small = false }: { small?: boolean }) {
  return <div className="flex items-center gap-3">
    <div aria-hidden className={`${small ? 'h-8 w-8' : 'h-10 w-10'} rounded-xl ring-1 ring-black/10 shadow-[inset_0_0_0_2px_rgba(255,255,255,.85)]`} style={{ background: POLE_STRIPES }} />
    <div><div className={`brand-display font-bold ${small ? 'text-base' : 'text-xl'} leading-none`}>kortta</div>{!small && <div className="mt-1 text-[9px] uppercase tracking-[.24em] text-[#94a1b5]">gestão de barbearias</div>}</div>
  </div>;
}

function Loading({ label = 'Carregando seu espaço' }: { label?: string }) {
  return <div className="grid min-h-[48vh] place-items-center"><div className="w-full max-w-md space-y-4 px-8">
    <div className="h-3 w-32 animate-pulse rounded bg-[#cedaed]" /><div className="h-10 w-64 animate-pulse rounded bg-[#cedaed]" />
    <div className="grid grid-cols-3 gap-3"><div className="h-24 animate-pulse rounded-xl bg-[#d8e2f0]" /><div className="h-24 animate-pulse rounded-xl bg-[#d8e2f0]" /><div className="h-24 animate-pulse rounded-xl bg-[#d8e2f0]" /></div>
    <p className="text-sm text-[#5e6e85]">{label}</p>
  </div></div>;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="surface mx-auto mt-10 max-w-lg p-8 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#f8e8e4] text-[#ab5140]"><Activity size={21} /></div><h3 className="brand-display text-xl font-semibold">Algo não carregou</h3><p className="mt-2 text-sm text-[#5e6e85]">{message}</p><button className="btn-secondary mt-5" onClick={retry} data-testid="button-retry">Tentar novamente</button></div>;
}

function AuthButtons() {
  return <div className="flex items-center gap-3"><Link href="/sign-in" className="px-4 py-2 text-sm font-semibold text-[#dce5f2] hover:text-[#ea414f]">Entrar</Link><Link href="/sign-up" className="btn-primary text-sm">Começar agora <ArrowRight size={15} className="ml-1 inline" /></Link></div>;
}

function Landing() {
  const health = useHealthCheck();
  return <main className="min-h-[100dvh] bg-[#0e1a2b] text-[#e5ebf5]">
    <header className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-6"><Brand /><nav className="hidden items-center gap-8 text-xs text-[#94a1b5] md:flex"><a href="#plataforma" className="hover:text-white">Plataforma</a><a href="#planos" className="hover:text-white">Planos</a><a href="#booking" className="hover:text-white">Agendamento online</a></nav><AuthButtons /></header>
    <section className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-6 pb-24 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:pb-32 lg:pt-20">
      <div className="animate-in relative z-10"><div className="mb-7 flex items-center gap-3 text-[10px] uppercase tracking-[.25em] text-[#e63946]"><span className="h-px w-8 bg-[#e63946]" />A rotina da barbearia, no controle</div>
        <h1 className="brand-display max-w-3xl text-[clamp(3.5rem,8vw,7.4rem)] font-semibold leading-[.92]">Corte o caos.<br /><span className="text-[#e63946]">Encha a cadeira.</span></h1>
        <p className="mt-7 max-w-[490px] text-base leading-7 text-[#9da9bc]">Agenda, equipe e caixa em um só lugar. Mais presença na cadeira. Menos tempo atrás do balcão.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/sign-up" className="btn-primary px-6 py-3">Organize sua barbearia <ArrowRight className="ml-2 inline" size={16} /></Link><a href="#plataforma" className="text-sm text-[#b3bdcc] underline decoration-[#2b4a7a] underline-offset-4">Conheça a plataforma</a></div>
        <div className="mt-12 flex items-center gap-5 text-xs text-[#6b7d98]"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-[#bd6450]' : 'bg-[#81a58c]'}`} />{health.isError ? 'Plataforma em manutenção' : 'Pronto para sua próxima agenda'}</span><span className="h-4 w-px bg-[#223a60]" />Sem complicar o seu jeito de trabalhar</div>
      </div>
      <div className="animate-in relative mx-auto w-full max-w-[540px]" style={{ animationDelay: '100ms' }}>
        <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full border border-[#e6394630]" /><div className="absolute -bottom-9 -left-8 h-36 w-36 rounded-full border border-[#e6394625]" />
        <div className="relative rotate-[1.5deg] rounded-[22px] border border-[#20375a] bg-[#15243b] p-5 shadow-2xl shadow-black/40 sm:p-7">
          <div className="flex items-center justify-between border-b border-[#20375a] pb-5"><div><div className="text-[10px] uppercase tracking-[.2em] text-[#6e809b]">Terça-feira, 18 de junho</div><div className="brand-display mt-2 text-xl font-semibold">A casa está em ritmo.</div></div><div className="grid h-10 w-10 place-items-center rounded-full bg-[#e63946] text-[#0e1a2b]"><CalendarDays size={18} /></div></div>
          <div className="mt-5 flex items-center justify-between"><div><div className="text-xs text-[#7a8aa3]">Faturamento hoje</div><div className="brand-display mt-1 text-3xl font-semibold">R$ 1.840<span className="text-[#e63946]">,00</span></div></div><div className="flex items-center gap-1 rounded-full bg-[#26416b] px-2.5 py-1 text-[11px] text-[#a7d0ad]"><ArrowUpRight size={13} /> 12,4%</div></div>
          <div className="mt-6 space-y-2.5">{[['09:00', 'Rafael Mendes', 'Degradê + barba', 'Concluído'], ['10:30', 'Caio Nunes', 'Corte clássico', 'Na cadeira'], ['11:15', 'Lucas Ferreira', 'Corte + sobrancelha', 'A seguir']].map((row, i) => <div key={row[0]} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${i === 1 ? 'border-[#e6394655] bg-[#e6394611]' : 'border-[#1f3557] bg-[#172841]'} `}><div className="w-12 font-mono text-[11px] text-[#e63946]">{row[0]}</div><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1f3658] text-[11px] font-semibold text-[#f499a1]">{initials(row[1])}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{row[1]}</div><div className="mt-1 truncate text-[10px] text-[#72839d]">{row[2]}</div></div><span className="hidden rounded-full bg-[#1c3151] px-2 py-1 text-[9px] text-[#b2bccc] sm:block">{row[3]}</span></div>)}</div>
          <div className="mt-5 flex items-center justify-between border-t border-[#20375a] pt-4 text-[10px] text-[#6e809a]"><span>Agenda sincronizada</span><span className="flex items-center gap-1 text-[#b4c7a4]"><Check size={12} /> Tudo em dia</span></div>
        </div>
      </div>
    </section>
    <section id="plataforma" className="border-y border-[#1b2f4d] bg-[#122034]"><div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-14 md:grid-cols-[.7fr_1.3fr] md:items-center"><div className="brand-display text-3xl font-medium leading-tight">Feito para quem<br />vive a barbearia.</div><div className="grid gap-6 sm:grid-cols-3">{[['01', 'Agenda que funciona', 'Visualize a semana, confirme horários e acompanhe cada cadeira.'], ['02', 'Clientes que voltam', 'Histórico e pontos de fidelidade para cuidar de cada visita.'], ['03', 'Caixa sem surpresa', 'Receitas, despesas e estoque organizados num relance.']].map(item => <div key={item[0]} className="border-l border-[#e6394660] pl-4"><div className="text-[10px] font-mono text-[#e63946]">{item[0]}</div><h3 className="mt-3 text-sm font-semibold">{item[1]}</h3><p className="mt-2 text-xs leading-5 text-[#76869f]">{item[2]}</p></div>)}</div></div></section>
    <section id="booking" className="mx-auto grid max-w-[1240px] gap-12 px-6 py-20 md:grid-cols-2 md:items-center"><div className="order-2 border border-[#20385b] bg-[#15243b] p-6 md:order-1"><div className="flex items-center justify-between"><div><div className="text-[9px] uppercase tracking-[.2em] text-[#8393ac]">Sua página de agendamento</div><div className="brand-display mt-2 text-xl">Barbearia Central</div></div><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e63946] text-[#0e1a2b]"><Scissors /></div></div><div className="mt-7 grid grid-cols-7 gap-1.5">{['S','T','Q','Q','S','S','D'].map((day,i)=><span key={`${day}-${i}`} className="py-2 text-center text-[10px] text-[#6f819b]">{day}</span>)}{Array.from({length:14},(_,i)=><span key={i} className={`grid aspect-square place-items-center rounded-lg text-[11px] ${i===9?'bg-[#e63946] font-bold text-[#ffffff]':'bg-[#1b2e4c] text-[#9fabbc]'}`}>{i+10}</span>)}</div><div className="mt-5 flex items-center justify-between border-t border-[#20385b] pt-4 text-xs"><span className="text-[#8292a9]">Quarta, 19 de junho</span><span className="text-[#e63946]">4 horários livres</span></div></div>
      <div className="order-1 md:order-2"><div className="mb-4 text-[10px] uppercase tracking-[.23em] text-[#e63946]">Seu negócio, no bolso do cliente</div><h2 className="brand-display text-4xl font-semibold leading-tight sm:text-5xl">Uma agenda aberta,<br />mesmo com a porta fechada.</h2><p className="mt-5 max-w-lg text-sm leading-7 text-[#8d9bb0]">Compartilhe um link e deixe cada cliente escolher serviço, profissional e horário. Os pedidos entram direto no seu fluxo de trabalho.</p><Link href="/sign-up" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#ea4653]">Criar minha página <ArrowRight size={15} /></Link></div></section>
    <section id="planos" className="bg-[#dce5f2] px-6 py-20 text-[#111e31]"><div className="mx-auto max-w-[1240px]"><div className="mb-10 flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[.22em] text-[#9a1b26]">Planos sem surpresa</div><h2 className="brand-display mt-3 text-4xl font-semibold">Comece no seu ritmo.</h2></div><p className="max-w-sm text-sm leading-6 text-[#5a6a81]"><b className="text-[#111e31]">Fase de lançamento:</b> todos os recursos estão liberados gratuitamente. Os planos pagos chegam em breve, com aviso prévio.</p></div><div className="grid gap-4 lg:grid-cols-3">{[{name:'Essencial',price:'Grátis',detail:'Para colocar a rotina em ordem.',items:['Agenda e cadastro de clientes','Serviços e equipe','Agendamento online']},{name:'Pro',price:'Em breve',detail:'Para uma barbearia em movimento.',items:['Tudo do Essencial','Financeiro e estoque','Campanhas de fidelidade'],highlight:true},{name:'Business',price:'Em breve',detail:'Para crescer com mais controle.',items:['Tudo do Pro','Mais estrutura para a equipe','Prioridade no suporte']}].map(plan=><div key={plan.name} className={`flex min-h-[280px] flex-col p-7 ${plan.highlight?'bg-[#111e31] text-[#e5ebf5]':'border border-[#c6ceda] bg-[#eff3f9]'}`}><div className="flex items-center justify-between"><h3 className="brand-display text-xl font-semibold">{plan.name}</h3>{plan.highlight&&<span className="bg-[#e63946] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#111e31]">Mais escolhido</span>}</div><p className="mt-2 text-xs text-[#6f819b]">{plan.detail}</p><div className="mt-6 brand-display text-4xl font-semibold">{plan.price}<span className="ml-1 text-xs font-normal text-[#7a8aa3]"></span></div><ul className="mt-6 flex-1 space-y-2">{plan.items.map(feature=><li key={feature} className="flex items-center gap-2 text-xs"><Check size={13} className="text-[#b6202d]" />{feature}</li>)}</ul><Link href="/sign-up" className={`mt-7 block text-center text-xs font-bold ${plan.highlight?'btn-primary':'btn-secondary'}`}>{plan.price==='Grátis'?'Começar grátis':'Usar grátis no lançamento'}</Link></div>)}</div></div></section>
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1f3557] px-6 py-8 text-xs text-[#64758f]"><Brand small /><span>Operação afiada. Atendimento com presença.</span><span className="flex items-center gap-4"><Link href="/termos" className="hover:text-white">Termos de Uso</Link><Link href="/privacidade" className="hover:text-white">Privacidade</Link><span>© Kortta {new Date().getFullYear()}</span></span></footer>
  </main>;
}

type FieldDef = { name: string; label: string; type?: string; required?: boolean; placeholder?: string; options?: Array<{ value: string; label: string }> };
type ResourceProps = {
  title: string; eyebrow: string; description: string; fields: FieldDef[];
  rows: Array<Record<string, any>>; columns: Array<{ key: string; label: string; render?: (row: Record<string, any>) => ReactNode }>;
  create: (payload: Record<string, any>) => void; update?: (id: string, payload: Record<string, any>) => void;
  remove?: (id: string) => void; loading?: boolean; error?: unknown; retry?: () => void; singular?: string;
  toolbar?: ReactNode; search?: boolean; createLabel?: string;
};

function ResourcePage({ title, eyebrow, description, fields, rows, columns, create, update, remove, loading, error, retry = () => {}, singular = 'item', toolbar, search, createLabel }: ResourceProps) {
  const [modal, setModal] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const openCreate = () => { setEditRow(null); setForm({}); setModal(true); };
  const openEdit = (row: Record<string, any>) => { setEditRow(row); setForm(Object.fromEntries(fields.map(field => [field.name, row[field.name] == null ? '' : String(row[field.name])] ))); setModal(true); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = Object.fromEntries(fields.map(field => {
      const raw = form[field.name] ?? '';
      return [field.name, field.type === 'number' ? Number(raw) : raw || (field.required ? '' : null)];
    }));
    if (editRow && update) update(String(editRow.id), payload); else create(payload);
    setModal(false);
  };
  const filtered = rows.filter(row => !query || columns.map(col => String(row[col.key] ?? '')).join(' ').toLowerCase().includes(query.toLowerCase()));
  return <section className="animate-in space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a21d28]">{eyebrow}</div><h1 className="brand-display mt-2 text-3xl font-semibold">{title}</h1><p className="mt-2 text-sm text-[#5e6e85]">{description}</p></div><button className="btn-primary inline-flex items-center gap-2" onClick={openCreate} data-testid={`button-add-${singular}`}><Plus size={16} />{createLabel || `Adicionar ${singular}`}</button></div>
    {toolbar}
    {error ? <ErrorState message={errorText(error)} retry={retry} /> : loading ? <Loading label={`Carregando ${title.toLowerCase()}`} /> : <div className="surface overflow-hidden">
      {(search || rows.length > 0) && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dee6f2] px-5 py-4"><div className="text-xs text-[#5e6e85]">{filtered.length} {filtered.length === 1 ? singular : `${singular}s`}</div>{search&&<label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a7c97]" /><input className="field w-56 py-2 pl-9 text-xs" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar..." data-testid="input-search" /></label>}</div>}
      {rows.length === 0 ? <div className="grid min-h-[260px] place-items-center px-6 py-12 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e4ebf5] text-[#a71d29]"><Sparkles size={22} /></div><h3 className="brand-display mt-4 text-lg font-semibold">Comece por aqui</h3><p className="mt-1 max-w-sm text-sm text-[#5e6e85]">Cadastre seu primeiro {singular} para deixar a operação pronta.</p><button onClick={openCreate} className="btn-secondary mt-5">Adicionar {singular}</button></div></div> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="bg-[#f5f7fb] text-[10px] uppercase tracking-[.12em] text-[#6d7e98]">{columns.map(col=><th key={col.key} className="px-5 py-3 font-semibold">{col.label}</th>)}{(update||remove)&&<th className="px-5 py-3 text-right font-semibold">Ações</th>}</tr></thead><tbody>{filtered.map((row,index)=><tr key={row.id ?? index} className="border-t border-[#e4ebf5] hover:bg-[#f9fbfd]" data-testid={`row-${singular}-${row.id ?? index}`}>{columns.map(col=><td key={col.key} className="px-5 py-4 text-sm">{col.render?col.render(row):<span className="text-[#1f3659]">{row[col.key] ?? '—'}</span>}</td>)}{(update||remove)&&<td className="px-5 py-3 text-right"><div className="flex justify-end gap-2">{update&&<button className="btn-secondary px-3 py-1.5 text-xs" onClick={()=>openEdit(row)} data-testid={`button-edit-${row.id}`}>Editar</button>}{remove&&<button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#a74e41] hover:bg-[#faeeeb]" onClick={()=>setConfirmId(String(row.id))} data-testid={`button-delete-${row.id}`}>{confirmId===String(row.id)?'Confirmar?':'Excluir'}</button>}{confirmId===String(row.id)&&<button className="rounded-lg px-2 py-1 text-xs text-[#56657c]" onClick={()=>remove?.(String(row.id))} data-testid={`button-confirm-delete-${row.id}`}>Sim</button>}</div></td>}</tr>)}</tbody></table></div>}
    </div>}
    {modal&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0e1a2b99] p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="w-full max-w-lg rounded-2xl border border-[#cedaec] bg-[#f6f8fc] p-6 shadow-2xl" onSubmit={submit}><div className="flex items-start justify-between"><div><div className="text-[10px] uppercase tracking-[.18em] text-[#a21d28]">{editRow?'Atualizar registro':'Novo cadastro'}</div><h2 className="brand-display mt-1 text-2xl font-semibold">{editRow?`Editar ${singular}`:`Adicionar ${singular}`}</h2></div><button type="button" className="rounded-lg p-2 text-[#5e6e85] hover:bg-[#e1e9f4]" onClick={()=>setModal(false)} aria-label="Fechar"><X size={18}/></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{fields.map(field=><label key={field.name} className={field.type==='textarea'?'sm:col-span-2':''}><span className="mb-1.5 block text-xs font-semibold text-[#2d4e80]">{field.label}</span>{field.options?<select className="field" required={field.required} value={form[field.name]??''} onChange={e=>setForm({...form,[field.name]:e.target.value})} data-testid={`input-${field.name}`}><option value="">Selecione</option>{field.options.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select>:field.type==='textarea'?<textarea className="field min-h-20 resize-y" required={field.required} placeholder={field.placeholder} value={form[field.name]??''} onChange={e=>setForm({...form,[field.name]:e.target.value})} />:<input className="field" type={field.type||'text'} step={field.type==='number'?'any':undefined} required={field.required} placeholder={field.placeholder} value={form[field.name]??''} onChange={e=>setForm({...form,[field.name]:e.target.value})} data-testid={`input-${field.name}`} />}</label>)}</div><div className="mt-7 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={()=>setModal(false)}>Cancelar</button><button className="btn-primary" type="submit">{editRow?'Salvar alterações':'Salvar cadastro'}</button></div></form></div>}
  </section>;
}

function PageShell({ children, salon }: { children: ReactNode; salon: any }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  const current = routeNames[location] || 'Visão geral';
  const sidebar = <aside className="sidebar flex h-full flex-col px-4 py-5">
    <Link href="/dashboard" className="px-2 pb-7"><Brand /></Link>
    <div className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.2em] text-[#5f6f86]">Workspace</div>
    <nav className="space-y-1">{navItems.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} onClick={()=>setMobileOpen(false)} className={`nav-link ${location===item.href?'active':''}`}><Icon size={16}/><span>{item.label}</span>{item.href==='/agenda'&&<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e63946]"/>}</Link>})}</nav>
    <div className="mt-auto border-t border-[#ffffff1c] pt-4"><div className="mb-4 flex items-center gap-3 rounded-xl bg-[#ffffff0b] p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e63946] text-xs font-bold text-[#ffffff]">{initials(salon?.name)}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-[#dbe4f2]">{salon?.name || 'Minha barbearia'}</div><div className="mt-1 truncate text-[10px] text-[#7c8ca4]">Plano {planLabel(salon?.plan)}</div></div><ChevronDown size={14} className="text-[#5e6e85]"/></div><button className="nav-link w-full" onClick={()=>signOut({redirectUrl:basePath||'/'})}><LogOut size={16}/>Sair da conta</button></div>
  </aside>;
  return <div className="app-shell flex min-h-[100dvh]">
    <div className="hidden w-[248px] shrink-0 lg:block">{sidebar}</div>
    {mobileOpen&&<div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={()=>setMobileOpen(false)}><div className="h-full w-[275px]" onClick={e=>e.stopPropagation()}>{sidebar}</div></div>}
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#d9e2f0] bg-[#eef2f9ee] px-5 backdrop-blur-md sm:px-8"><div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-[#d9e3f1] lg:hidden" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu"><Menu size={19}/></button><div className="text-xs text-[#6b7d97]">Kortta <span className="mx-2 text-[#b0baca]">/</span><span className="font-semibold text-[#1d3353]">{current}</span></div></div><div className="flex items-center gap-3"><span className="hidden text-xs text-[#5e6e85] sm:block">{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span><div className="grid h-9 w-9 place-items-center rounded-full border border-[#cdd5e1] bg-[#d6e0f0] text-[11px] font-bold text-[#6d131b]">{initials(salon?.name)}</div></div></header><main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">{children}</main></div>
  </div>;
}

function PrivatePage({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const salonQuery = useGetCurrentSalon({ query: { enabled: !!isSignedIn, queryKey: getGetCurrentSalonQueryKey() } });
  if (!isLoaded) return <Loading label="Verificando sua conta" />;
  if (!isSignedIn) return <Redirect to="/" />;
  if (salonQuery.isLoading) return <Loading />;
  if (salonQuery.isError) return isNotFound(salonQuery.error)
    ? <Redirect to="/onboarding" />
    : <main className="grid min-h-[100dvh] place-items-center bg-[#eef2f9]"><ErrorState message="Não foi possível carregar sua barbearia." retry={() => void salonQuery.refetch()} /></main>;
  return <PageShell salon={salonQuery.data?.salon}>{children}</PageShell>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}
function SignInPage() { return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#0e1a2b] px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>; }
function SignUpPage() { return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#0e1a2b] px-4"><div className="flex flex-col items-center gap-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /><p className="max-w-[440px] text-center text-[11px] leading-5 text-[#7c8ca4]">Ao criar uma conta, você concorda com os <Link href="/termos" className="underline hover:text-white">Termos de Uso</Link> e a <Link href="/privacidade" className="underline hover:text-white">Política de Privacidade</Link>.</p></div></div>; }

function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  if (isError) return <ErrorState message="Não foi possível buscar os indicadores da barbearia." retry={()=>void refetch()} />;
  if (isLoading || !data) return <Loading label="Preparando a visão geral" />;
  const top = Math.max(1, ...data.weeklyRevenue.map(point=>point.revenue));
  return <div className="animate-in space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a21d28]">{todayWeekday()} • seu resumo</div><h1 className="brand-display mt-2 text-3xl font-semibold">{greeting()}. Vamos ao trabalho.</h1><p className="mt-2 text-sm text-[#5e6e85]">Aqui está o pulso da sua barbearia hoje.</p></div><Link className="btn-primary inline-flex items-center gap-2" href="/agenda"><Plus size={16}/>Novo agendamento</Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Agendamentos hoje',value:data.todayAppointments,detail:'na agenda',icon:CalendarDays},{label:'Receita do mês',value:money(data.monthlyRevenue),detail:'faturamento acumulado',icon:CircleDollarSign},{label:'Clientes ativos',value:data.clientCount,detail:'na sua base',icon:Users},{label:'Serviços',value:data.serviceCount,detail:'no catálogo',icon:Scissors}].map((card,index)=>{const Icon=card.icon;return <div key={card.label} className="surface p-5" style={{animationDelay:`${index*50}ms`}}><div className="flex items-center justify-between"><span className="text-xs text-[#5e6e85]">{card.label}</span><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e4ebf5] text-[#a91e29]"><Icon size={17}/></span></div><div className="brand-display mt-5 text-2xl font-semibold">{card.value}</div><div className="mt-1 text-[11px] text-[#7d8da4]">{card.detail}</div></div>})}</div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.8fr]"><div className="surface p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="text-xs text-[#5e6e85]">Movimento da semana</div><div className="brand-display mt-1 text-lg font-semibold">Receita por dia</div></div><span className="rounded-lg bg-[#e5ebf5] px-3 py-2 text-[10px] font-semibold text-[#8f1923]">7 dias</span></div><div className="mt-7 flex h-[190px] items-end gap-3 border-b border-[#d6e0ef] pb-1">{data.weeklyRevenue.map((point,index)=><div key={`${point.label}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="text-[9px] text-[#6e809a]">{point.revenue?money(point.revenue).replace('R$ ',''):''}</div><div className={`w-full max-w-12 rounded-t-md ${index===data.weeklyRevenue.length-1?'gold-rule':'bg-[#cad2de]'}`} style={{height:`${Math.max(5,point.revenue/top*100)}%`}}/><span className="text-[10px] text-[#6e809a]">{point.label}</span></div>)}</div></div>
      <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#dee6f2] p-5"><div><div className="text-xs text-[#5e6e85]">Mais procurados</div><div className="brand-display mt-1 text-lg font-semibold">Serviços em alta</div></div><BarChart3 size={18} className="text-[#a01c27]"/></div><div className="divide-y divide-[#e4ebf5]">{data.topServices.map((service,index)=><div key={`${service.name}-${index}`} className="flex items-center gap-3 px-5 py-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e4ebf5] text-xs font-bold text-[#921a24]">0{index+1}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{service.name}</div><div className="mt-1 text-[10px] text-[#6e809a]">{service.bookings} atendimentos</div></div><div className="text-xs font-semibold">{money(service.revenue)}</div></div>)}</div></div></div>
    <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#dee6f2] p-5"><div><div className="text-xs text-[#5e6e85]">O que vem a seguir</div><div className="brand-display mt-1 text-lg font-semibold">Próximos atendimentos</div></div><Link href="/agenda" className="text-xs font-semibold text-[#941a24]">Ver agenda <ArrowRight size={13} className="ml-1 inline"/></Link></div>{data.upcomingAppointments.length===0?<div className="p-8 text-center text-sm text-[#5e6e85]">A agenda ainda está livre.</div>:<div className="divide-y divide-[#e4ebf5]">{data.upcomingAppointments.slice(0,5).map(item=><AppointmentLine key={item.id} item={item}/>)}</div>}</div>
  </div>;
}

function AppointmentLine({ item, right }: { item: Appointment; right?: ReactNode }) {
  const statusText: Record<string,string> = {scheduled:'Agendado',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado',no_show:'Não compareceu'};
  return <div className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="w-12 font-mono text-xs font-semibold text-[#a11c27]">{item.startTime}</div><div className="grid h-9 w-9 place-items-center rounded-full bg-[#d9e2f0] text-[10px] font-bold text-[#4b5b74]">{initials(item.clientName)}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{item.clientName}</div><div className="mt-1 truncate text-[10px] text-[#6a7c97]">{item.serviceName} · {item.barberName}</div></div><span className="rounded-full bg-[#e5ebf5] px-2.5 py-1 text-[10px] font-semibold text-[#881821]">{statusText[item.status]||item.status}</span><div className="w-20 text-right text-xs font-semibold">{money(item.price)}</div>{right}</div>;
}

function AgendaPage() {
  const { data = [], isLoading, isError, refetch } = useListAppointments();
  const clients = useListClients(); const barbers = useListBarbers(); const services = useListServices();
  const qc = useQueryClient(); const create = useCreateAppointment(); const update = useUpdateAppointment(); const remove = useDeleteAppointment();
  const [day,setDay] = useState(new Date().toISOString().slice(0,10));
  const visible = data.filter(item=>item.date===day);
  const refresh = () => { void qc.invalidateQueries({queryKey:getListAppointmentsQueryKey()}); void qc.invalidateQueries({queryKey:getGetDashboardQueryKey()}); };
  return <ResourcePage title="Agenda" eyebrow="Operação diária" description="Acompanhe horários, cadeira e status de cada atendimento." singular="agendamento" createLabel="Novo agendamento" loading={isLoading} error={isError?new Error('Falha ao carregar agenda'):null} retry={()=>void refetch()} toolbar={<div className="flex items-center gap-3"><label className="text-xs font-semibold text-[#505e73]">Data</label><input className="field max-w-48 py-2 text-sm" type="date" value={day} onChange={e=>setDay(e.target.value)}/><span className="text-xs text-[#5e6e85]">{visible.length} horários</span></div>}
    fields={[{name:'date',label:'Data',type:'date',required:true},{name:'startTime',label:'Horário',type:'time',required:true},{name:'clientName',label:'Nome do cliente',required:true},{name:'clientPhone',label:'Telefone',required:true},{name:'barberId',label:'Profissional',required:true,options:(barbers.data||[]).filter(b=>b.active).map(b=>({value:b.id,label:b.name}))},{name:'serviceId',label:'Serviço',required:true,options:(services.data||[]).filter(s=>s.active).map(s=>({value:s.id,label:`${s.name} · ${money(s.price)}`}))},{name:'notes',label:'Observações',type:'textarea'}]}
    rows={visible.map(a=>({...a,client:`${a.clientName} · ${a.clientPhone||'sem telefone'}`}))}
     columns={[{key:'startTime',label:'Horário'},{key:'client',label:'Cliente'},{key:'whatsapp',label:'WhatsApp',render:r=>{const href=r.clientPhone?whatsappHref(r.clientPhone,`Olá, ${r.clientName}! Sobre seu horário de ${r.serviceName} em ${datePt(r.date)} às ${r.startTime}: ${r.status==='cancelled'?'o agendamento foi cancelado.':r.status==='confirmed'?'seu horário está confirmado.':'estamos entrando em contato sobre seu agendamento.'}`):null;return href?<a className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#901923] hover:underline" href={href} target="_blank" rel="noreferrer"><MessageCircle size={13}/>Falar no WhatsApp</a>:'—';}},{key:'barberName',label:'Profissional'},{key:'serviceName',label:'Serviço'},{key:'price',label:'Valor',render:r=><b>{money(r.price)}</b>},{key:'status',label:'Status',render:r=><select className="field w-32 py-1.5 text-xs" value={r.status} onChange={e=>{update.mutate({appointmentId:r.id,data:{status:e.target.value as any}},{onSuccess:refresh});}}>{['scheduled','confirmed','completed','cancelled','no_show'].map(status=><option value={status} key={status}>{status}</option>)}</select>} ]}
    create={payload=>create.mutate({data:{...payload,barberId:String(payload.barberId),serviceId:String(payload.serviceId)} as any},{onSuccess:refresh})}
    update={(id,payload)=>update.mutate({appointmentId:id,data:payload as any},{onSuccess:refresh})}
    remove={id=>remove.mutate({appointmentId:id},{onSuccess:refresh})} search />
}

function ClientsPage() {
  const {data=[],isLoading,isError,refetch}=useListClients(); const qc=useQueryClient(); const create=useCreateClient(); const update=useUpdateClient(); const remove=useDeleteClient();
  const refresh=()=>void qc.invalidateQueries({queryKey:getListClientsQueryKey()});
  return <ResourcePage title="Clientes" eyebrow="Relacionamento" description="Histórico, preferências e pontos para trazer cada cliente de volta." singular="cliente" search loading={isLoading} error={isError?new Error('Falha ao carregar clientes'):null} retry={()=>void refetch()}
    fields={[{name:'name',label:'Nome completo',required:true},{name:'phone',label:'Telefone',required:true},{name:'email',label:'E-mail',type:'email'},{name:'preferredStyle',label:'Estilo preferido'},{name:'notes',label:'Observações',type:'textarea'}]}
    rows={data as any} columns={[{key:'name',label:'Cliente',render:r=><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#d9e3f1] text-[10px] font-bold text-[#7e161f]">{initials(r.name)}</span><div><div className="text-xs font-semibold">{r.name}</div><div className="mt-1 text-[10px] text-[#6d7f99]">{r.phone}</div></div></div>},{key:'visits',label:'Visitas'},{key:'loyaltyPoints',label:'Pontos',render:r=><span className="rounded-full bg-[#e4ebf5] px-2.5 py-1 text-xs font-semibold text-[#901923]">{r.loyaltyPoints} pts</span>},{key:'lastVisit',label:'Última visita',render:r=>datePt(r.lastVisit)},{key:'preferredStyle',label:'Preferência'}]}
    create={payload=>create.mutate({data:payload as any},{onSuccess:refresh})} update={(id,payload)=>update.mutate({clientId:id,data:payload as any},{onSuccess:refresh})} remove={id=>remove.mutate({clientId:id},{onSuccess:refresh})} />
}

function TeamPage() {
  const {data=[],isLoading,isError,refetch}=useListBarbers(); const qc=useQueryClient(); const create=useCreateBarber(); const update=useUpdateBarber(); const remove=useDeleteBarber();
  const refresh=()=>void qc.invalidateQueries({queryKey:getListBarbersQueryKey()});
  return <ResourcePage title="Equipe" eyebrow="Quem faz acontecer" description="Profissionais, especialidades e comissões em um só lugar." singular="profissional" loading={isLoading} error={isError?new Error('Falha ao carregar equipe'):null} retry={()=>void refetch()}
    fields={[{name:'name',label:'Nome',required:true},{name:'phone',label:'Telefone'},{name:'specialties',label:'Especialidades',placeholder:'Degradê, barba, clássico'},{name:'commissionPct',label:'Comissão (%)',type:'number'}]}
    rows={data.map(b=>({...b,specialtyText:b.specialties?.join(', ')})) as any} columns={[{key:'name',label:'Profissional',render:r=><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#182a44] text-[10px] font-bold text-[#eb4755]">{initials(r.name)}</span><span className="font-semibold">{r.name}</span></div>},{key:'specialtyText',label:'Especialidades'},{key:'commissionPct',label:'Comissão',render:r=>`${r.commissionPct}%`},{key:'active',label:'Status',render:r=><button onClick={()=>update.mutate({barberId:r.id,data:{active:!r.active}},{onSuccess:refresh})} className={`rounded-full px-3 py-1 text-[10px] font-semibold ${r.active?'bg-[#e9f1e9] text-[#4e7950]':'bg-[#f3e8e4] text-[#99513f]'}`}>{r.active?'Ativo':'Inativo'}</button>} ]}
    create={payload=>create.mutate({data:{...payload,specialties:String(payload.specialties||'').split(',').map((x:string)=>x.trim()).filter(Boolean),commissionPct:Number(payload.commissionPct||0)} as any},{onSuccess:refresh})}
    update={(id,payload)=>update.mutate({barberId:id,data:{...payload,specialties:String(payload.specialties||'').split(',').map((x:string)=>x.trim()).filter(Boolean),commissionPct:Number(payload.commissionPct||0)} as any},{onSuccess:refresh})}
    remove={id=>remove.mutate({barberId:id},{onSuccess:refresh})} />
}

function ServicesPage() {
  const {data=[],isLoading,isError,refetch}=useListServices(); const qc=useQueryClient(); const create=useCreateService(); const update=useUpdateService(); const remove=useDeleteService();
  const refresh=()=>void qc.invalidateQueries({queryKey:getListServicesQueryKey()});
  return <ResourcePage title="Serviços" eyebrow="Catálogo" description="Seu menu de serviços, preços e duração." singular="serviço" loading={isLoading} error={isError?new Error('Falha ao carregar serviços'):null} retry={()=>void refetch()}
    fields={[{name:'name',label:'Nome do serviço',required:true},{name:'category',label:'Categoria',required:true},{name:'durationMinutes',label:'Duração (min)',type:'number',required:true},{name:'price',label:'Preço (R$)',type:'number',required:true},{name:'description',label:'Descrição',type:'textarea'}]}
    rows={data as any} columns={[{key:'name',label:'Serviço',render:r=><div><div className="font-semibold">{r.name}</div><div className="mt-1 text-[10px] text-[#6e809a]">{r.category}</div></div>},{key:'durationMinutes',label:'Duração',render:r=>`${r.durationMinutes} min`},{key:'price',label:'Preço',render:r=><b>{money(r.price)}</b>},{key:'active',label:'Status',render:r=><button className={`rounded-full px-3 py-1 text-[10px] font-semibold ${r.active?'bg-[#e9f1e9] text-[#4e7950]':'bg-[#f3e8e4] text-[#99513f]'}`} onClick={()=>update.mutate({serviceId:r.id,data:{active:!r.active}},{onSuccess:refresh})}>{r.active?'Ativo':'Inativo'}</button>} ]}
    create={payload=>create.mutate({data:{...payload,durationMinutes:Number(payload.durationMinutes),price:Number(payload.price)} as any},{onSuccess:refresh})}
    update={(id,payload)=>update.mutate({serviceId:id,data:{...payload,durationMinutes:Number(payload.durationMinutes),price:Number(payload.price)} as any},{onSuccess:refresh})}
    remove={id=>remove.mutate({serviceId:id},{onSuccess:refresh})} />
}

function FinancePage() {
  const month=new Date().toISOString().slice(0,7); const {data,isLoading,isError,refetch}=useGetFinanceSummary({month}); const qc=useQueryClient(); const create=useCreateTransaction();
  const refresh=()=>void qc.invalidateQueries({queryKey:getGetFinanceSummaryQueryKey({month})});
  const rows=(data?.transactions||[]) as Transaction[];
  return <ResourcePage title="Financeiro" eyebrow="Caixa em dia" description="Acompanhe entradas, saídas e o resultado do mês." singular="lançamento" createLabel="Novo lançamento" loading={isLoading} error={isError?new Error('Falha ao carregar financeiro'):null} retry={()=>void refetch()}
    toolbar={data&&<div className="grid gap-3 sm:grid-cols-3">{[{label:'Entradas',value:money(data.income),icon:ArrowUpRight},{label:'Despesas',value:money(data.expenses),icon:ArrowDownRight},{label:'Saldo do mês',value:money(data.net),icon:CircleDollarSign}].map(x=><div key={x.label} className="surface flex items-center gap-3 p-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e4ebf5] text-[#a01c27]"><x.icon size={17}/></span><div><div className="text-[10px] text-[#5e6e85]">{x.label}</div><div className="mt-1 text-lg font-semibold">{x.value}</div></div></div>)}</div>}
    fields={[{name:'description',label:'Descrição',required:true},{name:'kind',label:'Tipo',required:true,options:[{value:'income',label:'Entrada'},{value:'expense',label:'Saída'}]},{name:'category',label:'Categoria',required:true},{name:'amount',label:'Valor (R$)',type:'number',required:true},{name:'date',label:'Data',type:'date',required:true}]}
    rows={rows as any} columns={[{key:'description',label:'Descrição',render:r=><div><div className="font-semibold">{r.description}</div><div className="mt-1 text-[10px] text-[#6d7f99]">{r.category}</div></div>},{key:'date',label:'Data',render:r=>datePt(r.date)},{key:'kind',label:'Tipo',render:r=><span className={r.kind==='income'?'text-[#55805c]':'text-[#ac5a49'}>{r.kind==='income'?'Entrada':'Saída'}</span>},{key:'amount',label:'Valor',render:r=><b>{money(r.amount)}</b>}]}
    create={payload=>create.mutate({data:{...payload,amount:Number(payload.amount)} as any},{onSuccess:refresh})} />
}

function InventoryPage() {
  const {data=[],isLoading,isError,refetch}=useListInventory(); const qc=useQueryClient(); const create=useCreateInventoryItem(); const update=useUpdateInventoryItem(); const remove=useDeleteInventoryItem();
  const refresh=()=>void qc.invalidateQueries({queryKey:getListInventoryQueryKey()});
  return <ResourcePage title="Estoque" eyebrow="Materiais sob controle" description="Acompanhe produtos, custos e níveis mínimos." singular="produto" loading={isLoading} error={isError?new Error('Falha ao carregar estoque'):null} retry={()=>void refetch()} search
    fields={[{name:'name',label:'Nome do produto',required:true},{name:'quantity',label:'Quantidade',type:'number',required:true},{name:'minimumQuantity',label:'Nível mínimo',type:'number',required:true},{name:'unit',label:'Unidade',required:true},{name:'supplier',label:'Fornecedor'},{name:'unitCost',label:'Custo unitário (R$)',type:'number'}]}
    rows={data as any} columns={[{key:'name',label:'Produto',render:r=><div className="font-semibold">{r.name}{r.lowStock&&<span className="ml-2 rounded-full bg-[#fae9e2] px-2 py-1 text-[9px] font-semibold text-[#a8533e]">Estoque baixo</span>}</div>},{key:'quantity',label:'Em estoque',render:r=><span className={r.quantity<=r.minimumQuantity?'font-bold text-[#ab5542]':'font-medium'}>{r.quantity} {r.unit}</span>},{key:'minimumQuantity',label:'Mínimo',render:r=>`${r.minimumQuantity} ${r.unit}`},{key:'supplier',label:'Fornecedor'},{key:'unitCost',label:'Custo',render:r=>r.unitCost?money(r.unitCost):'—'}]}
    create={payload=>create.mutate({data:{...payload,quantity:Number(payload.quantity),minimumQuantity:Number(payload.minimumQuantity),unitCost:Number(payload.unitCost||0)} as any},{onSuccess:refresh})}
    update={(id,payload)=>update.mutate({itemId:id,data:{...payload,quantity:Number(payload.quantity),minimumQuantity:Number(payload.minimumQuantity),unitCost:Number(payload.unitCost||0)} as any},{onSuccess:refresh})}
    remove={id=>remove.mutate({itemId:id},{onSuccess:refresh})} />
}

function MarketingPage() {
  const {data=[],isLoading,isError,refetch}=useListCampaigns(); const {data:salonContext}=useGetCurrentSalon(); const qc=useQueryClient(); const create=useCreateCampaign(); const refresh=()=>void qc.invalidateQueries({queryKey:getListCampaignsQueryKey()});
  return <ResourcePage title="Marketing" eyebrow="Um motivo para voltar" description="Cupons simples para movimentar a agenda." singular="campanha" createLabel="Nova campanha" loading={isLoading} error={isError?new Error('Falha ao carregar campanhas'):null} retry={()=>void refetch()}
    fields={[{name:'name',label:'Nome da campanha',required:true},{name:'code',label:'Código do cupom',required:true},{name:'discountPct',label:'Desconto (%)',type:'number',required:true},{name:'startsAt',label:'Começa em',type:'date'},{name:'endsAt',label:'Termina em',type:'date'}]}
    rows={data as any} columns={[{key:'name',label:'Campanha',render:r=><div className="font-semibold">{r.name}<div className="mt-1 font-mono text-[10px] font-medium tracking-wider text-[#8e1923]">{r.code}</div></div>},{key:'discountPct',label:'Desconto',render:r=><b>{r.discountPct}%</b>},{key:'redemptionCount',label:'Utilizações'},{key:'startsAt',label:'Período',render:r=><span className="text-xs">{datePt(r.startsAt)} — {datePt(r.endsAt)}</span>},{key:'active',label:'Status',render:r=><span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${r.active?'bg-[#e9f1e9] text-[#4e7950]':'bg-[#f3e8e4] text-[#99513f]'}`}>{r.active?'Ativa':'Encerrada'}</span>},{key:'whatsapp',label:'WhatsApp',render:r=>{const href=salonContext?.salon.whatsapp?whatsappHref(salonContext.salon.whatsapp,`Olá! A barbearia ${salonContext.salon.name} está com uma oferta especial: ${r.name}. Use o cupom ${r.code} para receber ${r.discountPct}% de desconto.`):null;return href?<a className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#901923] hover:underline" href={href} target="_blank" rel="noreferrer"><MessageCircle size={13}/>Falar no WhatsApp</a>:'—';}}]}
    create={payload=>create.mutate({data:{...payload,discountPct:Number(payload.discountPct),startsAt:payload.startsAt||null,endsAt:payload.endsAt||null} as any},{onSuccess:refresh})} />
}

const planLabel = (plan?: string | null) => ({ free: 'Gratuito', pro: 'Pro', business: 'Business' } as Record<string, string>)[plan || 'free'] || plan || 'Gratuito';

function BookingLink({ slug }: { slug: string }) {
  const url = `${window.location.origin}${basePath}/book/${slug}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copie o link:', url); }
  };
  return <div className="mt-2 flex flex-wrap items-center gap-2"><code className="rounded-lg bg-[#eaeff7] px-3 py-2 text-xs text-[#2d4e80] break-all">{url}</code><button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-xs" onClick={() => void copy()}><Copy size={13}/>{copied ? 'Copiado!' : 'Copiar link'}</button><a className="inline-flex items-center gap-1 text-xs font-semibold text-[#8f1923]" href={url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Abrir</a></div>;
}

function SettingsPage() {
  const {data,isLoading,isError,refetch}=useGetCurrentSalon(); const update=useUpdateCurrentSalon(); const qc=useQueryClient();
  const [form,setForm]=useState<Record<string,string>>({});
  useEffect(()=>{if(data?.salon)setForm({name:data.salon.name,cnpj:data.salon.cnpj||'',address:data.salon.address,phone:data.salon.phone,whatsapp:data.salon.whatsapp,logoUrl:data.salon.logoUrl||''})},[data?.salon?.id]);
  if(isLoading)return <Loading label="Carregando dados da barbearia"/>;
  if(isError||!data)return <ErrorState message="Não foi possível carregar os dados da barbearia." retry={()=>void refetch()}/>;
  return <section className="animate-in space-y-6"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a21d28]">Sua casa</div><h1 className="brand-display mt-2 text-3xl font-semibold">Configurações</h1><p className="mt-2 text-sm text-[#5e6e85]">Mantenha as informações da barbearia sempre corretas.</p></div><form className="surface max-w-3xl p-6 sm:p-8" onSubmit={e=>{e.preventDefault();update.mutate({data:form as any},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetCurrentSalonQueryKey()})})}}><div className="grid gap-5 sm:grid-cols-2">{[{name:'name',label:'Nome da barbearia',required:true},{name:'cnpj',label:'CNPJ'},{name:'phone',label:'Telefone',required:true},{name:'whatsapp',label:'WhatsApp',required:true},{name:'address',label:'Endereço',required:true},{name:'logoUrl',label:'URL do logo'}].map(field=><label key={field.name}><span className="mb-1.5 block text-xs font-semibold text-[#2d4e80]">{field.label}</span><input className="field" required={field.required} value={form[field.name]??''} onChange={e=>setForm({...form,[field.name]:e.target.value})} data-testid={`input-${field.name}`}/></label>)}</div><div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-[#dee6f2] pt-5"><div className="min-w-0"><div className="text-xs font-semibold">Plano atual</div><div className="mt-1 text-xs text-[#5e6e85]">{planLabel(data.salon.plan)} · link de agendamento para seus clientes:</div><BookingLink slug={data.salon.slug}/></div><button className="btn-primary" disabled={update.isPending}>{update.isPending?'Salvando...':'Salvar alterações'}</button></div>{update.isError&&<p className="mt-4 text-xs text-[#a74e41]">{errorText(update.error)}</p>}{update.isSuccess&&<p className="mt-4 text-xs text-[#4e7950]">Alterações salvas.</p>}</form></section>;
}

function OnboardingPage() {
  const {isLoaded,isSignedIn}=useAuth(); const create=useCreateSalon(); const [,setLocation]=useLocation(); const qc=useQueryClient();
  const [form,setForm]=useState({name:'',address:'',phone:'',whatsapp:'',cnpj:''});
  if(!isLoaded)return <Loading label="Preparando seu cadastro"/>; if(!isSignedIn)return <Redirect to="/sign-up"/>;
  return <main className="grain flex min-h-[100dvh] items-center justify-center bg-[#0e1a2b] px-4 py-10 text-[#dce5f2]"><div className="w-full max-w-[520px]"><Link href="/" className="mb-10 inline-flex"><Brand/></Link><div className="rounded-2xl border border-[#20385c] bg-[#15243b] p-7 sm:p-9"><div className="text-[10px] uppercase tracking-[.22em] text-[#e63946]">Seu primeiro passo</div><h1 className="brand-display mt-3 text-3xl font-semibold">Abra as portas da sua barbearia.</h1><p className="mt-2 text-sm leading-6 text-[#94a1b5]">Conte o básico. Você completa os detalhes depois.</p><form className="mt-7 space-y-4" onSubmit={e=>{e.preventDefault();create.mutate({data:form as SalonInput},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getGetCurrentSalonQueryKey()});setLocation('/dashboard')}})}}>{[{name:'name',label:'Nome da barbearia',required:true},{name:'address',label:'Endereço',required:true},{name:'phone',label:'Telefone',required:true},{name:'whatsapp',label:'WhatsApp',required:true},{name:'cnpj',label:'CNPJ'}].map(field=><label key={field.name} className="block"><span className="mb-1.5 block text-xs font-semibold text-[#d0dced]">{field.label}</span><input className="field border-[#26416b] bg-[#1b2e4c] text-white placeholder:text-[#5e6e85]" required={field.required} value={(form as any)[field.name]} onChange={e=>setForm({...form,[field.name]:e.target.value})} data-testid={`input-${field.name}`}/></label>)}{create.isError&&<p className="text-xs text-[#e48d78]">{errorText(create.error)}</p>}<button className="btn-primary mt-3 w-full" disabled={create.isPending}>{create.isPending?'Criando espaço...':'Criar minha barbearia'}</button></form></div><p className="mt-5 text-center text-[10px] text-[#5e6e85]">Seu workspace, sua maneira de trabalhar.</p></div></main>;
}

function BookingPage() {
  const {slug=''}=useParams<{slug:string}>(); const {data:salon,isLoading,isError,refetch}=useGetPublicSalon(slug); const availability=useCheckBookingAvailability(); const book=useCreatePublicBooking();
  const [serviceId,setServiceId]=useState(''); const [date,setDate]=useState(''); const [barberId,setBarberId]=useState(''); const [slot,setSlot]=useState(''); const [clientName,setClientName]=useState(''); const [clientPhone,setClientPhone]=useState(''); const [done,setDone]=useState(false);
  const slots=availability.data||[];
  if(isLoading)return <main className="min-h-[100dvh] bg-[#eef2f9]"><Loading label="Abrindo a página da barbearia"/></main>;
  if(isError||!salon)return <main className="grid min-h-[100dvh] place-items-center bg-[#eef2f9]"><ErrorState message="Não encontramos esta barbearia." retry={()=>void refetch()}/></main>;
  const selectedService=salon.services.find(s=>s.id===serviceId);
  return <main className="min-h-[100dvh] bg-[#eef2f9] px-4 py-8"><div className="mx-auto max-w-2xl"><header className="mb-7 flex items-center justify-between"><Brand small/><Link href="/" className="text-xs text-[#5e6e85]">Kortta</Link></header><div className="surface overflow-hidden"><div className="bg-[#0e1a2b] px-6 py-8 text-[#e5ebf5] sm:px-9"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-xl bg-[#e63946] text-[#ffffff]"><Scissors size={24}/></div><div><div className="text-[9px] uppercase tracking-[.2em] text-[#eb4b58]">Agendamento online</div><h1 className="brand-display mt-1 text-2xl font-semibold">{salon.name}</h1><p className="mt-1 text-xs text-[#94a1b5]">{salon.address}</p></div></div></div>
    {done?<div className="px-6 py-14 text-center sm:px-9"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eaf1e7] text-[#4f8055]"><Check size={24}/></div><h2 className="brand-display mt-4 text-2xl font-semibold">Horário solicitado.</h2><p className="mt-2 text-sm text-[#5e6e85]">A barbearia recebeu seu pedido. Até breve, {clientName}.</p>{whatsappHref(salon.whatsapp,`Olá! Acabei de solicitar ${selectedService?.name||'um serviço'} para ${datePt(date)} às ${slot}. Meu nome é ${clientName}.`)?<a className="btn-primary mt-6 inline-flex items-center gap-2" href={whatsappHref(salon.whatsapp,`Olá! Acabei de solicitar ${selectedService?.name||'um serviço'} para ${datePt(date)} às ${slot}. Meu nome é ${clientName}.`)||undefined} target="_blank" rel="noreferrer"><MessageCircle size={16}/>Falar no WhatsApp</a>:null}</div>:<form className="space-y-6 px-6 py-7 sm:px-9" onSubmit={e=>{e.preventDefault();book.mutate({slug,data:{date,startTime:slot,clientName,clientPhone,serviceId,barberId,notes:null}},{onSuccess:()=>setDone(true)})}}>
      <label className="block"><span className="mb-2 block text-xs font-semibold">1. Escolha o serviço</span><select className="field" required value={serviceId} onChange={e=>{setServiceId(e.target.value);setSlot('')}}><option value="">Selecione um serviço</option>{salon.services.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {money(s.price)}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-semibold">2. Data</span><input className="field" type="date" required min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>{setDate(e.target.value);setSlot('')}}/></label><label><span className="mb-2 block text-xs font-semibold">3. Profissional</span><select className="field" required value={barberId} onChange={e=>{setBarberId(e.target.value);setSlot('')}}><option value="">Escolha quem atende</option>{salon.barbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div>
      <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">4. Horários disponíveis</span><button type="button" className="text-[11px] font-semibold text-[#8f1923]" disabled={!serviceId||!date||availability.isPending} onClick={()=>availability.mutate({slug,data:{date,serviceId,barberId:barberId||null}})}>{availability.isPending?'Buscando...':'Ver horários'}</button></div>{availability.isError&&<p className="text-xs text-[#a74e41]">Não foi possível consultar os horários. Tente novamente.</p>}<div className="flex flex-wrap gap-2">{slots.map((available,index)=><button key={`${available.startTime}-${index}`} type="button" onClick={()=>{setSlot(available.startTime);setBarberId(available.barberId)}} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${slot===available.startTime?'border-[#e63946] bg-[#e63946] text-[#ffffff]':'border-[#cedaec] bg-white text-[#284673]'}`}>{available.startTime} <span className="font-normal opacity-70">{available.barberName}</span></button>)}</div>{availability.isSuccess&&slots.length===0&&<p className="mt-2 text-xs text-[#5e6e85]">Sem horários livres nesta data.</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-semibold">Seu nome</span><input className="field" required value={clientName} onChange={e=>setClientName(e.target.value)}/></label><label><span className="mb-2 block text-xs font-semibold">WhatsApp</span><input className="field" required value={clientPhone} onChange={e=>setClientPhone(e.target.value)}/></label></div>
      {selectedService&&<div className="flex items-center justify-between rounded-xl bg-[#eaeff7] p-4 text-xs"><span className="font-medium">{selectedService.name} · {slot||'horário a definir'}</span><b>{money(selectedService.price)}</b></div>}
      {book.isError&&<p className="text-xs text-[#a74e41]">{errorText(book.error)}</p>}<button type="submit" className="btn-primary w-full py-3" disabled={!slot||book.isPending}>{book.isPending?'Enviando pedido...':'Confirmar agendamento'}</button><p className="text-center text-[10px] text-[#6e7f99]">Ao confirmar, a equipe da barbearia recebe seu nome, WhatsApp e horário para realizar o atendimento. Veja a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p>
    </form>}</div><footer className="mt-6 text-center text-[10px] text-[#6f819b]">Agendamento com Kortta · <Link href="/termos" className="underline">Termos</Link> · <Link href="/privacidade" className="underline">Privacidade</Link></footer></div></main>;
}

function CacheInvalidator() {
  const {addListener}=useClerk(); const client=useQueryClient(); const previous=useRef<string|null|undefined>(undefined);
  useEffect(()=>{const unsubscribe=addListener(({user})=>{const userId=user?.id??null;if(previous.current!==undefined&&previous.current!==userId)client.clear();previous.current=userId});return unsubscribe},[addListener,client]);
  return null;
}

function AuthRoutes() {
  const [,setLocation]=useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{signIn:{start:{title:'Bom ter você de volta',subtitle:'Entre para cuidar da sua barbearia'}},signUp:{start:{title:'Seu próximo passo começa aqui',subtitle:'Crie sua conta Kortta'}}}}
    routerPush={to=>setLocation(stripBase(to))} routerReplace={to=>setLocation(stripBase(to),{replace:true})}>
    <QueryClientProvider client={queryClient}><CacheInvalidator/><PageMeta/><Switch>
      <Route path="/" component={HomeRedirect}/>
      <Route path="/sign-in/*?" component={SignInPage}/><Route path="/sign-up/*?" component={SignUpPage}/>
      <Route path="/onboarding" component={OnboardingPage}/>
      <Route path="/book/:slug" component={BookingPage}/>
      <Route path="/termos" component={TermsPage}/>
      <Route path="/privacidade" component={PrivacyPage}/>
      <Route path="/dashboard"><PrivatePage><DashboardPage/></PrivatePage></Route>
      <Route path="/agenda"><PrivatePage><AgendaPage/></PrivatePage></Route>
      <Route path="/clientes"><PrivatePage><ClientsPage/></PrivatePage></Route>
      <Route path="/equipe"><PrivatePage><TeamPage/></PrivatePage></Route>
      <Route path="/servicos"><PrivatePage><ServicesPage/></PrivatePage></Route>
      <Route path="/financeiro"><PrivatePage><FinancePage/></PrivatePage></Route>
      <Route path="/estoque"><PrivatePage><InventoryPage/></PrivatePage></Route>
      <Route path="/marketing"><PrivatePage><MarketingPage/></PrivatePage></Route>
      <Route path="/configuracoes"><PrivatePage><SettingsPage/></PrivatePage></Route>
      <Route><NotFound/></Route>
    </Switch></QueryClientProvider>
  </ClerkProvider>;
}

function PageMeta() {
  const [location] = useLocation();
  useEffect(() => {
    const page = location.split('?')[0];
    const titles: Record<string, string> = {
      '/': 'Gestão simples, agenda cheia',
      '/sign-in': 'Entrar',
      '/sign-up': 'Criar conta',
      '/onboarding': 'Cadastrar barbearia',
      '/dashboard': 'Visão geral',
      '/agenda': 'Agenda',
      '/clientes': 'Clientes',
      '/equipe': 'Equipe',
      '/servicos': 'Serviços',
      '/financeiro': 'Financeiro',
      '/estoque': 'Estoque',
      '/marketing': 'Marketing',
      '/configuracoes': 'Configurações',
      '/termos': 'Termos de Uso',
      '/privacidade': 'Política de Privacidade',
    };
    const isBooking = page.startsWith('/book/');
    const title = isBooking ? 'Agendamento online' : titles[page] || 'Kortta';
    document.title = `${title} | Kortta`;
    document.documentElement.lang = 'pt-BR';
    const description = page === '/'
      ? 'Agendamento online, clientes, equipe e finanças em um só lugar. O Kortta ajuda sua barbearia a funcionar melhor.'
      : `Kortta — ${title.toLowerCase()} para sua barbearia.`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }, [location]);
  return null;
}

function NotFound() {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#eef2f9] p-8"><div className="text-center"><Brand small/><div className="brand-display mt-9 text-7xl font-semibold">404</div><h1 className="mt-3 text-lg font-semibold">Esta página não está na agenda.</h1><Link href="/" className="btn-primary mt-6 inline-flex">Voltar ao início</Link></div></main>;
}

function App() {
  return <WouterRouter base={basePath}><AuthRoutes/></WouterRouter>;
}

export default App;
