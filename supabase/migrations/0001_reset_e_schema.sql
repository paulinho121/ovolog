-- OVOLOG — reset do banco e schema da operação.
--
-- Executado no projeto Supabase nrujrvwkgvlukcfeqwey.
-- Reaplicar este arquivo do zero é seguro: ele recria o schema public inteiro.

-- =====================================================================
-- 1. Reset
-- =====================================================================
-- Nenhuma extensão vive em `public` neste projeto (todas estão em
-- `extensions`, `graphql` e `vault`), então derrubar o schema não leva
-- nada junto além das tabelas da aplicação.

drop schema if exists public cascade;
create schema public;

grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;

-- =====================================================================
-- 2. Tipos
-- =====================================================================

create type papel_usuario as enum
  ('vendedor', 'motorista', 'estoque', 'compras', 'financeiro', 'gestor');

create type status_cliente as enum ('ativo', 'inativo', 'inadimplente', 'novo');

create type status_pedido as enum
  ('rascunho', 'confirmado', 'em_rota', 'entregue', 'cancelado');

create type forma_pagamento as enum ('pix', 'dinheiro', 'cartao', 'prazo');

create type status_rota as enum ('planejada', 'em_andamento', 'finalizada');

create type status_parada as enum
  ('pendente', 'a_caminho', 'chegou', 'concluida', 'nao_atendida');

create type status_veiculo as enum ('em_rota', 'disponivel', 'manutencao');

create type tipo_movimentacao as enum
  ('entrada', 'saida', 'transferencia', 'perda', 'inventario');

create type tipo_ocorrencia as enum
  ('cliente_fechado', 'cliente_ausente', 'pedido_recusado', 'produto_faltando',
   'produto_avariado', 'devolucao', 'problema_pagamento', 'outro');

create type motivo_devolucao as enum
  ('avaria', 'recusa', 'excesso', 'erro_pedido', 'outro');

create type tipo_conta as enum ('receber', 'pagar');

create type status_conta as enum ('a_vencer', 'vencido', 'pago');

create type tipo_compra as enum ('aberta', 'recebida', 'cancelada');

create type tipo_notificacao as enum ('critico', 'atencao', 'info', 'sucesso');

-- Ids são texto porque o app já nasceu com identificadores legíveis
-- ('c1', 'p3', 'r1'). Registros novos recebem um uuid.
create or replace function novo_id() returns text
  language sql volatile as $$ select gen_random_uuid()::text $$;

-- =====================================================================
-- 3. Cadastros
-- =====================================================================

create table usuarios (
  id            text primary key default novo_id(),
  nome          text not null,
  papel         papel_usuario not null,
  telefone      text not null default '',
  email         text not null,
  iniciais      text not null,
  veiculo_id    text,
  criado_em     timestamptz not null default now()
);

create table produtos (
  id                text primary key default novo_id(),
  nome              text not null,
  tipo              text not null,
  preco             numeric(12,2) not null check (preco >= 0),
  custo             numeric(12,2) not null check (custo >= 0),
  unidade           text not null default 'caixa',
  duzias_por_caixa  integer not null check (duzias_por_caixa > 0),
  emoji             text not null default '🥚',
  criado_em         timestamptz not null default now()
);

create table fornecedores (
  id         text primary key default novo_id(),
  nome       text not null,
  documento  text not null default '',
  telefone   text not null default '',
  cidade     text not null default '',
  criado_em  timestamptz not null default now()
);

