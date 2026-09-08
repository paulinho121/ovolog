# OVOLOG

Gestão inteligente para distribuição de ovos.

Aplicativo **mobile-first** para a operação de uma distribuidora: compras →
estoque → clientes → pedidos → cargas → rotas → GPS → entregas →
recebimentos → financeiro → frota → relatórios.

O smartphone é o dispositivo principal, não uma adaptação: as telas foram
desenhadas para 390×844, operação com uma mão e uso dentro de um veículo.

## Como rodar

Requer Node 22 (ver `.nvmrc`).

```
cp .env.example .env   # preencha com os dados do seu projeto Supabase
npm install
npm run dev
```

Sem o `.env` preenchido o app abre numa tela explicando o que falta, em vez
de quebrar.

Abre em http://localhost:3000, também acessível pela rede local — útil para
testar num celular de verdade, que é onde o app deve ser avaliado.

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build |
| `npm run lint` | Checagem de tipos (`tsc --noEmit`) |

## Como experimentar

A tela de acesso deixa escolher o perfil, porque **a Home muda conforme quem
entra**: vendedor e motorista abrem na rota do dia; gestor, nos indicadores e
no mapa da operação; estoque, compras e financeiro, nos seus próprios números.

O caminho mais representativo é o do vendedor:

1. Entre como **João (vendedor)** → *Iniciar rota* → *Iniciar rota*.
2. O mapa abre e o veículo começa a se aproximar da primeira parada. Em ~10
   segundos o botão principal vira **“Você chegou — fazer check-in”**.
3. Check-in → atendimento → *Ver pedidos* → marque “Cliente recebeu” →
   **Confirmar entrega** → comprovante → *Finalizar visita*.
4. Você volta ao mapa com a parada 1 concluída e a 2 na fila.

Para ver o comportamento sem sinal: **Mais → Configurações → Simular modo
offline**. Tudo continua funcionando e o header passa a contar as alterações
pendentes; “Sincronizar” esvazia a fila.

## Decisões que moldaram o produto

**Uma ação principal por tela, sempre embaixo.** A barra de ação fixa
(`StickyAction`) fica acima da navegação inferior, ao alcance do polegar.
Alvos de toque nunca abaixo de 44px; botões de ação com 48–56px.

**Bottom sheets no lugar de telas e modais.** Escolher cliente, produto,
fornecedor, forma de pagamento, filtros e confirmações acontecem sobre a tela
atual, preservando o contexto.

**A navegação é uma pilha em memória, sem URL.** Isso mantém o contexto do
usuário e torna o “voltar” previsível a partir de qualquer profundidade.

**Bundle único, de propósito.** As telas não são carregadas sob demanda: um
chunk que falha numa área sem cobertura interromperia a rota no meio. Só as
dependências saem separadas, para cache entre deploys (ver `vite.config.ts`).

**Nenhuma animação decide se o conteúdo aparece.** As transições animam
deslocamento, nunca opacidade — se a animação não terminar (aba em segundo
plano congela o `requestAnimationFrame`), o pior caso é um conteúdo legível
deslocado alguns pixels, não uma tela em branco.

**Offline é o estado normal, não a exceção.** Toda mutação passa por um único
ponto no store (`commit`), que é onde a fila de pendências vive — nenhuma tela
precisa saber se há conexão.

## Mapa e GPS

Não há provedor de mapas. `MapCanvas` desenha em SVG num plano 0–100: malha
viária, traçado da rota (sólido no que já foi, tracejado no que falta),
paradas numeradas, veículos e a posição atual pulsante. O deslocamento é
simulado por um `setInterval` no store, e o check-in só libera dentro do raio
de chegada.

Trocar por um mapa real significa substituir **um componente**: as
coordenadas `x`/`y` viram latitude/longitude e o resto do app não muda.

## Cores dos gráficos

Séries únicas usam a cor da marca (`#C2560A`, contraste 4,6:1 sobre branco).
Onde há mais de uma série, a paleta é `#2a78d6 / #eb6834 / #1baf7a`, validada
para daltonismo e contraste, sempre acompanhada de rótulo escrito — a cor
nunca é a única forma de distinguir. Os gráficos são SVG próprio, sem
biblioteca.

## Estrutura

