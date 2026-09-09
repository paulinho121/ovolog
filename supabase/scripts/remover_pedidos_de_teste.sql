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
-- Sem tabelas temporárias de propósito: o SQL Editor do Supabase não as
-- mantém entre instruções, e o script quebrava com "relation does not exist".
-- Cada comando repete o critério e se basta.
--
-- ---------------------------------------------------------------------------
-- COMO USAR
--
-- 1. Rode como está. A última linha é `rollback`, então NADA é gravado: você
--    vê exatamente o que sairia.
-- 2. Confira as listas nos resultados.
-- 3. Troque a última linha para `commit` e rode de novo para aplicar.
--
-- O CRITÉRIO é "pedido que usa produto de exemplo do 0004". Para escolher por
-- número, troque cada bloco `exists (...)` por:  p.numero in ('0001','0002')
-- ---------------------------------------------------------------------------

begin;

-- =====================================================================
-- 1. O que será removido
-- =====================================================================

select 'PEDIDOS' as etapa, p.numero, p.status, p.pagamento, p.criado_em,
       c.nome_fantasia as cliente,
       (select sum(i.quantidade * i.preco_unitario) from pedido_itens i
         where i.pedido_id = p.id) - p.desconto as total
  from pedidos p
  join clientes c on c.id = p.cliente_id
 where exists (select 1 from pedido_itens i
                where i.pedido_id = p.id and i.produto_id like '%EXEMPLO%')
 order by p.criado_em;

select 'CONTAS' as etapa, ct.parte_nome, ct.valor, ct.valor_pago, ct.status, ct.vencimento
  from contas ct
 where ct.pedido_id in (
   select p.id from pedidos p
    where exists (select 1 from pedido_itens i
                   where i.pedido_id = p.id and i.produto_id like '%EXEMPLO%')
 );

-- O lançamento de caixa NÃO tem vínculo com o pedido — só a descrição
-- ("Recebimento <cliente>") e o horário. Por isso ele é apenas LISTADO: apagar
-- dinheiro por semelhança de horário não é aceitável. Confira e remova à mão
-- o que reconhecer, com:  delete from caixa_lancamentos where id = '...';
select 'CAIXA — CONFIRA E APAGUE À MÃO' as etapa, l.id, l.descricao, l.valor, l.em
  from caixa_lancamentos l
 where l.em between
       (select min(p.criado_em) - interval '1 hour' from pedidos p
         where exists (select 1 from pedido_itens i
                        where i.pedido_id = p.id and i.produto_id like '%EXEMPLO%'))
   and (select max(p.criado_em) + interval '1 hour' from pedidos p
         where exists (select 1 from pedido_itens i
                        where i.pedido_id = p.id and i.produto_id like '%EXEMPLO%'))
 order by l.em;

-- =====================================================================
-- 2. Remover
-- =====================================================================

-- A conta sai ANTES do pedido: com `on delete set null`, apagar o pedido
-- primeiro deixaria a conta órfã em vez de removê-la.
delete from contas
 where pedido_id in (
   select p.id from pedidos p
    where exists (select 1 from pedido_itens i
                   where i.pedido_id = p.id and i.produto_id like '%EXEMPLO%')
 );

-- `pedido_itens` e `rota_parada_pedidos` caem por cascata.
delete from pedidos p
 where exists (select 1 from pedido_itens i
                where i.pedido_id = p.id and i.produto_id like '%EXEMPLO%');

-- =====================================================================
-- 3. Recalcular o que os pedidos tinham somado
-- =====================================================================

-- Recalcular do zero, e não subtrair, é de propósito: subtração erra em
-- silêncio se o estado anterior já estivesse fora de lugar. O recálculo é
-- autocorretivo — vale mesmo que algo já estivesse errado.

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
-- O total é por PEDIDO (itens menos o desconto daquele pedido) e só depois
-- somado entre pedidos. Descontar na soma geral daria outro número.
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
-- 4. Como ficou
-- =====================================================================

select 'DEPOIS' as etapa,
       (select count(*) from pedidos)                           as pedidos,
       (select count(*) from pedido_itens)                      as itens,
       (select count(*) from contas)                            as contas,
       (select count(*) from caixa_lancamentos)                 as caixa,
       (select coalesce(sum(saldo), 0) from clientes)           as saldo_total,
       (select coalesce(sum(total_comprado), 0) from clientes)  as comprado_total,
       (select coalesce(sum(reservado), 0) from estoque)        as reservado_total;

-- ---------------------------------------------------------------------------
-- Troque para `commit;` quando as listas acima estiverem certas.
rollback;
