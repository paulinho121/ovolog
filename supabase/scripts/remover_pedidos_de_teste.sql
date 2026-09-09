-- Remove pedidos de teste e desfaz tudo o que eles geraram.
--
-- Um pedido não é uma linha só. Ao ser criado, ele também:
--   • soma no `total_comprado` do cliente;
--   • soma no `saldo` do cliente, quando é a prazo;
--   • cria uma conta a receber (a prazo) ou um lançamento de caixa (à vista);
--   • aumenta o `reservado` do estoque de cada produto.
--
-- Apagar só a linha de `pedidos` deixaria tudo isso para trás — e pior:
-- `contas.pedido_id` é `on delete set null`, então a conta a receber ficaria
-- viva e sem origem, cobrando um cliente por um pedido que não existe mais.
--
-- ---------------------------------------------------------------------------
-- COMO USAR
--
-- 1. Rode como está. A última linha é `rollback`, então NADA é gravado: você
--    vê exatamente o que sairia.
-- 2. Confira as listas nos resultados.
-- 3. Trocando a última linha para `commit`, rode de novo para aplicar.
-- ---------------------------------------------------------------------------

begin;

-- =====================================================================
-- 1. Quais pedidos
-- =====================================================================

-- Aqui: os que usam algum produto de exemplo do 0004. Para escolher por
-- número, troque por:  where p.numero in ('0001', '0002')
create temporary table pedidos_teste as
select p.id, p.numero, p.cliente_id, p.status, p.pagamento, p.criado_em
  from pedidos p
 where exists (
   select 1 from pedido_itens i
    where i.pedido_id = p.id and i.produto_id like '%EXEMPLO%'
 );

select 'PEDIDOS QUE SERÃO REMOVIDOS' as etapa, * from pedidos_teste order by criado_em;

-- =====================================================================
-- 2. Contas e caixa
-- =====================================================================

-- A conta a receber some junto: ela existe por causa do pedido.
select 'CONTAS QUE SERÃO REMOVIDAS' as etapa, c.id, c.parte_nome, c.valor, c.status
  from contas c
 where c.pedido_id in (select id from pedidos_teste);

delete from contas where pedido_id in (select id from pedidos_teste);

-- O lançamento de caixa NÃO tem vínculo com o pedido — só a descrição
-- ("Recebimento <cliente>") e o horário. Por isso ele é apenas LISTADO, e a
-- remoção fica por sua conta: adivinhar qual lançamento pertence a qual
-- pedido seria apagar dinheiro por heurística.
select 'CAIXA — CONFIRA E APAGUE À MÃO SE FOR DE TESTE' as etapa,
       l.id, l.descricao, l.valor, l.em
  from caixa_lancamentos l
 where l.em between (select min(criado_em) - interval '1 hour' from pedidos_teste)
                and (select max(criado_em) + interval '1 hour' from pedidos_teste)
 order by l.em;

-- =====================================================================
-- 3. Os pedidos
-- =====================================================================

-- `pedido_itens` e `rota_parada_pedidos` caem por cascata.
delete from pedidos where id in (select id from pedidos_teste);

-- =====================================================================
-- 4. Recalcular o que os pedidos tinham somado
-- =====================================================================

-- Recalcular do zero, e não subtrair, é de propósito: subtração erra se algo
-- já estiver fora de lugar, e o erro fica invisível. O recálculo é
-- autocorretivo — vale mesmo que o estado anterior estivesse errado.

-- `reservado` = o que está vendido e ainda não entregue.
update estoque e
   set reservado = coalesce((
     select sum(i.quantidade)
       from pedido_itens i
       join pedidos p on p.id = i.pedido_id
      where i.produto_id = e.produto_id
        and p.status in ('confirmado', 'em_rota')
   ), 0);

-- `total_comprado` = tudo que o cliente já comprou de fato.
--
-- O total é por PEDIDO (soma dos itens menos o desconto daquele pedido) e só
-- depois somado entre pedidos. Descontar na soma geral daria outro número.
-- `greatest(0, ...)` espelha o app, que nunca deixa um total ficar negativo.
update clientes c
   set total_comprado = coalesce((
     select sum(t.total)
       from (
         select greatest(0, sum(i.quantidade * i.preco_unitario) - p.desconto) as total
           from pedidos p
           join pedido_itens i on i.pedido_id = p.id
          where p.cliente_id = c.id
            and p.status not in ('rascunho', 'cancelado')
          group by p.id, p.desconto
       ) t
   ), 0);

-- `saldo` = o que está em aberto nas contas a receber dele. É a definição
-- verdadeira do saldo devedor; o campo era só um acumulado.
update clientes c
   set saldo = coalesce((
     select sum(ct.valor - ct.valor_pago)
       from contas ct
      where ct.tipo = 'receber'
        and ct.parte_id = c.id
        and ct.status <> 'pago'
   ), 0);

-- =====================================================================
-- 5. Como ficou
-- =====================================================================

select 'DEPOIS' as etapa,
       (select count(*) from pedidos)                as pedidos,
       (select count(*) from pedido_itens)           as itens,
       (select count(*) from contas)                 as contas,
       (select count(*) from caixa_lancamentos)      as caixa,
       (select coalesce(sum(saldo), 0) from clientes)          as saldo_total,
       (select coalesce(sum(total_comprado), 0) from clientes) as comprado_total,
       (select coalesce(sum(reservado), 0) from estoque)       as reservado_total;

-- ---------------------------------------------------------------------------
-- Troque para `commit;` quando as listas acima estiverem certas.
rollback;
