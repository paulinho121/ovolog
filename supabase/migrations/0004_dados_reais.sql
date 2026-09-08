-- OVOLOG — cadastros reais da operação.
--
-- MODELO PARA PREENCHER. Rode depois de 0003_zerar_dados_demo.sql.
--
-- Estas quatro tabelas não têm tela de cadastro no app: elas entram por aqui.
-- Cliente, sim — dá para cadastrar pelo app, em Clientes → Cadastrar cliente.
--
-- Os `id` são texto livre. Use algo estável e legível (`prod-branco-g`,
-- `mot-carlos`), não number sequencial: eles aparecem em chave estrangeira
-- de pedido, lote e movimentação, e trocar depois dá trabalho.

begin;

-- ---------------------------------------------------------------- Equipe
-- papel: vendedor | motorista | estoque | compras | financeiro | gestor
-- `iniciais` é o que aparece no avatar. `veiculo_id` fica null aqui e é
-- preenchido no final do arquivo, depois que os veículos existirem.
insert into usuarios (id, nome, papel, telefone, email, iniciais) values
  ('u-EXEMPLO', 'Nome Sobrenome', 'gestor', '11999999999', 'email@empresa.com.br', 'NS')
  -- , ('u-...', '...', 'motorista', '...', '...', '..')
;

-- -------------------------------------------------------------- Produtos
-- `preco` é o de venda, `custo` o de compra — os dois em reais por unidade
-- de `unidade` (o app trabalha em caixa). `duzias_por_caixa` precisa ser > 0.
-- `tipo` é texto livre, usado para agrupar em relatório.
insert into produtos (id, nome, tipo, preco, custo, unidade, duzias_por_caixa, emoji) values
  ('p-EXEMPLO', 'Ovo Branco Grande', 'branco', 185.00, 142.00, 'caixa', 30, '🥚')
  -- , ('p-...', '...', '...', 0.00, 0.00, 'caixa', 30, '🥚')
;

-- ---------------------------------------------------------- Fornecedores
insert into fornecedores (id, nome, documento, telefone, cidade) values
  ('f-EXEMPLO', 'Granja Exemplo', '00000000000000', '1499999999', 'Cidade - UF')
  -- , ('f-...', '...', '...', '...', '...')
;

-- -------------------------------------------------------------- Veículos
-- status: disponivel | em_rota | manutencao
-- `nivel_combustivel` vai de 0 a 1 (0.62 = 62% do tanque).
-- x/y são a posição no mapa estilizado, num plano de 0 a 100 — não é lat/lng.
insert into veiculos (id, nome, placa, modelo, motorista_id, status,
                      capacidade_caixas, odometro, ultima_manutencao,
                      nivel_combustivel) values
  ('v-EXEMPLO', 'Van 01', 'ABC-1D23', 'Renault Master', 'u-EXEMPLO', 'disponivel',
   220, 0, '2026-09-01', 1.0)
  -- , ('v-...', '...', '...', '...', null, 'disponivel', 0, 0, null, 1.0)
;

-- Fecha o vínculo dos dois lados: o veículo aponta para o motorista acima,
-- e o motorista para o veículo.
update usuarios set veiculo_id = 'v-EXEMPLO' where id = 'u-EXEMPLO';

-- ---------------------------------------------------------------- Estoque
-- OBRIGATÓRIO: uma linha por produto.
--
-- O app só faz UPDATE em `estoque`, nunca INSERT. Sem a linha, toda
-- movimentação de estoque falha em silêncio — o PostgREST devolve sucesso
-- para um update que não achou nenhuma linha, então nem erro aparece.
--
-- Este insert cria a linha faltante de qualquer produto, com saldo zero;
-- ajuste `minimo` (ponto de alerta de reposição) por produto depois.
insert into estoque (produto_id, em_maos, reservado, minimo)
select id, 0, 0, 0 from produtos
on conflict (produto_id) do nothing;

commit;

-- Conferência:
--
-- select p.nome, e.em_maos, e.minimo from produtos p
--   join estoque e on e.produto_id = p.id order by p.nome;
-- select u.nome, u.papel, v.nome veiculo from usuarios u
--   left join veiculos v on v.id = u.veiculo_id order by u.nome;
