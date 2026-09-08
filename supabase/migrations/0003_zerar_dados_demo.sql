-- OVOLOG — remove a carga de demonstração.
--
-- Roda no SQL Editor do Supabase. NÃO é reversível: leia antes de executar.
--
-- Esvazia o banco inteiro, cadastros incluídos. Depois disso o app não tem
-- produto, usuário, fornecedor nem veículo — e nenhuma dessas quatro coisas
-- pode ser criada pela interface hoje (ver 0004_dados_reais.sql).
--
-- O schema, os tipos, as constraints e as políticas de RLS ficam intactos:
-- isto apaga linhas, não estrutura.

begin;

truncate
  notificacoes, compra_itens, compras, caixa_lancamentos, contas,
  devolucoes, ocorrencias, rota_parada_pedidos, pedido_itens, pedidos,
  rota_paradas, rota_carga, rotas, movimentacoes_estoque, lotes, estoque,
  veiculos, clientes, fornecedores, produtos, usuarios
restart identity cascade;

commit;

-- Conferência — tudo deve voltar zero:
--
-- select 'usuarios' t, count(*) from usuarios
-- union all select 'produtos', count(*) from produtos
-- union all select 'fornecedores', count(*) from fornecedores
-- union all select 'veiculos', count(*) from veiculos
-- union all select 'clientes', count(*) from clientes
-- union all select 'pedidos', count(*) from pedidos
-- union all select 'rotas', count(*) from rotas
-- union all select 'contas', count(*) from contas;
