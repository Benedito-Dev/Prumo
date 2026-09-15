-- 003 — log de auditoria de cadastros.
--
-- Venda e pagamento de fiado JÁ guardam quem fez (venda.usuario_id,
-- pagamento_fiado.usuario_id) e não entram aqui: registrar de novo
-- duplicaria o dado e faria a tabela crescer a cada venda.
--
-- O que não tinha rastro nenhum era cadastro: quem mudou o preço do
-- cimento, quem editou o telefone do cliente, quem desativou o produto.
-- É a pergunta que aparece quando o número do painel não bate com a
-- memória de alguém.
CREATE TABLE IF NOT EXISTS log_auditoria (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quem. ON DELETE SET NULL, não CASCADE: apagar o usuário não pode
    -- apagar o histórico — seria justamente o caso em que alguém some e
    -- as ações dele somem junto. (Hoje usuário é desativado, não
    -- apagado, mas a FK precisa proteger o log de qualquer forma.)
    usuario_id  UUID         REFERENCES usuario (id) ON DELETE SET NULL,
    -- Cópia do nome no momento da ação, congelada como item_venda faz
    -- (RF12): se o usuário for renomeado ou removido, o log continua
    -- dizendo quem era.
    usuario_nome VARCHAR(120) NOT NULL,

    -- O quê. `entidade` + `entidade_id` apontam para o registro mexido;
    -- `entidade_nome` é a cópia congelada, pelo mesmo motivo acima — um
    -- produto apagado ainda precisa aparecer no log com nome legível.
    acao          VARCHAR(30)  NOT NULL,
    entidade      VARCHAR(30)  NOT NULL,
    entidade_id   UUID,
    entidade_nome VARCHAR(120),

    -- O que mudou, campo a campo: [{campo, de, para}]. JSONB e não texto
    -- para permitir consulta por campo depois ("todas as mudanças de
    -- preço"). NULL em criação e remoção, onde não há "antes e depois".
    alteracoes  JSONB,

    criado_em   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- A tela lista da mais recente para a mais antiga, e é o acesso mais
-- comum de longe.
CREATE INDEX IF NOT EXISTS idx_log_criado_em ON log_auditoria (criado_em DESC);

-- "O que essa pessoa andou fazendo?" e "o histórico deste produto".
CREATE INDEX IF NOT EXISTS idx_log_usuario  ON log_auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_entidade ON log_auditoria (entidade, entidade_id);
