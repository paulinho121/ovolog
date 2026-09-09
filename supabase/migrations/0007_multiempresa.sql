-- OVOLOG — uma base, várias distribuidoras.
--
-- Cada distribuidora opera isolada: enxerga só os próprios clientes, produtos,
-- fornecedores, pedidos e financeiro. O isolamento é feito por RLS no banco,
-- não por filtro na aplicação — filtro de aplicação se esquece numa tela nova;
-- política de banco vale para toda consulta, inclusive as que ainda não
-- existem.
--
-- Acima das distribuidoras existe o admin de plataforma: quem cria uma
-- distribuidora nova e o primeiro gestor dela.
--
-- LEIA ANTES DE RODAR. Esta migração:
--   1. cria `distribuidoras` e `plataforma_admins`;
--   2. acrescenta `distribuidora_id` nas 21 tabelas;
--   3. joga TUDO que já existe numa distribuidora inicial;
--   4. reescreve todas as políticas de RLS.
--
-- Entre o passo 4 e você se cadastrar como admin de plataforma (instruções no
-- fim), a operação continua funcionando normalmente — os dados de hoje
-- pertencem à distribuidora inicial e sua equipe continua enxergando tudo.

begin;

-- =====================================================================
-- 1. Distribuidoras e admins de plataforma
-- =====================================================================

create table if not exists distribuidoras (
  id            text primary key default novo_id(),
  nome          text not null,
  documento     text not null default '',
  telefone      text not null default '',
  cidade        text not null default '',
  -- Desligar uma distribuidora sem apagar o histórico dela.
  ativa         boolean not null default true,
  criada_em     timestamptz not null default now()
);

comment on table distribuidoras is
  'Empresas que usam o OVOLOG. Cada linha é um tenant isolado por RLS.';

-- O admin de plataforma NÃO é um usuário de nenhuma distribuidora: ele opera o
-- produto, não a distribuição de ovos. Por isso vive em tabela própria, e não
-- como um papel em `usuarios` — assim `usuarios.distribuidora_id` pode ser
-- obrigatório, que é a garantia que torna o RLS confiável.
create table if not exists plataforma_admins (
  auth_id   uuid primary key references auth.users(id) on delete cascade,
  nome      text not null default '',
  criado_em timestamptz not null default now()
);

comment on table plataforma_admins is
  'Quem administra o produto: cria distribuidoras e o primeiro gestor de cada.';

-- =====================================================================
-- 2. Coluna de tenant em todas as tabelas de operação
-- =====================================================================

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
    execute format(
      'alter table %I add column if not exists distribuidora_id text references distribuidoras(id) on delete restrict',
      t
    );
    -- Índice em toda tabela: TODA consulta passa a filtrar por esta coluna, é
    -- o caminho mais quente do banco.
    execute format(
      'create index if not exists %I on %I (distribuidora_id)',
      t || '_distribuidora_idx', t
    );
  end loop;
end $$;

-- =====================================================================
-- 3. Adotar o que já existe
-- =====================================================================

-- Tudo que está no banco hoje vira a primeira distribuidora. Se o banco estiver
-- vazio, isto cria a distribuidora mesmo assim — ela serve de destino para a
-- carga inicial.
insert into distribuidoras (id, nome)
select 'dist-inicial', 'Distribuidora inicial'
where not exists (select 1 from distribuidoras);

do $$
declare
  t text;
  primeira text;
begin
  select id into primeira from distribuidoras order by criada_em limit 1;

  foreach t in array array[
    'usuarios','produtos','fornecedores','clientes','veiculos','estoque',
    'lotes','movimentacoes_estoque','rotas','rota_carga','rota_paradas',
    'pedidos','pedido_itens','rota_parada_pedidos','ocorrencias','devolucoes',
    'contas','caixa_lancamentos','compras','compra_itens','notificacoes'
  ]
  loop
    execute format('update %I set distribuidora_id = %L where distribuidora_id is null', t, primeira);
    -- Só agora vira obrigatória: com a coluna já preenchida, nenhuma linha
    -- órfã pode nascer daqui em diante.
    execute format('alter table %I alter column distribuidora_id set not null', t);
  end loop;
end $$;

-- =====================================================================
-- 4. Quem sou eu, de qual distribuidora
-- =====================================================================

-- `security definer` de propósito: estas funções são consultadas DENTRO das
-- políticas, inclusive na política da própria tabela `usuarios`. Se lessem sob
-- RLS, a política chamaria a si mesma. Nenhuma delas recebe parâmetro nem
-- devolve dado de outra pessoa.

create or replace function minha_distribuidora()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select distribuidora_id from usuarios where auth_id = auth.uid();
$$;

create or replace function sou_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from plataforma_admins where auth_id = auth.uid());
$$;

-- =====================================================================
-- 5. Preenchimento automático do tenant
-- =====================================================================

-- Sem isto, cada INSERT do app teria que mandar `distribuidora_id`, e bastaria
-- UMA tela esquecer para a linha nascer órfã. O gatilho torna o vínculo uma
-- garantia do banco, e não uma disciplina da aplicação.
create or replace function preencher_distribuidora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.distribuidora_id is null then
    new.distribuidora_id := minha_distribuidora();
  end if;
  return new;
end;
$$;

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
    execute format('drop trigger if exists %I on %I', 'trg_distribuidora_' || t, t);
    execute format(
      'create trigger %I before insert on %I for each row execute function preencher_distribuidora()',
      'trg_distribuidora_' || t, t
    );
  end loop;
