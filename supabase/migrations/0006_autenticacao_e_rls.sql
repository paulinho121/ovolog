-- OVOLOG — autenticação real e RLS fechado.
--
-- Até aqui a tela de acesso era um seletor de perfil e as políticas liberavam
-- tudo para `anon`. Como a chave anônima é pública e vai no bundle que o
-- navegador baixa, na prática qualquer pessoa com a URL do app podia ler e
-- gravar no banco: clientes, preços, financeiro, endereços.
--
-- Esta migração troca isso por Supabase Auth. Depois dela, quem não estiver
-- autenticado não lê nem escreve nada.
--
-- ORDEM IMPORTA: rode e, na MESMA sessão, crie o primeiro usuário (instruções
-- no fim do arquivo). Entre uma coisa e outra ninguém entra no app.

begin;

-- =====================================================================
-- 1. Ligação entre a equipe e as contas de acesso
-- =====================================================================

-- `usuarios` continua sendo o cadastro da operação (nome, papel, veículo).
-- `auth.users` é quem guarda e-mail e senha. Esta coluna liga os dois.
alter table usuarios
  add column if not exists auth_id uuid unique references auth.users(id) on delete set null;

comment on column usuarios.auth_id is
  'Conta de acesso correspondente. Nulo = pessoa cadastrada que ainda não pode entrar.';

create index if not exists usuarios_auth_idx on usuarios (auth_id);

-- =====================================================================
-- 2. Quem sou eu / qual é o meu papel
-- =====================================================================

-- As políticas precisam saber o papel de quem está pedindo. Ler `usuarios`
-- dentro de uma política sobre `usuarios` causaria recursão infinita, então
-- estas funções rodam com `security definer` — elas ignoram RLS de propósito,
-- e por isso não recebem parâmetro e não expõem nada além do próprio papel.
create or replace function meu_usuario_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from usuarios where auth_id = auth.uid();
$$;

create or replace function meu_papel()
returns papel_usuario
language sql
stable
security definer
set search_path = public
as $$
  select papel from usuarios where auth_id = auth.uid();
$$;

create or replace function sou_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(meu_papel() = 'gestor', false);
$$;

-- =====================================================================
-- 3. Políticas
-- =====================================================================

-- Fora as exceções logo abaixo, a regra é a mesma em toda tabela: quem está
-- autenticado e faz parte da equipe usa o sistema. A separação fina por papel
-- (motorista enxergar só a rota dele) é um passo seguinte — o que esta
-- migração resolve, e é o que estava aberto, é o acesso de fora.
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
    -- Derruba a política de demonstração que liberava tudo para `anon`.
    execute format('drop policy if exists "demo_acesso_total" on %I', t);

    execute format(
      'create policy "equipe_le" on %I for select to authenticated using (meu_usuario_id() is not null)',
      t
    );
    execute format(
      'create policy "equipe_grava" on %I for insert to authenticated with check (meu_usuario_id() is not null)',
      t
    );
    execute format(
      'create policy "equipe_altera" on %I for update to authenticated using (meu_usuario_id() is not null) with check (meu_usuario_id() is not null)',
      t
    );
  end loop;
end $$;

-- Ninguém apaga nada pela API. Não há tela de exclusão no app, e histórico de
-- operação não se apaga: pedido cancelado vira status, não sumiço. Sem
-- política de delete, o Postgres nega por padrão.

-- Exceção: o cadastro da equipe é editado só por gestor. Sem isto, um
-- motorista poderia se promover a gestor pela API.
drop policy if exists "equipe_altera" on usuarios;
create policy "equipe_altera" on usuarios
  for update to authenticated
  using (sou_gestor() or auth_id = auth.uid())
  with check (sou_gestor() or auth_id = auth.uid());

drop policy if exists "equipe_grava" on usuarios;
create policy "equipe_grava" on usuarios
  for insert to authenticated
  with check (sou_gestor());

-- Preço é decisão de gestão, não de quem vende.
drop policy if exists "equipe_altera" on produtos;
create policy "equipe_altera" on produtos
  for update to authenticated using (sou_gestor()) with check (sou_gestor());

commit;

-- =====================================================================
-- 4. Depois de rodar: criar os acessos
-- =====================================================================
--
-- O Supabase não deixa criar senha por SQL — o hash é feito pela API de Auth.
-- Para cada pessoa da equipe:
--
--   1. Painel do Supabase → Authentication → Users → "Add user"
--      → Email + Password, e marque "Auto Confirm User"
--        (sem isso a pessoa precisa clicar num link de e-mail para entrar).
--
--   2. Copie o UUID que aparece na lista e ligue à pessoa já cadastrada:
--
--        update usuarios set auth_id = 'UUID-COPIADO'
--        where email = 'pessoa@empresa.com.br';
--
-- Confira se sobrou alguém sem acesso:
--
--   select nome, papel, email,
--          case when auth_id is null then 'SEM ACESSO' else 'ok' end as situacao
--     from usuarios order by situacao, nome;
--
-- ATENÇÃO: enquanto o SEU usuário não tiver `auth_id`, você também não entra —
-- e como `usuarios` agora exige gestor para inserir, faça este primeiro
-- vínculo pelo SQL Editor (que roda como dono do banco e ignora RLS).
