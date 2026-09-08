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
      // O app ainda não usa Supabase Auth: a tela de acesso é um seletor de
      // perfil. Sem sessão para persistir nem token para renovar.
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
