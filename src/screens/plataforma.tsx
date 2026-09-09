import { useState } from 'react';
import {
  Building2,
  ChevronRight,
  CircleCheck,
  LoaderCircle,
  LogIn,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { AppBar } from '../components/layout/chrome';
import { Badge, Button, Card, ListRow, SectionTitle } from '../components/ui/primitives';
import { Field, Input } from '../components/ui/forms';
import { EmptyState } from '../components/ui/states';
import { MarcaOvolog } from '../components/ui/marca';
import { useApp } from '../store/app';
import { cnpj as fmtCnpj, phone as fmtPhone, shortDate } from '../lib/format';
import type { Distribuidora } from '../types';

/* Área de quem administra o PRODUTO, não a distribuição de ovos.
 *
 * Cada distribuidora opera isolada dentro do mesmo banco — o RLS filtra por
 * `distribuidora_id` em toda consulta. Esta tela é a única do app que enxerga
 * mais de uma, e enxerga porque o admin de plataforma tem política própria.
 *
 * O que ela NÃO faz: criar o acesso do gestor da distribuidora nova. Criar
 * conta em `auth.users` exige a chave `service_role`, que não pode viver no
 * navegador — se vazasse, ignoraria o RLS de todas as empresas de uma vez. Os
 * dois passos que faltam estão escritos na tela de confirmação. */

export function PlataformaScreen({ onEntrarNaOperacao }: { onEntrarNaOperacao?: () => void }) {
  const { distribuidoras, signOut, session, distribuidora } = useApp();
  const [criando, setCriando] = useState(false);

  if (criando) return <NovaDistribuidoraScreen onFechar={() => setCriando(false)} />;

  const ativas = distribuidoras.filter((d) => d.ativa);

  return (
    <div className="min-h-screen bg-shell-100">
      <header
        className="border-b border-shell-200 bg-white"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 pb-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
            <MarcaOvolog size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold text-shell-900">Plataforma OVOLOG</div>
            <div className="text-meta text-shell-600">
              {distribuidoras.length}{' '}
              {distribuidoras.length === 1 ? 'distribuidora' : 'distribuidoras'}
              {ativas.length !== distribuidoras.length && ` • ${ativas.length} ativas`}
            </div>
          </div>
          <Button
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => setCriando(true)}
            className="hidden sm:inline-flex"
          >
            Nova distribuidora
          </Button>
          <button
            onClick={() => void signOut()}
            className="shrink-0 text-meta font-semibold text-shell-600 underline"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-5 py-5 pb-28 sm:pb-5">
        {/* Quem administra o produto e também tem cadastro numa distribuidora
            entra na operação dela sem trocar de conta. */}
        {session && onEntrarNaOperacao && (
          <Card onClick={onEntrarNaOperacao} className="flex items-center gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800">
              <LogIn size={20} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-semibold text-shell-900">Entrar na operação</span>
              <span className="block truncate text-meta text-shell-600">
                {distribuidora?.nome ?? 'Sua distribuidora'} • {session.name}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-shell-400" />
          </Card>
        )}

        {/* Admin sem cadastro em nenhuma equipe. Não é erro — é o desenho: quem
            administra o produto não opera distribuição. Mas sem dizer isso, a
            tela parece um app que perdeu o resto das funções. */}
        {!session && (
          <Card className="flex items-start gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-shell-100 text-shell-600">
              <ShieldCheck size={20} />
            </span>
            <div className="min-w-0 text-meta text-shell-700">
              <p className="font-semibold text-shell-900">Você administra a plataforma</p>
              <p className="mt-1">
                Esta conta cria e acompanha distribuidoras — não opera nenhuma. Cada empresa
                tem a própria equipe, os próprios produtos e os próprios clientes, sem enxergar
                as outras.
              </p>
              <p className="mt-2">
                Para também operar uma delas, ligue esta conta à equipe dela pelo SQL Editor. O
                comando está no rodapé de <strong>0007_multiempresa.sql</strong>.
              </p>
            </div>
          </Card>
        )}

        {distribuidoras.length === 0 ? (
          <EmptyState
            icon={<Building2 size={28} />}
            title="Nenhuma distribuidora ainda"
            message="Cada distribuidora cadastra a própria equipe, os próprios produtos e os próprios clientes, sem enxergar as outras."
            actionLabel="Criar a primeira"
            onAction={() => setCriando(true)}
          />
        ) : (
          <div>
            <SectionTitle>Distribuidoras</SectionTitle>
            <Card className="divide-y divide-shell-200 overflow-hidden">
              {distribuidoras.map((d) => (
                <LinhaDistribuidora key={d.id} distribuidora={d} />
              ))}
            </Card>
          </div>
        )}
      </main>

      {/* No celular a ação principal continua ao alcance do polegar. Barra
          própria, e não `StickyAction`: aquela se alinha à coluna do app,
          descontando uma barra lateral que esta tela não tem. */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-shell-200 bg-white/95 px-5 pt-3 backdrop-blur sm:hidden"
        style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
      >
        <Button size="lg" block icon={<Plus size={18} />} onClick={() => setCriando(true)}>
          Nova distribuidora
        </Button>
      </div>
    </div>
  );
}
function LinhaDistribuidora({ distribuidora }: { distribuidora: Distribuidora }) {
  const detalhe = [distribuidora.cidade, distribuidora.documento && fmtCnpj(distribuidora.documento)]
    .filter(Boolean)
    .join(' • ');

  return (
    <ListRow
      chevron={false}
      leading={
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-shell-100 text-shell-600">
          <Building2 size={20} />
        </span>
      }
      title={distribuidora.nome}
      subtitle={detalhe || `Criada em ${shortDate(distribuidora.criadaEm)}`}
      trailing={
        distribuidora.ativa ? undefined : (
          <Badge tone="neutral">Inativa</Badge>
        )
      }
    />
  );
}

/* ------------------------------------------------------ Nova distribuidora */

function NovaDistribuidoraScreen({ onFechar }: { onFechar: () => void }) {
  const { criarDistribuidora } = useApp();
  const [form, setForm] = useState({ nome: '', documento: '', telefone: '', cidade: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<Distribuidora | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const nova = await criarDistribuidora({
        ...form,
        documento: form.documento.replace(/\D/g, ''),
        telefone: form.telefone.replace(/\D/g, ''),
      });
      setCriada(nova);
    } catch (e) {
      setErro(
        e instanceof Error && e.message.includes('row-level security')
          ? 'Sua conta não tem permissão para criar distribuidoras.'
          : 'Não foi possível criar agora. Verifique a conexão e tente de novo.',
      );
    } finally {
      setSalvando(false);
    }
  }

  if (criada) return <DistribuidoraCriada distribuidora={criada} onFechar={onFechar} />;

  return (
    <>
      <AppBar title="Nova distribuidora" onBack={onFechar} />
      <main className="mx-auto max-w-2xl px-1 pb-28">
        <div className="space-y-4 p-4">
          <Field label="Nome da empresa" hint="Como ela é conhecida.">
            <Input
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Distribuidora Bom Ovo"
              autoCapitalize="words"
            />
          </Field>
          <Field label="CNPJ">
            <Input
              value={form.documento}
              onChange={(e) => set('documento', e.target.value)}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              inputMode="tel"
              placeholder="(14) 99999-0000"
            />
          </Field>
          <Field label="Cidade">
            <Input
              value={form.cidade}
              onChange={(e) => set('cidade', e.target.value)}
              placeholder="Bauru - SP"
              autoCapitalize="words"
            />
          </Field>

          {erro && (
            <p role="alert" className="flex items-start gap-2 text-meta font-semibold text-bad-700">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              {erro}
            </p>
          )}
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 border-t border-shell-200 bg-white/95 px-5 pt-3 backdrop-blur"
        style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
      >
        <div className="mx-auto max-w-2xl">
        <Button
          size="lg"
          block
          disabled={form.nome.trim().length < 3 || salvando}
          onClick={() => void salvar()}
          icon={salvando ? <LoaderCircle size={18} className="animate-spin" /> : undefined}
        >
          {salvando ? 'Criando…' : 'Criar distribuidora'}
        </Button>
        </div>
      </div>
    </>
  );
}

/* A distribuidora existe, mas ninguém consegue entrar nela ainda. Terminar a
   frase aqui evita o pior desfecho: achar que acabou e descobrir dias depois
   que o cliente nunca conseguiu acessar. */
function DistribuidoraCriada({
  distribuidora,
  onFechar,
}: {
  distribuidora: Distribuidora;
  onFechar: () => void;
}) {
  return (
    <>
      <AppBar title="Distribuidora criada" onBack={onFechar} />
      <main className="mx-auto max-w-2xl px-1 pb-28">
        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ok-50 text-ok-700">
              <CircleCheck size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="text-title font-bold leading-tight text-shell-900">
                {distribuidora.nome}
              </h1>
              <p className="mt-0.5 text-meta text-shell-600">
                {distribuidora.cidade || 'Sem cidade informada'}
                {distribuidora.telefone && ` • ${fmtPhone(distribuidora.telefone)}`}
              </p>
            </div>
          </div>

          <Card className="p-4">
            <SectionTitle className="px-0">Faltam dois passos</SectionTitle>
            <p className="text-meta text-shell-700">
              A empresa está criada e isolada, mas ainda não tem ninguém que possa entrar. Criar
              conta de acesso exige a chave <strong>service_role</strong>, que não pode ficar no
              navegador — se vazasse, daria acesso ao dado de todas as empresas de uma vez.
            </p>
            <ol className="mt-3 space-y-3 text-meta text-shell-700">
              <li>
                <strong className="text-shell-900">1.</strong> No painel do Supabase, em{' '}
                <em>Authentication → Users → Add user</em>, crie o acesso do gestor desta
                distribuidora. Marque <em>Auto Confirm User</em>.
              </li>
              <li>
                <strong className="text-shell-900">2.</strong> No SQL Editor, ligue o acesso à
                empresa:
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-shell-100 p-3 text-micro leading-relaxed text-shell-800">
{`insert into usuarios
  (nome, papel, email, iniciais, auth_id, distribuidora_id)
values
  ('Nome do gestor', 'gestor', 'email@empresa.com.br',
   'NG', 'UUID-DO-AUTH', '${distribuidora.id}');`}
                </pre>
              </li>
            </ol>
            <p className="mt-3 text-meta text-shell-600">
              A partir daí a distribuidora cadastra a própria equipe, os próprios produtos e os
              próprios clientes, sem enxergar nenhuma outra.
            </p>
          </Card>
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 border-t border-shell-200 bg-white/95 px-5 pt-3 backdrop-blur"
        style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
      >
        <div className="mx-auto max-w-2xl">
        <Button size="lg" block onClick={onFechar}>
          Concluir
        </Button>
        </div>
      </div>
    </>
  );
}
