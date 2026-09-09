-- Promove uma conta existente a admin de plataforma.
--
-- Rode no SQL Editor do Supabase DEPOIS de 0007_multiempresa.sql.
--
-- A conta precisa já existir em Authentication → Users. Este script não cria
-- acesso nem define senha: o hash é feito pela API de Auth, não por SQL — é por
-- isso que criar usuário é sempre um passo manual no painel.
--
-- Troque o e-mail e o nome abaixo pelos seus.

insert into plataforma_admins (auth_id, nome)
select u.id, 'SEU NOME'
  from auth.users u
 where u.email = 'voce@exemplo.com.br'
on conflict (auth_id) do nothing;

-- Confira. Deve aparecer uma linha; se vier vazio, o e-mail não bate com
-- nenhuma conta em Authentication → Users (confira maiúsculas e espaços).
select a.nome, u.email, a.criado_em
  from plataforma_admins a
  join auth.users u on u.id = a.auth_id;

-- ---------------------------------------------------------------------------
-- Sobre continuar tendo cadastro numa distribuidora
--
-- Ser admin de plataforma e ter uma linha em `usuarios` são coisas
-- independentes, e conviver bem: o app abre na área da plataforma e oferece
-- "Entrar na operação" para a distribuidora do seu cadastro.
--
-- Se preferir que a conta master NÃO opere nenhuma distribuidora, remova o
-- vínculo de equipe — mas só depois de existir outro gestor naquela empresa,
-- senão ela fica sem ninguém que possa administrá-la:
--
--   select nome, papel, email from usuarios
--    where distribuidora_id = (select id from distribuidoras order by criada_em limit 1);
--
-- ---------------------------------------------------------------------------
-- Para revogar o acesso de plataforma de alguém
--
--   delete from plataforma_admins
--    where auth_id = (select id from auth.users where email = 'pessoa@exemplo.com.br');
