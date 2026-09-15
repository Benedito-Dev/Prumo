-- 002 — data de vencimento por venda fiado.
--
-- Até aqui o vencimento era só o prazo padrão da loja
-- (LOJA_PRAZO_FIADO_DIAS) aplicado sobre a data da venda. Foi assim
-- porque criar coluna exigia recriar o banco — exatamente a limitação que
-- o sistema de migrações acabou de remover. Esta é a primeira dívida que
-- ele paga.
--
-- A coluna é ANULÁVEL de propósito: NULL significa "usa o prazo padrão da
-- loja", que é o combinado da maioria das vendas. Só quem negociou uma
-- data diferente no balcão preenche. Assim as vendas que já existem
-- continuam válidas sem precisar de backfill inventado, e o
-- comportamento atual segue idêntico até alguém informar uma data.
ALTER TABLE venda
  ADD COLUMN IF NOT EXISTS vence_em DATE;

COMMENT ON COLUMN venda.vence_em IS
  'Vencimento do fiado. NULL = usa o prazo padrão da loja sobre vendida_em.';

-- A cobrança lista por vencimento e filtra os atrasados; sem índice isso
-- vira varredura na tabela de vendas, que é a que mais cresce.
CREATE INDEX IF NOT EXISTS idx_venda_vence_em
    ON venda (vence_em)
 WHERE vence_em IS NOT NULL;