end $$;

-- =====================================================================
-- 6. Políticas
-- =====================================================================

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
    -- Fora as da migração anterior, que davam acesso a toda a base.
    execute format('drop policy if exists "equipe_le" on %I', t);
    execute format('drop policy if exists "equipe_grava" on %I', t);
    execute format('drop policy if exists "equipe_altera" on %I', t);

    -- A linha só existe para quem é da mesma distribuidora.
    --
    -- `minha_distribuidora()` devolve null para quem não está em `usuarios`, e
    -- em SQL `distribuidora_id = null` nunca é verdadeiro — então uma conta
    -- sem vínculo não enxerga nada, sem precisar de cláusula extra.
    execute format(
      'create policy "tenant_le" on %I for select to authenticated
         using (distribuidora_id = minha_distribuidora() or sou_admin_plataforma())',
      t
    );
    execute format(
      'create policy "tenant_grava" on %I for insert to authenticated
         with check (distribuidora_id = minha_distribuidora() or sou_admin_plataforma())',
      t
    );
    execute format(
      'create policy "tenant_altera" on %I for update to authenticated
         using (distribuidora_id = minha_distribuidora() or sou_admin_plataforma())
         with check (distribuidora_id = minha_distribuidora() or sou_admin_plataforma())',
      t
    );
  end loop;
end $$;

-- Continua sem delete em nenhuma tabela: não há tela de exclusão, e histórico
-- de operação não se apaga. Sem política, o Postgres nega.

-- Dentro da distribuidora, as regras de papel da migração anterior continuam
-- valendo: só gestor mexe em equipe e em preço.
drop policy if exists "tenant_altera" on usuarios;
create policy "tenant_altera" on usuarios
  for update to authenticated
  using (
    sou_admin_plataforma()
    or (distribuidora_id = minha_distribuidora() and (sou_gestor() or auth_id = auth.uid()))
  )
  with check (
    sou_admin_plataforma()
    or (distribuidora_id = minha_distribuidora() and (sou_gestor() or auth_id = auth.uid()))
  );

drop policy if exists "tenant_grava" on usuarios;
create policy "tenant_grava" on usuarios
  for insert to authenticated
  with check (
    sou_admin_plataforma()
    or (distribuidora_id = minha_distribuidora() and sou_gestor())
  );

drop policy if exists "tenant_altera" on produtos;
create policy "tenant_altera" on produtos
  for update to authenticated
  using (sou_admin_plataforma() or (distribuidora_id = minha_distribuidora() and sou_gestor()))
  with check (sou_admin_plataforma() or (distribuidora_id = minha_distribuidora() and sou_gestor()));

-- =====================================================================
-- 7. RLS das tabelas novas
-- =====================================================================

alter table distribuidoras enable row level security;
alter table plataforma_admins enable row level security;

-- A equipe lê a própria distribuidora (o nome aparece no cabeçalho do app);
-- o admin de plataforma lê e administra todas.
create policy "le_a_minha" on distribuidoras
  for select to authenticated
  using (id = minha_distribuidora() or sou_admin_plataforma());

create policy "admin_cria" on distribuidoras
  for insert to authenticated with check (sou_admin_plataforma());

create policy "admin_altera" on distribuidoras
  for update to authenticated using (sou_admin_plataforma()) with check (sou_admin_plataforma());

-- Quem é admin de plataforma só é visível para admins de plataforma. Uma
-- distribuidora não precisa saber quem opera o produto.
create policy "admin_le" on plataforma_admins
  for select to authenticated using (sou_admin_plataforma());

commit;

-- =====================================================================
-- 8. Depois de rodar
-- =====================================================================
--
-- (a) Vire admin de plataforma. Use o mesmo acesso que você já criou no 0006,
--     ou crie um separado em Authentication → Users:
--
--       insert into plataforma_admins (auth_id, nome)
--       values ('SEU-UUID-DO-AUTH', 'Seu nome');
--
--     ATENÇÃO: o admin de plataforma enxerga a operação de TODAS as
--     distribuidoras — é o que permite dar suporte, e é uma decisão de
--     privacidade que vale ter consciente. Para restringir, tire
--     `sou_admin_plataforma()` das políticas de `select` das tabelas de
--     operação: ele continua criando distribuidoras sem ler o dado delas.
--
-- (b) Confira o isolamento (deve devolver uma linha por distribuidora,
--     nenhuma com distribuidora_id nulo):
--
--       select d.nome,
--              (select count(*) from clientes  c where c.distribuidora_id = d.id) clientes,
--              (select count(*) from pedidos   p where p.distribuidora_id = d.id) pedidos,
--              (select count(*) from usuarios  u where u.distribuidora_id = d.id) equipe
--         from distribuidoras d order by d.criada_em;
--
-- (c) Distribuidora nova, pelo app (Plataforma → Nova distribuidora) ou daqui:
--
--       insert into distribuidoras (nome, cidade) values ('Granja X', 'Bauru - SP');
--       -- depois crie o acesso do gestor dela em Authentication → Users e:
--       insert into usuarios (nome, papel, email, iniciais, auth_id, distribuidora_id)
--       values ('Nome', 'gestor', 'email@x.com.br', 'NN', 'UUID-DO-AUTH',
--               (select id from distribuidoras where nome = 'Granja X'));
--
-- Para desfazer tudo (só antes de existir uma segunda distribuidora):
--
--   -- as políticas voltam ao 0006 e as colunas saem
--   -- alter table clientes drop column distribuidora_id;  (e assim por diante)
