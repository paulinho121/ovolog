-- Cadastros reais de UMA distribuidora, num banco multiempresa.
--
-- Substitui o 0004, que foi escrito antes da separação por tenant e por isso
-- insere sem `distribuidora_id`. Rodando pelo SQL Editor aquilo não funciona
-- mais: o gatilho preenche o tenant a partir de `auth.uid()`, que é nulo aqui
-- (o editor roda como dono do banco, não como uma pessoa logada). Sem o
-- tenant explícito, o INSERT bate no NOT NULL.
--
-- Aqui a distribuidora é escolhida uma vez, no topo, e usada em tudo.

begin;

-- =====================================================================
-- 0. Qual distribuidora
-- =====================================================================

-- Confira o nome antes de rodar:
--   select id, nome from distribuidoras order by criada_em;
create temporary table alvo as
select id from distribuidoras where nome = 'Distribuidora inicial';

-- Para de tudo se o nome não bater, em vez de gravar em lugar nenhum.
do $$
begin
  if not exists (select 1 from alvo) then
    raise exception 'Nenhuma distribuidora com esse nome. Ajuste a linha do "create temporary table alvo".';
  end if;
end $$;

-- =====================================================================
-- 1. Limpar os registros de exemplo do 0004
-- =====================================================================

-- O 0004 era um MODELO. Se ele entrou como estava, existem um usuário
-- "Nome Sobrenome" e um produto de exemplo — dado fictício ocupando o lugar
-- do real. Estas remoções falham de propósito se algo já depende deles: um
-- produto com pedido lançado não pode sumir, e o erro é o aviso.

delete from estoque where produto_id in (select id from produtos where id like '%EXEMPLO%');
delete from produtos where id like '%EXEMPLO%';
delete from usuarios where id like '%EXEMPLO%' and auth_id is null;

-- =====================================================================
-- 2. Produtos
-- =====================================================================

-- `preco` é o de venda e `custo` o de compra, em reais por caixa.
-- `duzias_por_caixa` precisa ser > 0. `tipo` é texto livre, usado para
-- agrupar em relatório.
insert into produtos (id, nome, tipo, preco, custo, unidade, duzias_por_caixa, emoji, distribuidora_id)
select v.*, (select id from alvo) from (values
  ('prod-branco-g',   'Ovo Branco Grande',   'branco',    185.00, 142.00, 'caixa', 30, '🥚'),
  ('prod-vermelho-g', 'Ovo Vermelho Grande', 'vermelho',  208.00, 161.00, 'caixa', 30, '🥚'),
  ('prod-caipira',    'Ovo Caipira',         'caipira',   264.00, 205.00, 'caixa', 20, '🐓')
  -- acrescente as suas linhas aqui
) as v(id, nome, tipo, preco, custo, unidade, duzias_por_caixa, emoji)
on conflict (id) do update set
  nome = excluded.nome, preco = excluded.preco, custo = excluded.custo;

-- OBRIGATÓRIO: uma linha de estoque por produto.
--
-- O app só faz UPDATE em `estoque`, nunca INSERT. Sem a linha, toda
-- movimentação falha em SILÊNCIO — o PostgREST devolve sucesso para um update
-- que não encontrou nada.
insert into estoque (produto_id, em_maos, reservado, minimo, distribuidora_id)
select p.id, 0, 0, 0, p.distribuidora_id
  from produtos p
 where p.distribuidora_id = (select id from alvo)
on conflict (produto_id) do nothing;

-- =====================================================================
-- 3. Fornecedores
-- =====================================================================

insert into fornecedores (id, nome, documento, telefone, cidade, distribuidora_id)
select v.*, (select id from alvo) from (values
  ('forn-1', 'Granja Santa Rita', '12345678000190', '8533330000', 'Fortaleza - CE')
  -- , ('forn-2', '...', '...', '...', '...')
) as v(id, nome, documento, telefone, cidade)
on conflict (id) do nothing;

-- =====================================================================
-- 4. Equipe
-- =====================================================================

-- papel: vendedor | motorista | estoque | compras | financeiro | gestor
--
-- `auth_id` fica nulo aqui. A conta de acesso é criada no painel
-- (Authentication → Users, com "Auto Confirm User") e ligada depois — o hash
-- da senha é feito pela API de Auth, não por SQL.
insert into usuarios (id, nome, papel, telefone, email, iniciais, distribuidora_id)
select v.*, (select id from alvo) from (values
  ('user-vendedor-1', 'Nome do Vendedor',  'vendedor',  '85999990000', 'vendedor@empresa.com.br', 'NV'),
  ('user-motorista-1','Nome do Motorista', 'motorista', '85999990001', 'motorista@empresa.com.br','NM')
) as v(id, nome, papel, telefone, email, iniciais)
on conflict (id) do nothing;

-- =====================================================================
-- 5. Veículos
-- =====================================================================

-- status: disponivel | em_rota | manutencao
-- `nivel_combustivel` vai de 0 a 1 (0.62 = 62% do tanque).
insert into veiculos (id, nome, placa, modelo, motorista_id, status,
                      capacidade_caixas, odometro, ultima_manutencao,
                      nivel_combustivel, distribuidora_id)
select v.*, (select id from alvo) from (values
  ('veic-1', 'Van 01', 'ABC-1D23', 'Renault Master', 'user-motorista-1', 'disponivel'::status_veiculo,
   220, 0, '2026-09-01'::date, 1.0)
) as v(id, nome, placa, modelo, motorista_id, status, capacidade_caixas,
       odometro, ultima_manutencao, nivel_combustivel)
on conflict (id) do nothing;

-- Fecha o vínculo dos dois lados.
update usuarios set veiculo_id = 'veic-1' where id = 'user-motorista-1';

commit;

-- =====================================================================
-- 6. Conferir
-- =====================================================================
--
-- select d.nome,
--        (select count(*) from produtos      p where p.distribuidora_id = d.id) produtos,
--        (select count(*) from estoque       e where e.distribuidora_id = d.id) estoque,
--        (select count(*) from fornecedores  f where f.distribuidora_id = d.id) fornecedores,
--        (select count(*) from usuarios      u where u.distribuidora_id = d.id) equipe,
--        (select count(*) from veiculos      v where v.distribuidora_id = d.id) veiculos,
--        (select count(*) from clientes      c where c.distribuidora_id = d.id) clientes
--   from distribuidoras d order by d.criada_em;
--
-- Quem ainda não pode entrar no app:
--
-- select nome, papel, email from usuarios where auth_id is null order by nome;
