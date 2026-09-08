-- OVOLOG — coordenadas de verdade.
--
-- O mapa deixou de ser um desenho: `lat`/`lng` são latitude e longitude
-- reais, não mais o plano 0–100 do mapa estilizado.
--
-- As colunas x/y ficam por enquanto. Nada no app lê mais elas, mas apagar
-- coluna é irreversível e não há pressa: derrube num próximo passo, depois
-- que todo cliente estiver geocodificado (o comando está no rodapé).

begin;

alter table clientes
  add column if not exists lat numeric(10,7),
  add column if not exists lng numeric(10,7);

alter table veiculos
  add column if not exists lat numeric(10,7),
  add column if not exists lng numeric(10,7);

-- Nulo é um estado legítimo aqui: quer dizer "endereço ainda não
-- geocodificado". O cliente continua na lista e some do mapa — melhor do que
-- aparecer num ponto inventado, que foi exatamente o problema da versão de
-- demonstração.
comment on column clientes.lat is
  'Latitude. Nulo = endereço ainda não geocodificado; o cliente não vai ao mapa.';
comment on column clientes.lng is 'Longitude. Ver lat.';

-- Faixas válidas. Barra o erro clássico de gravar lat e lng trocadas: no
-- Brasil a longitude passa de -180..180 mas nunca cabe em -90..90 junto com
-- uma latitude plausível.
alter table clientes
  add constraint clientes_lat_valida check (lat is null or lat between -90 and 90),
  add constraint clientes_lng_valida check (lng is null or lng between -180 and 180);

alter table veiculos
  add constraint veiculos_lat_valida check (lat is null or lat between -90 and 90),
  add constraint veiculos_lng_valida check (lng is null or lng between -180 and 180);

commit;

-- Clientes que faltam geocodificar:
--
-- select id, nome_fantasia, endereco, bairro
--   from clientes where lat is null order by nome_fantasia;

-- Depois que todos tiverem coordenada, para remover o mapa antigo:
--
-- alter table clientes drop column x, drop column y;
-- alter table veiculos drop column x, drop column y;
