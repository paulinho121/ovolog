/// <reference types="vite/client" />

/* Variáveis de ambiente do cliente. Só o que tem prefixo VITE_ chega ao
   navegador — é o que impede uma chave de servidor de vazar no bundle. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