create table clientes (
  id                   text primary key default novo_id(),
  nome                 text not null,
  nome_fantasia        text not null,
  documento            text not null default '',
  telefone             text not null default '',
  bairro               text not null default '',
  endereco             text not null default '',
  status               status_cliente not null default 'novo',
  saldo                numeric(12,2) not null default 0,
  limite_credito       numeric(12,2) not null default 0,
  total_comprado       numeric(14,2) not null default 0,
  condicao_pagamento   text not null default 'À vista',
  -- Coordenadas no plano 0–100 do mapa estilizado. Viram lat/lng quando
  -- entrar um provedor de mapas de verdade.
  x                    numeric(6,2) not null default 50,
  y                    numeric(6,2) not null default 50,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create table veiculos (
  id                 text primary key default novo_id(),
  nome               text not null,
  placa              text not null,
  modelo             text not null default '',
  motorista_id       text references usuarios(id) on delete set null,
  status             status_veiculo not null default 'disponivel',
  capacidade_caixas  integer not null default 0,
  odometro           integer not null default 0,
  km_hoje            integer not null default 0,
  x                  numeric(6,2) not null default 50,
  y                  numeric(6,2) not null default 50,
  rota_id            text,
  ultima_manutencao  date,
  nivel_combustivel  numeric(4,3) not null default 1 check (nivel_combustivel between 0 and 1)
);

alter table usuarios
  add constraint usuarios_veiculo_fk
  foreign key (veiculo_id) references veiculos(id) on delete set null;

-- =====================================================================
-- 4. Estoque
-- =====================================================================

create table estoque (
  produto_id  text primary key references produtos(id) on delete cascade,
  em_maos     integer not null default 0 check (em_maos >= 0),
  reservado   integer not null default 0 check (reservado >= 0),
  minimo      integer not null default 0
);

create table lotes (
  id             text primary key default novo_id(),
  produto_id     text not null references produtos(id) on delete cascade,
  codigo         text not null,
  validade       date not null,
  caixas         integer not null check (caixas >= 0),
  fornecedor_id  text references fornecedores(id) on delete set null
);
create index lotes_produto_validade_idx on lotes (produto_id, validade);

create table movimentacoes_estoque (
  id           text primary key default novo_id(),
  tipo         tipo_movimentacao not null,
  produto_id   text not null references produtos(id) on delete cascade,
  caixas       integer not null,
  observacao   text not null default '',
  usuario      text not null default '',
  em           timestamptz not null default now()
);
create index movimentacoes_produto_idx on movimentacoes_estoque (produto_id, em desc);

-- =====================================================================
-- 5. Rotas
-- =====================================================================

create table rotas (
  id                 text primary key default novo_id(),
  numero             text not null,
  motorista_id       text references usuarios(id) on delete set null,
  veiculo_id         text references veiculos(id) on delete set null,
  status             status_rota not null default 'planejada',
  data               date not null default current_date,
  distancia_km       numeric(8,2) not null default 0,
  minutos_estimados  integer not null default 0,
  iniciada_em        timestamptz,
  finalizada_em      timestamptz
);

alter table veiculos
  add constraint veiculos_rota_fk
  foreign key (rota_id) references rotas(id) on delete set null;

create table rota_carga (
  rota_id     text not null references rotas(id) on delete cascade,
  produto_id  text not null references produtos(id) on delete cascade,
  caixas      integer not null check (caixas >= 0),
  primary key (rota_id, produto_id)
);

create table rota_paradas (
  id            text primary key default novo_id(),
  rota_id       text not null references rotas(id) on delete cascade,
  cliente_id    text not null references clientes(id) on delete cascade,
  sequencia     integer not null,
  status        status_parada not null default 'pendente',
  distancia_km  numeric(8,2) not null default 0,
  eta_minutos   integer not null default 0,
  chegou_em     timestamptz,
  concluida_em  timestamptz,
  unique (rota_id, sequencia)
);
create index rota_paradas_rota_idx on rota_paradas (rota_id, sequencia);

-- =====================================================================
-- 6. Pedidos
-- =====================================================================

create table pedidos (
  id           text primary key default novo_id(),
  numero       text not null,
  cliente_id   text not null references clientes(id) on delete restrict,
  desconto     numeric(12,2) not null default 0 check (desconto >= 0),
  status       status_pedido not null default 'confirmado',
  pagamento    forma_pagamento not null default 'pix',
  vencimento   date,
  parcelas     integer,
  vendedor_id  text references usuarios(id) on delete set null,
  rota_id      text references rotas(id) on delete set null,
  criado_em    timestamptz not null default now(),
  -- Prazo é a única forma que gera vencimento; o banco não deixa sair sem.
  constraint pedido_prazo_tem_vencimento
    check (pagamento <> 'prazo' or vencimento is not null)
);
create index pedidos_cliente_idx on pedidos (cliente_id, criado_em desc);
create index pedidos_criado_idx on pedidos (criado_em desc);
create index pedidos_rota_idx on pedidos (rota_id);

create table pedido_itens (
  id              text primary key default novo_id(),
  pedido_id       text not null references pedidos(id) on delete cascade,
  produto_id      text not null references produtos(id) on delete restrict,
  quantidade      integer not null check (quantidade > 0),
  preco_unitario  numeric(12,2) not null check (preco_unitario >= 0),
  unique (pedido_id, produto_id)
);
create index pedido_itens_pedido_idx on pedido_itens (pedido_id);

-- Uma parada pode ter vários pedidos, e um pedido pode ser reprogramado
-- para outra parada — daí a tabela de ligação.
create table rota_parada_pedidos (
  parada_id  text not null references rota_paradas(id) on delete cascade,
  pedido_id  text not null references pedidos(id) on delete cascade,
  primary key (parada_id, pedido_id)
);

-- =====================================================================
-- 7. Campo
-- =====================================================================

create table ocorrencias (
  id          text primary key default novo_id(),
  tipo        tipo_ocorrencia not null,
  cliente_id  text references clientes(id) on delete set null,
  rota_id     text references rotas(id) on delete set null,
  observacao  text not null default '',
  em          timestamptz not null default now()
);
create index ocorrencias_cliente_idx on ocorrencias (cliente_id, em desc);

create table devolucoes (
  id          text primary key default novo_id(),
  cliente_id  text references clientes(id) on delete set null,
  rota_id     text references rotas(id) on delete set null,
  produto_id  text not null references produtos(id) on delete restrict,
  caixas      integer not null check (caixas > 0),
  motivo      motivo_devolucao not null,
  em          timestamptz not null default now()
);
create index devolucoes_rota_idx on devolucoes (rota_id);

-- =====================================================================
-- 8. Financeiro
-- =====================================================================

create table contas (
  id          text primary key default novo_id(),
  tipo        tipo_conta not null,
  parte_id    text not null,
  parte_nome  text not null,
  valor       numeric(12,2) not null check (valor >= 0),
  valor_pago  numeric(12,2) not null default 0 check (valor_pago >= 0),
  vencimento  date not null,
  status      status_conta not null default 'a_vencer',
  pedido_id   text references pedidos(id) on delete set null,
  metodo      forma_pagamento,
  criado_em   timestamptz not null default now(),
  constraint conta_nao_paga_demais check (valor_pago <= valor)
);
create index contas_tipo_venc_idx on contas (tipo, vencimento);

create table caixa_lancamentos (
  id         text primary key default novo_id(),
  descricao  text not null,
  valor      numeric(12,2) not null check (valor >= 0),
  direcao    text not null check (direcao in ('in', 'out')),
  metodo     forma_pagamento not null,
  em         timestamptz not null default now()
);
create index caixa_em_idx on caixa_lancamentos (em desc);

-- =====================================================================
-- 9. Compras
-- =====================================================================

create table compras (
  id             text primary key default novo_id(),
  numero         text not null,
  fornecedor_id  text references fornecedores(id) on delete set null,
  status         tipo_compra not null default 'aberta',
  criado_em      timestamptz not null default now(),
  previsto_para  date
);

create table compra_itens (
  id             text primary key default novo_id(),
  compra_id      text not null references compras(id) on delete cascade,
  produto_id     text not null references produtos(id) on delete restrict,
  caixas         integer not null check (caixas > 0),
  custo_unitario numeric(12,2) not null check (custo_unitario >= 0),
  codigo_lote    text not null default '',
  validade       date
);
create index compra_itens_compra_idx on compra_itens (compra_id);

-- =====================================================================
-- 10. Notificações
-- =====================================================================

create table notificacoes (
  id      text primary key default novo_id(),
  tipo    tipo_notificacao not null,
  titulo  text not null,
  corpo   text not null default '',
  lida    boolean not null default false,
  em      timestamptz not null default now()
);
create index notificacoes_em_idx on notificacoes (em desc);

-- =====================================================================
-- 11. Row Level Security
-- =====================================================================
--
-- ATENÇÃO — políticas de DEMONSTRAÇÃO.
--
-- O app ainda não tem autenticação real: a tela de acesso é um seletor de
-- perfil, e o cliente usa a chave anônima. As políticas abaixo liberam tudo
-- para `anon` justamente para isso funcionar.
--
-- ISSO NÃO PODE IR PARA PRODUÇÃO. Quando entrar Supabase Auth de verdade,
-- troque `to anon` por `to authenticated` e escreva a regra real de cada
-- tabela (ex.: um motorista só enxerga as rotas dele). O RLS fica ligado
-- desde já para que essa troca seja editar política, não habilitar o
-- mecanismo com o banco já em uso.

do $$
declare t text;
begin
  foreach t in array array[
    'usuarios','produtos','fornecedores','clientes','veiculos','estoque',
    'lotes','movimentacoes_estoque','rotas','rota_carga','rota_paradas',
    'pedidos','pedido_itens','rota_parada_pedidos','ocorrencias','devolucoes',
    'contas','caixa_lancamentos','compras','compra_itens','notificacoes'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "demo_acesso_total" on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