```
src/
  App.tsx                registro das 45 telas + shell (mobile e desktop)
  index.css              design system: tokens, tipografia, área segura
  types.ts               modelos de domínio
  data/
    repositorio.ts       ÚNICA fronteira com o banco (SQL ↔ tipos do domínio)
    catalog.ts           cadastros de referência, hidratados do banco no boot
  store/
    navigation.tsx       pilha de navegação e abas
    app.tsx              operação, carrinho, GPS simulado, fila offline
  lib/
    supabase.ts          cliente
    domain.ts            regras de cálculo (totais, progresso, estoque)
    format.ts            formatação pt-BR
  components/
    ui/                  botões, campos, sheets, estados, swipe
    layout/chrome.tsx    header, app bar, navegação inferior, barra de ação
    map/MapCanvas.tsx    mapa (Leaflet + OpenStreetMap)
    map/BuscaEndereco.tsx  localiza o endereço do cliente
    charts/              gráficos em SVG
    domain.tsx           cards com significado de negócio
  screens/               telas agrupadas por domínio
    desktop/             layouts de retaguarda (tabelas, master-detail)
  components/desktop/    primitivas de desktop (tabela, painel, indicador)
  lib/viewport.ts        detecção de desktop (>= 1024px)

supabase/migrations/     schema e cadastros (SQL versionado)
```

## Desktop

A partir de 1024px o app tem **duas caras, por decisão de produto**:

**Retaguarda ganha a janela inteira.** Dashboard, Clientes, Pedidos, Estoque,
Compras, Financeiro e Relatórios têm layout próprio de desktop: tabelas
ordenáveis com cabeçalho fixo, detalhe abrindo ao lado da lista e gráficos
grandes lado a lado. São telas de quem trabalha sentado, com mouse e teclado.

**Campo continua na coluna do aparelho.** Check-in, entrega, ocorrência,
devolução, mapa da rota e fechamento não ganham versão desktop — nem num
monitor. São fluxos de quem está em pé, na porta do cliente; esticá-los não
os tornaria melhores, só maiores. No desktop eles aparecem na coluna de
420px, com a sidebar ao lado e um painel de contexto com o mapa ao vivo.

A regra está em `DESKTOP` no `App.tsx`: o que está no mapa tem tela de
desktop, o que não está usa a tela mobile. A Home é a única exceção — só o
**gestor** abre em dashboard; vendedor e motorista abrem na rota do dia.

**Nenhuma regra de negócio é duplicada.** As telas de desktop leem o mesmo
store e as mesmas funções de `lib/domain.ts`; o que muda é só a apresentação.
Elas também usam os mesmos tokens do design system — mesma cor de marca,
mesmos status, mesmos raios — em densidade maior (linhas de 40px, texto de
13px, hover, que no celular não existe).

O ganho real do master-detail não é caber mais linha: é **não perder a lista
ao abrir um item**, que é exatamente o que a navegação em pilha do celular
necessariamente custa.

## Banco de dados

Os dados vivem num Postgres no **Supabase** — 21 tabelas em `public`, criadas
por `supabase/migrations/0001_reset_e_schema.sql`.

As migrações rodam no SQL Editor do Supabase, em ordem:

| Arquivo | O que faz |
| --- | --- |
| `0001_reset_e_schema.sql` | Recria o schema `public` inteiro: tipos, 21 tabelas, índices, RLS |
| `0003_zerar_dados_demo.sql` | Esvazia todas as tabelas. Irreversível |
| `0004_dados_reais.sql` | Cadastros da operação — **modelo para preencher** |

O `0002_seed.sql`, que carregava a demonstração, foi removido: ele começava
com um `truncate` de tudo, e reaplicar as migrações em ordem apagaria dados
reais para repor os falsos. Está no histórico do git se precisar consultar.

### Cadastros que só entram por SQL

`usuarios`, `produtos`, `fornecedores` e `veiculos` não têm tela de cadastro:
o app só lê essas quatro tabelas. Mudar um preço, contratar um motorista ou
comprar um veículo é editar o `0004` e rodar. Cliente é a exceção — tem
formulário em Clientes → Cadastrar cliente.

Todo produto precisa da linha correspondente em `estoque`. O app só faz
`update` ali; sem a linha, a movimentação de estoque **falha em silêncio** —
o PostgREST devolve sucesso para um update que não encontrou nada. O `0004`
cria as linhas que faltarem.

### Como o app conversa com o banco

```
telas → store (estado em memória) → commit() → repositório → Supabase
                                        ↓
                                  fila offline
```

**A leitura é uma só, no boot.** `carregarEstado()` traz tudo de uma vez e o
app opera em memória a partir daí — coerente com o uso em rota, onde ficar
consultando o servidor a cada tela é justamente o que não funciona.

**A escrita passa toda pelo `commit`.** Ele aplica a mudança na tela na hora e
manda para o banco em seguida. Se a gravação falhar — ou o aparelho estiver
offline — a operação entra numa fila e é reenviada **em ordem** quando a
conexão volta (a ordem importa: o item do pedido não pode ser gravado antes do
pedido). Nenhuma tela precisa saber se há conexão.

`src/data/repositorio.ts` é a única fronteira que conhece nomes de coluna.
Trocar o backend significa reescrever esse arquivo, e mais nada.

### Segurança

