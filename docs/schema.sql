-- ============================================================
--  PRUMO — Schema do banco de dados
--  Versão: 0.1  |  Data: 24/07/2026
--  Escopo: MVP (Fases 1 e 2) com ganchos para fases futuras
--  Dialeto: PostgreSQL
-- ============================================================


-- ============================================================
--  USUARIO — quem opera o sistema
--  Existe desde o MVP para registrar "quem vendeu" (RF13).
-- ============================================================
CREATE TABLE usuario (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         VARCHAR(120) NOT NULL,
    email        VARCHAR(160) NOT NULL UNIQUE,
    senha_hash   VARCHAR(255) NOT NULL,
    -- Só dois papéis: 'dono' administra usuários (requireDono), 'vendedor'
    -- opera o balcão. 'caixa' e 'estoque' existiam como rótulo mas nenhum
    -- código os diferenciava de 'vendedor' — removidos.
    papel        VARCHAR(20)  NOT NULL DEFAULT 'vendedor'
                 CHECK (papel IN ('dono', 'vendedor')),
    ativo        BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em    TIMESTAMP    NOT NULL DEFAULT NOW()
);


-- ============================================================
--  CLIENTE — quem compra
--  Cadastro mínimo: só nome e telefone (RF02).
-- ============================================================
CREATE TABLE cliente (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         VARCHAR(120) NOT NULL,
    telefone     VARCHAR(20)  NOT NULL,
    tipo         VARCHAR(20)
                 CHECK (tipo IN ('consumidor_final', 'pedreiro', 'construtora', 'revenda')),
    observacao   TEXT,
    criado_em    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Busca por nome parcial e telefone (RF05)
CREATE INDEX idx_cliente_nome     ON cliente (nome);
CREATE INDEX idx_cliente_telefone ON cliente (telefone);


-- ============================================================
--  CATEGORIA — agrupamento de produtos (RF09)
-- ============================================================
CREATE TABLE categoria (
    id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nome  VARCHAR(80)  NOT NULL UNIQUE
);


-- ============================================================
--  PRODUTO — o que se vende
--  preco_venda é apenas SUGESTÃO; o preço real vai no item.
-- ============================================================
CREATE TABLE produto (
    id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id  UUID           REFERENCES categoria (id),
    nome          VARCHAR(120)   NOT NULL,
    unidade       VARCHAR(15)    NOT NULL
                  CHECK (unidade IN ('saco','milheiro','m3','peca','barra','kg','metro','carrada')),
    preco_venda   NUMERIC(12,2)  NOT NULL CHECK (preco_venda >= 0),
    preco_custo   NUMERIC(12,2)  CHECK (preco_custo >= 0),   -- opcional (RF08)
    imagem_url    TEXT,                                       -- foto do produto (opcional)
    ativo         BOOLEAN        NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_produto_categoria ON produto (categoria_id);


-- ============================================================
--  VENDA — o núcleo do sistema
--  cliente_id anulável = venda "Consumidor" (RF03).
--  usuario_id obrigatório = toda venda tem vendedor (RF13).
-- ============================================================
CREATE TABLE venda (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id       UUID          REFERENCES cliente (id),          -- NULL = Consumidor
    usuario_id       UUID          NOT NULL REFERENCES usuario (id),
    forma_pagamento  VARCHAR(15)   NOT NULL
                     CHECK (forma_pagamento IN ('dinheiro','pix','cartao','fiado')),
    desconto         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
    valor_total      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
    status           VARCHAR(12)   NOT NULL DEFAULT 'concluida'
                     CHECK (status IN ('concluida','cancelada')),
    vendida_em       TIMESTAMP     NOT NULL DEFAULT NOW(),
    cancelada_em     TIMESTAMP,
    -- Vencimento do fiado. NULL = usa o prazo padrão da loja
    -- (LOJA_PRAZO_FIADO_DIAS) sobre vendida_em, que é o combinado da
    -- maioria das vendas. Só quem negociou data diferente preenche.
    vence_em         DATE
);

-- Filtros de período do painel (RF21) e rankings
CREATE INDEX idx_venda_data    ON venda (vendida_em);
CREATE INDEX idx_venda_cliente ON venda (cliente_id);
CREATE INDEX idx_venda_usuario ON venda (usuario_id);
CREATE INDEX idx_venda_status  ON venda (status);
-- Cobrança filtra os vencidos; sem índice vira varredura na tabela que
-- mais cresce. Parcial: só as vendas com data negociada entram.
CREATE INDEX idx_venda_vence_em ON venda (vence_em) WHERE vence_em IS NOT NULL;


-- ============================================================
--  ITEM_VENDA — os itens de cada venda (relação N:N)
--  produto_nome e preco_unitario são CONGELADOS na venda (RF12).
--  O histórico não muda se o produto for renomeado/reajustado.
-- ============================================================
CREATE TABLE item_venda (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id        UUID          NOT NULL REFERENCES venda (id) ON DELETE CASCADE,
    produto_id      UUID          NOT NULL REFERENCES produto (id),
    produto_nome    VARCHAR(120)  NOT NULL,                    -- cópia no momento da venda
    quantidade      NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
    preco_unitario  NUMERIC(12,2) NOT NULL CHECK (preco_unitario >= 0),  -- congelado
    subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)         -- qtd x preco
);

CREATE INDEX idx_item_venda_venda   ON item_venda (venda_id);
CREATE INDEX idx_item_venda_produto ON item_venda (produto_id);


-- ============================================================
--  REFRESH_TOKEN — sessões ativas para renovar o access token
--  Persistir permite revogar (logout real) e rotacionar o refresh.
--  jti casa com o claim do JWT; revogado marca o fim da sessão.
-- ============================================================
CREATE TABLE refresh_token (
    jti          UUID          PRIMARY KEY,              -- id único do token (claim jti)
    usuario_id   UUID          NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    expira_em    TIMESTAMP     NOT NULL,
    revogado     BOOLEAN       NOT NULL DEFAULT FALSE,
    criado_em    TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_usuario ON refresh_token (usuario_id);


-- ============================================================
--  PAGAMENTO_FIADO — quitações (parciais) de vendas fiado
--  Saldo em aberto de uma venda = valor_total − SUM(pagamentos).
-- ============================================================
CREATE TABLE pagamento_fiado (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id     UUID          NOT NULL REFERENCES venda (id) ON DELETE CASCADE,
    valor        NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    usuario_id   UUID          REFERENCES usuario (id),   -- quem recebeu
    pago_em      TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagfiado_venda ON pagamento_fiado (venda_id);


-- ============================================================
--  FIM DO SCHEMA v0.1
--  Fora do escopo (fases futuras): estoque, movimento_estoque,
--  entrada_mercadoria, conta_cliente (fiado), previsao, log_auditoria.
-- ============================================================
