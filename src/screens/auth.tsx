import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';
import { users } from '../data/catalog';
import { useApp } from '../store/app';
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
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-white/15 text-5xl backdrop-blur">
          🥚
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
  const { signIn } = useApp();
  const { navigate, reset } = useNav();
  const [userId, setUserId] = useState('u1');
  const [password, setPassword] = useState('ovolog');
  const [showPassword, setShowPassword] = useState(false);

  const selected = users.find((u) => u.id === userId)!;

  function enter() {
    signIn(userId);
    reset('home');
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="bg-brand-700 px-6 pb-10" style={{ paddingTop: 'calc(var(--safe-top) + 3rem)' }}>
        <div className="grid size-14 place-items-center rounded-2xl bg-white/15 text-3xl backdrop-blur">
          🥚
        </div>
        <h1 className="mt-4 text-display font-bold tracking-tight text-white">OVOLOG</h1>
        <p className="mt-1 text-body text-brand-100">Entre para começar a operação de hoje.</p>
      </div>

      <div className="flex-1 space-y-5 px-5 py-6">
        <Field label="E-mail">
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-shell-400" />
            <Input value={selected.email} readOnly className="pl-11" />
          </div>
        </Field>

        <Field label="Senha">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-shell-500 active:bg-shell-200"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        {/* Seletor de perfil: o protótipo abre a operação inteira, e cada
            perfil tem uma Home diferente (§54). */}
        <div>
          <span className="mb-2 block text-meta font-semibold text-shell-700">Entrar como</span>
          <div className="grid grid-cols-2 gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setUserId(u.id)}
                aria-pressed={userId === u.id}
                className={cn(
                  'flex min-h-[3.25rem] items-center gap-2.5 rounded-xl border-2 px-3 text-left transition-colors',
                  userId === u.id
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-shell-200 bg-white active:bg-shell-50',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full text-micro font-bold',
                    userId === u.id ? 'bg-brand-600 text-white' : 'bg-shell-200 text-shell-700',
                  )}
                >
                  {u.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-meta font-bold text-shell-900">
                    {u.name.split(' ')[0]}
                  </span>
                  <span className="block truncate text-micro text-shell-600">
                    {ROLE_LABEL[u.role]}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <Button size="lg" block onClick={enter} icon={<ArrowRight size={18} />}>
          Entrar
        </Button>

        <button
          onClick={() => navigate('forgot')}
          className="block w-full py-2 text-center text-body font-semibold text-brand-800"
        >
          Esqueci minha senha
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ Recuperar senha */

export function ForgotScreen() {
  const { back } = useNav();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

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
            disabled={!email.includes('@')}
            onClick={() => setSent(true)}
            className="mb-6"
          >
            Enviar link
          </Button>
        </div>
      )}
    </div>
  );
}
