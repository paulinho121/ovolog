import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle, Mail, TriangleAlert } from 'lucide-react';
import { useApp } from '../store/app';
import { MarcaOvolog } from '../components/ui/marca';
import { supabase } from '../lib/supabase';
import { useNav } from '../store/navigation';
import { Button, Card } from '../components/ui/primitives';
import { Field, Input } from '../components/ui/forms';
import { cn } from '../lib/utils';

const ROLE_LABEL: Record<string, string> = {
  vendedor: 'Vendedor',
  motorista: 'Motorista',
  estoque: 'Estoque',
  compras: 'Compras',
  financeiro: 'Financeiro',
  gestor: 'Gestor',
};

/* --------------------------------------------------------------- Splash */

/* Visual do splash. Ele é a espera da carga inicial do banco, não um
   cronômetro: dura exatamente o tempo dos dados chegarem, nem mais nem
   menos. Quem controla isso é o `Boot` em App.tsx. */
export function SplashScreen({ legenda }: { legenda?: string } = {}) {
  return (
    <div className="grid min-h-screen place-items-center bg-brand-700 px-8">
      <div className="text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-white/15 text-white backdrop-blur">
          <MarcaOvolog size={44} />
        </div>
        <h1 className="mt-5 text-display font-bold tracking-tight text-white">OVOLOG</h1>
        <p className="mt-1 text-body text-brand-100">
          {legenda ?? 'Gestão inteligente para distribuição de ovos'}
        </p>
        <div className="mx-auto mt-8 h-1 w-28 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Login */

export function LoginScreen() {
  const { signIn, semVinculo, signOut } = useApp();
  const [recuperando, setRecuperando] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /* Autenticado mas sem pessoa correspondente em `usuarios`. Acontece quando
     alguém cria o acesso no painel do Supabase e esquece de ligar à equipe —
     e sem isso o app não sabe o papel, então não há Home para mostrar. */
  if (semVinculo) return <SemVinculo onSair={() => void signOut()} />;
  if (recuperando) return <ForgotScreen onBack={() => setRecuperando(false)} />;

  async function entrar() {
    if (entrando) return;
    setEntrando(true);
    setErro(null);
    const falha = await signIn(email, senha);
    setEntrando(false);
    /* Entrou: `onAuthStateChange` no store vira a chave, o Boot troca a tela
       e a navegação nasce já na Home. Nada a fazer aqui. */
    if (falha) setErro(falha);
  }

  const podeEntrar = email.includes('@') && senha.length >= 6 && !entrando;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div
        className="bg-brand-700 px-6 pb-10"
        style={{ paddingTop: 'calc(var(--safe-top) + 3rem)' }}
      >
        <div className="grid size-14 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
          <MarcaOvolog size={30} />
        </div>
        <h1 className="mt-4 text-display font-bold tracking-tight text-white">OVOLOG</h1>
        <p className="mt-1 text-body text-brand-100">Entre para começar a operação de hoje.</p>
      </div>

      <form
        className="flex-1 space-y-5 px-5 py-6"
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <Field label="E-mail">
          <div className="relative">
            <Mail
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-shell-400"
            />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="voce@empresa.com.br"
              className="pl-11"
            />
          </div>
        </Field>

        <Field label="Senha">
          <div className="relative">
            <Input
              type={verSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-shell-500 active:bg-shell-200"
            >
              {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        {erro && (
          <p role="alert" className="flex items-start gap-2 text-meta font-semibold text-bad-700">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {erro}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          block
          disabled={!podeEntrar}
          icon={entrando ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>

        <button
          type="button"
          onClick={() => setRecuperando(true)}
          className="block w-full py-2 text-center text-body font-semibold text-brand-800"
        >
          Esqueci minha senha
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------- Conta sem vínculo */

/* O acesso existe e a senha está certa, mas ninguém em `usuarios` aponta para
   esta conta. Deixar entrar sem papel definido daria uma Home vazia e sem
   explicação; dizer o que falta resolve em um minuto para quem administra. */
function SemVinculo({ onSair }: { onSair: () => void }) {
  return (
    <div
      className="flex min-h-screen flex-col bg-white px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 4rem)' }}
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-warn-50 text-warn-700">
        <TriangleAlert size={26} />
      </div>
      <h1 className="mt-5 text-display font-bold tracking-tight text-shell-900">
        Acesso sem equipe vinculada
      </h1>
      <p className="mt-2 text-body text-shell-600">
        Sua senha está correta, mas esta conta ainda não foi ligada a ninguém da operação —
        então o app não sabe qual é o seu papel.
      </p>
      <Card className="mt-6 p-4">
        <p className="text-meta text-shell-700">
          Peça ao gestor para vincular seu acesso ao seu cadastro. As instruções estão em
          <strong> supabase/migrations/0006_autenticacao_e_rls.sql</strong>.
        </p>
      </Card>
      <div className="flex-1" />
      <Button variant="secondary" size="lg" block onClick={onSair} className="mb-6">
        Sair
      </Button>
    </div>
  );
}
/* ------------------------------------------------------ Recuperar senha */

export function ForgotScreen({ onBack }: { onBack?: () => void } = {}) {
  const nav = useNav.opcional();
  const back = onBack ?? nav?.back ?? (() => {});
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [enviando, setEnviando] = useState(false);

  /* O e-mail é enviado pelo Supabase. A tela confirma do mesmo jeito tendo a
     conta ou não — dizer "este e-mail não existe" entregaria quais endereços
     têm acesso ao sistema para quem estivesse testando. */
  async function enviar() {
    setEnviando(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setEnviando(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white px-5" style={{ paddingTop: 'calc(var(--safe-top) + 1rem)' }}>
      <button onClick={back} className="-ml-2 mb-6 w-fit px-2 py-2 text-body font-semibold text-shell-700">
        ← Voltar
      </button>

      {sent ? (
        <div className="flex flex-1 flex-col">
          <h1 className="text-display font-bold text-shell-900">Confira seu e-mail</h1>
          <p className="mt-2 text-body text-shell-600">
            Se houver uma conta para <strong className="text-shell-900">{email}</strong>, enviamos um
            link para redefinir a senha. O link vale por 30 minutos.
          </p>
          <Card className="mt-6 p-4">
            <p className="text-meta text-shell-600">
              Não recebeu? Verifique o spam ou fale com o gestor da operação para confirmar o
              e-mail cadastrado.
            </p>
          </Card>
          <div className="flex-1" />
          <Button size="lg" block onClick={back} className="mb-6">
            Voltar para o login
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <h1 className="text-display font-bold text-shell-900">Recuperar senha</h1>
          <p className="mt-2 text-body text-shell-600">
            Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
          </p>
          <div className="mt-6">
            <Field label="E-mail">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="voce@empresa.com.br"
              />
            </Field>
          </div>
          <div className="flex-1" />
          <Button
            size="lg"
            block
            disabled={!email.includes('@') || enviando}
            onClick={() => void enviar()}
            className="mb-6"
          >
            Enviar link
          </Button>
        </div>
      )}
    </div>
  );
}
