import type { ReactNode } from 'react';
import { Link } from 'wouter';

// Dados do fornecedor exibidos nos documentos legais.
export const COMPANY = {
  name: '68.227.742 DANIEL HENRIQUE DOS SANTOS',
  cnpj: '68.227.742/0001-98',
  city: 'Votorantim/SP',
  email: 'danielh.santos.2022@gmail.com',
  updatedAt: '7 de novembro de 2026',
};

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#f7f5f0] px-4 py-10 text-[#262420]">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-xs font-semibold text-[#8d721b]">← Voltar ao BarberFlow</Link>
        <h1 className="brand-display mt-6 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-xs text-[#77736c]">Última atualização: {COMPANY.updatedAt}</p>
        <div className="legal mt-8 space-y-4 text-sm leading-7 [&_h2]:brand-display [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
        <footer className="mt-12 border-t border-[#e2ddd1] pt-6 text-xs text-[#77736c]">
          {COMPANY.name} · CNPJ {COMPANY.cnpj} · {COMPANY.city} · <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          <div className="mt-2 flex gap-4"><Link href="/termos" className="underline">Termos de Uso</Link><Link href="/privacidade" className="underline">Política de Privacidade</Link></div>
        </footer>
      </article>
    </main>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <p>
        Estes Termos regulam o uso do <b>BarberFlow</b>, plataforma on-line de gestão para barbearias, fornecida por{' '}
        <b>{COMPANY.name}</b>, inscrita no CNPJ {COMPANY.cnpj}, com sede em {COMPANY.city} (“BarberFlow”, “nós”).
        Ao criar uma conta, você declara que leu e concorda com estes Termos e com a{' '}
        <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O BarberFlow oferece agenda, cadastro de clientes, equipe, serviços, controle financeiro, estoque, campanhas e uma
        página pública de agendamento para cada barbearia. O serviço é acessado pela internet, sem instalação.
      </p>

      <h2>2. Quem pode usar</h2>
      <ul>
        <li>Pessoas maiores de 18 anos, agindo em nome próprio ou de uma barbearia que representam.</li>
        <li>Você é responsável pela veracidade dos dados informados e pela segurança da sua senha.</li>
        <li>Cada conta é vinculada a uma barbearia. Você responde por tudo o que for feito com o seu acesso.</li>
      </ul>

      <h2>3. Fase de lançamento e preços</h2>
      <p>
        Durante a fase de lançamento, o BarberFlow é oferecido <b>gratuitamente</b>. Planos pagos poderão ser criados no
        futuro. Nenhuma cobrança será feita sem que você escolha um plano pago, e avisaremos por e-mail com pelo menos{' '}
        <b>30 dias de antecedência</b> antes de qualquer mudança que afete recursos que você já utiliza.
      </p>

      <h2>4. Uso permitido</h2>
      <p>Você concorda em não:</p>
      <ul>
        <li>usar o serviço para atividades ilegais, fraudulentas ou para enviar mensagens não solicitadas (spam);</li>
        <li>cadastrar dados de pessoas sem base legal adequada, conforme a Lei Geral de Proteção de Dados (LGPD);</li>
        <li>tentar acessar dados de outras barbearias, burlar mecanismos de segurança ou sobrecarregar o sistema;</li>
        <li>copiar, revender ou fazer engenharia reversa da plataforma.</li>
      </ul>

      <h2>5. Dados da barbearia e dos seus clientes</h2>
      <p>
        Os dados que você cadastra (clientes, agendamentos, finanças, estoque etc.) pertencem à sua barbearia. Em relação aos
        dados pessoais dos seus clientes, <b>a barbearia é a controladora</b> e o BarberFlow atua como <b>operador</b>,
        tratando esses dados apenas para prestar o serviço, conforme a{' '}
        <Link href="/privacidade" className="underline">Política de Privacidade</Link>. Cabe à barbearia informar seus
        clientes sobre o uso dos dados e atender aos pedidos deles.
      </p>

      <h2>6. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o serviço disponível e seguro, mas ele pode passar por interrupções para manutenção ou por
        falhas de fornecedores de infraestrutura. Mantemos cópias de segurança automáticas, mas recomendamos que você
        mantenha seus próprios registros das informações essenciais ao seu negócio.
      </p>

      <h2>7. Mensagens de WhatsApp</h2>
      <p>
        Os botões de WhatsApp abrem uma conversa com o texto pré-preenchido no seu próprio aplicativo. O envio é feito por
        você, e o BarberFlow não envia mensagens automaticamente nem se responsabiliza pelo uso do WhatsApp.
      </p>

      <h2>8. Cancelamento e exclusão</h2>
      <p>
        Você pode deixar de usar o serviço a qualquer momento e pedir a exclusão da conta e dos dados da barbearia pelo
        e-mail <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Antes da exclusão, você pode
        solicitar uma cópia dos seus dados. Podemos suspender contas que violem estes Termos.
      </p>

      <h2>9. Responsabilidade</h2>
      <p>
        O BarberFlow é uma ferramenta de apoio à gestão. Não nos responsabilizamos por decisões tomadas com base nas
        informações do sistema, por dados cadastrados incorretamente ou por perdas indiretas, como lucros cessantes. Nada
        nestes Termos limita direitos que não possam ser afastados por lei.
      </p>

      <h2>10. Propriedade intelectual</h2>
      <p>
        A marca, o código e o design do BarberFlow pertencem ao fornecedor. O uso do serviço não transfere nenhum direito
        sobre eles.
      </p>

      <h2>11. Alterações</h2>
      <p>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas por e-mail ou dentro da plataforma, e a data
        de atualização no topo desta página será alterada.
      </p>

      <h2>12. Lei e foro</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de {COMPANY.city} para resolver
        eventuais controvérsias, salvo disposição legal em contrário.
      </p>

      <h2>13. Contato</h2>
      <p>
        Dúvidas: <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade">
      <p>
        Esta Política explica como o <b>BarberFlow</b>, fornecido por <b>{COMPANY.name}</b> (CNPJ {COMPANY.cnpj}), trata
        dados pessoais, de acordo com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
      </p>

      <h2>1. Papéis de cada um</h2>
      <ul>
        <li>
          <b>Dados de quem usa o sistema</b> (donos e equipe das barbearias): o BarberFlow é o <b>controlador</b>.
        </li>
        <li>
          <b>Dados dos clientes das barbearias</b> (cadastrados pela barbearia ou informados no agendamento on-line): a
          barbearia é a <b>controladora</b> e o BarberFlow é o <b>operador</b>, que trata os dados apenas conforme as
          instruções da barbearia e para prestar o serviço.
        </li>
      </ul>

      <h2>2. Quais dados tratamos</h2>
      <ul>
        <li><b>Conta:</b> nome, e-mail e dados de login (fornecidos diretamente ou via Google).</li>
        <li><b>Barbearia:</b> nome, CNPJ, endereço, telefone, WhatsApp, horários e logotipo.</li>
        <li><b>Equipe:</b> nome, telefone, especialidades e percentual de comissão dos profissionais.</li>
        <li><b>Clientes da barbearia:</b> nome, telefone, e-mail, preferências, observações, histórico de atendimentos e pontos de fidelidade.</li>
        <li><b>Agendamento on-line:</b> nome, WhatsApp, serviço, data e horário escolhidos.</li>
        <li><b>Dados técnicos:</b> endereço IP, navegador e registros de acesso, para segurança e funcionamento.</li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li>Prestar o serviço contratado: login, agenda, cadastros e agendamento on-line (execução de contrato — art. 7º, V).</li>
        <li>Garantir a segurança, evitar fraudes e manter registros de acesso (legítimo interesse e obrigação legal — art. 7º, II e IX; Marco Civil da Internet).</li>
        <li>Comunicar mudanças no serviço e responder solicitações (execução de contrato e legítimo interesse).</li>
      </ul>
      <p>Não vendemos dados pessoais e não os usamos para publicidade.</p>

      <h2>4. Com quem compartilhamos</h2>
      <p>Usamos fornecedores de infraestrutura que tratam dados em nosso nome, sob contrato:</p>
      <ul>
        <li><b>Clerk</b> (EUA): autenticação e gerenciamento de login.</li>
        <li><b>Vercel</b> (EUA): hospedagem do site; o processamento da aplicação ocorre em São Paulo.</li>
        <li><b>Neon / Amazon Web Services</b>: banco de dados, armazenado em São Paulo.</li>
        <li><b>Google Fonts</b>: carregamento das fontes do site, que recebe o endereço IP do visitante.</li>
      </ul>
      <p>
        Alguns desses fornecedores estão no exterior. Nesses casos, a transferência internacional ocorre com base nas
        garantias contratuais oferecidas por eles (art. 33 da LGPD). Também podemos compartilhar dados quando exigido por
        lei ou ordem judicial.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Usamos apenas cookies essenciais, necessários para manter você conectado. Não usamos cookies de publicidade ou de
        rastreamento.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta e da barbearia: enquanto a conta estiver ativa.</li>
        <li>Após o pedido de exclusão: os dados são apagados em até 30 dias, exceto o que a lei exige manter.</li>
        <li>Registros de acesso: pelo período necessário à segurança e pelo prazo exigido em lei (Marco Civil da Internet).</li>
        <li>Cópias de segurança são sobrescritas automaticamente em poucos dias.</li>
      </ul>

      <h2>7. Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), banco de dados com acesso restrito e criptografado, separação dos dados de
        cada barbearia e login gerenciado por um provedor especializado. Nenhum sistema é 100% imune; em caso de incidente
        relevante, comunicaremos os afetados e a ANPD, conforme a lei.
      </p>

      <h2>8. Seus direitos</h2>
      <p>
        Você pode pedir confirmação do tratamento, acesso, correção, anonimização, portabilidade, exclusão, informações
        sobre compartilhamento e revisão de consentimento (art. 18 da LGPD). Se você é <b>cliente de uma barbearia</b>,
        fale primeiro com a própria barbearia, que é a responsável pelos seus dados. Nós a ajudaremos a atender o seu
        pedido. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>9. Encarregado (contato de privacidade)</h2>
      <p>
        Para exercer seus direitos ou tirar dúvidas, escreva para{' '}
        <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Respondemos em até 15 dias.
      </p>

      <h2>10. Alterações</h2>
      <p>
        Podemos atualizar esta Política. A data no topo indica a versão atual, e mudanças relevantes serão comunicadas.
      </p>
    </LegalLayout>
  );
}
