import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          /* Só as dependências saem em chunk separado, para o navegador
             reaproveitá-las entre deploys.

             As telas ficam DE PROPÓSITO no mesmo bundle: o app é usado em
             rota, com sinal instável, e um chunk carregado sob demanda que
             falha numa área sem cobertura interromperia a operação no meio.
             Baixar tudo de uma vez, ainda no depósito, é o comportamento
             certo aqui. */
          manualChunks: {
            vendor: [
              'react',
              'react-dom',
              'motion',
              'lucide-react',
              '@supabase/supabase-js',
              'leaflet',
            ],
          },
        },
      },
      // O bundle único é intencional (ver acima) — o aviso padrão não se aplica.
      chunkSizeWarningLimit: 700,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
