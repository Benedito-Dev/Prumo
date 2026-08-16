-- 001 — marco zero do controle de migrações.
--
-- Esta migração não altera nada de propósito. Ela existe para que bancos
-- criados ANTES do sistema de migrações (pelo docs/schema.sql, na primeira
-- subida do volume) e bancos criados DEPOIS cheguem ao mesmo estado sem
-- que ninguém precise saber de qual dos dois se trata.
--
-- A partir daqui, toda mudança de schema entra como um arquivo novo nesta
-- pasta. `docs/schema.sql` continua sendo o retrato do schema para quem
-- cria um banco do zero — mantenha os dois em dia.

-- Confere que as tabelas do MVP existem. Se este SELECT falhar, o banco
-- não foi inicializado pelo schema.sql e não há o que migrar ainda.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'venda'
  ) THEN
    RAISE EXCEPTION
      'Banco sem as tabelas do MVP. Rode docs/schema.sql antes das migrações.';
  END IF;
END $$;
