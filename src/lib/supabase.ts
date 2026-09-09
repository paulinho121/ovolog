import { createClient } from '@supabase/supabase-js';

/* Cliente Supabase.
 *
 * A chave anônima é pública por natureza: ela vai no bundle que o navegador
 * baixa. O que protege os dados é o Row Level Security no banco, nunca o
 * sigilo dessa chave. A `service_role` (que ignora RLS) jamais pode chegar
 * aqui — ela só existe do lado do servidor.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Falso quando o `.env` não foi preenchido — o app avisa em vez de quebrar. */
export const supabaseConfigurado = Boolean(url && anonKey);

export const supabase = createClient(
  url ?? 'https://exemplo.supabase.co',
  anonKey ?? 'chave-ausente',
  {
    auth: {
      // A sessão fica no aparelho: quem trabalha em rota não pode ter que
      // digitar senha a cada vez que o navegador é reciclado em segundo plano.
      persistSession: true,
      // O token de acesso é curto; sem renovação automática o app deslogaria
      // no meio do dia, que em campo é o pior momento possível.
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