O RLS está **ligado em todas as tabelas**, mas com políticas de demonstração
que liberam tudo para a chave anônima — porque o app ainda não tem
autenticação real (a tela de acesso é um seletor de perfil).

**Isso não pode ir para produção.** Ao entrar Supabase Auth, troque `to anon`
por `to authenticated` e escreva a regra de cada tabela (ex.: um motorista só
enxerga as rotas dele). O mecanismo já está ativo justamente para essa troca
ser editar política, e não habilitar RLS com o banco em uso.

A chave `anon` é pública e vai no bundle — é o RLS que protege os dados, não
o sigilo dela. A `service_role` nunca deve aparecer no cliente.

## Mapa

Leaflet sobre tiles do OpenStreetMap. O provedor está isolado em
`src/lib/mapa.ts` — trocar por Google, MapTiler ou Mapbox é mexer nesse
arquivo e em `MapCanvas.tsx`; nenhuma das oito telas que mostram mapa sabe
qual provedor existe por baixo.

**O servidor público de tiles do OSM é infraestrutura doada e a política de
uso dele não cobre uso comercial pesado.** Para uma frota pequena o volume
passa despercebido; conforme crescer, o caminho é um provedor com chave
(MapTiler e Stadia têm plano gratuito) ou o Google. São duas linhas em
`mapa.ts`. A atribuição na tela é condição da licença ODbL: pode encolher,
não pode sumir.

### Coordenadas

`clientes.lat/lng` e `veiculos.lat/lng` são latitude e longitude reais.
Nulo quer dizer "endereço ainda não geocodificado": o cliente fica fora do
mapa e continua na lista — nunca é plotado num ponto aproximado.

O endereço vira coordenada no cadastro do cliente, via
[Nominatim](https://nominatim.openstreetmap.org), o geocodificador do próprio
OSM: sem chave, no máximo uma busca por segundo. Quem cadastra **escolhe**
entre os resultados em vez de o app assumir o primeiro — fora das capitais o
Nominatim erra bastante, e um acerto silencioso na rua errada custa uma
viagem perdida.

### GPS

`navigator.geolocation.watchPosition`, ligado só durante rota em andamento —
rastrear fora do expediente seria vigiar, e gastaria bateria à toa.

Sem GPS (túnel, galpão, permissão negada) a tela avisa e **a chegada passa a
ser confirmada manualmente**. Bloquear a entrega porque o sinal caiu pararia a
operação por um detalhe de tecnologia.

A distância mostrada é em linha reta (haversine), sempre menor que o caminho
pela rua. Serve para liberar o check-in, não para prometer horário.

## Limites desta versão

- **A fila offline vive na memória.** Recarregar a página com alterações
  pendentes perde a fila. Para offline de verdade ela precisa ir para
  IndexedDB.
- **Sem autenticação real** e, portanto, sem RLS de verdade (ver acima).
- **Sem tempo real nem resolução de conflito**: dois aparelhos editando o
  mesmo pedido, o último a gravar vence. O Supabase oferece Realtime para
  isso quando fizer sentido.
- Um pedido criado durante uma visita fica ligado à rota, mas não à parada —
  ele não aparece na lista daquela parada específica.
- **O traçado da rota liga as paradas em linha reta**, não pelo caminho das
  ruas, e a ordem das paradas é a que foi cadastrada — não há otimização de
  rota. As duas coisas pedem um serviço de rotas (o Google e o Mapbox têm).
- PIX, envio de comprovante e manutenção de frota são a experiência visual do
  recurso, não a integração.
- Só tema claro.

## Deploy (Vercel)

O projeto já está configurado: `vercel.json` fixa framework, comandos e saída,
e o `package.json` fixa o Node em `22.x`. Cada `git push` gera um deploy.

1. **Importe o repositório** em vercel.com → *Add New… → Project*. As
   configurações de build vêm do `vercel.json`, não mexa nelas na interface.
2. **Cadastre as variáveis** em *Settings → Environment Variables*, marcando
   Production, Preview e Development:

   | Variável | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | URL do projeto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | chave `anon` |

   Elas são lidas **no build**, não em execução: mudar uma delas exige um
   novo deploy (*Deployments → ⋯ → Redeploy*) para valer. Sem elas o app sobe
   e abre na tela explicando o que falta.

   Continua valendo a regra do `.env`: só a chave `anon` aqui. A
   `service_role` ignora RLS e não pode ir para um bundle de navegador.
3. **Aponte o Supabase para o domínio** em *Authentication → URL
   Configuration*, quando entrar autenticação de verdade.

O `vercel.json` também manda toda rota desconhecida para o `index.html` (o app
é uma SPA, o roteamento é do cliente) e marca `/assets/*` como imutável — os
nomes desses arquivos já carregam hash, então o navegador pode guardá-los para
sempre e só rebaixa o que mudou.
