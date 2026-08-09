// Documento OpenAPI 3.0 da API do Prumo.
// Descreve todos os endpoints para o Swagger UI (montado em /api/docs).
// Mantido central de propósito: a API inteira num só lugar, sem poluir
// os controllers.

// ---- Componentes reutilizáveis (schemas) ----
const schemas = {
  Erro: {
    type: 'object',
    properties: {
      erro: { type: 'string', example: 'Mensagem de erro' },
      detalhe: { type: 'string' },
    },
  },

  Cliente: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      nome: { type: 'string', example: 'José Ferreira' },
      telefone: { type: 'string', example: '11988887777' },
      tipo: {
        type: 'string',
        nullable: true,
        enum: ['consumidor_final', 'pedreiro', 'construtora', 'revenda'],
      },
      observacao: { type: 'string', nullable: true },
      criado_em: { type: 'string', format: 'date-time' },
    },
  },
  ClienteEntrada: {
    type: 'object',
    required: ['nome', 'telefone'],
    properties: {
      nome: { type: 'string', example: 'José Ferreira' },
      telefone: { type: 'string', example: '11988887777' },
      tipo: {
        type: 'string',
        enum: ['consumidor_final', 'pedreiro', 'construtora', 'revenda'],
      },
      observacao: { type: 'string' },
    },
  },

  Categoria: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      nome: { type: 'string', example: 'Cimento' },
    },
  },
  CategoriaEntrada: {
    type: 'object',
    required: ['nome'],
    properties: { nome: { type: 'string', example: 'Cimento' } },
  },

  Produto: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      categoria_id: { type: 'string', format: 'uuid', nullable: true },
      categoria_nome: { type: 'string', nullable: true },
      nome: { type: 'string', example: 'Cimento CP-II 50kg' },
      unidade: {
        type: 'string',
        enum: ['saco', 'milheiro', 'm3', 'peca', 'barra', 'kg', 'metro', 'carrada'],
      },
      preco_venda: { type: 'string', example: '37.00' },
      preco_custo: { type: 'string', nullable: true, example: '30.00' },
      imagem_url: { type: 'string', nullable: true, description: 'URL da foto do produto' },
      ativo: { type: 'boolean' },
    },
  },
  ProdutoEntrada: {
    type: 'object',
    required: ['nome', 'unidade', 'preco_venda'],
    properties: {
      nome: { type: 'string', example: 'Cimento CP-II 50kg' },
      unidade: {
        type: 'string',
        enum: ['saco', 'milheiro', 'm3', 'peca', 'barra', 'kg', 'metro', 'carrada'],
      },
      preco_venda: { type: 'number', example: 37.0 },
      preco_custo: { type: 'number', example: 30.0 },
      categoria_id: { type: 'string', format: 'uuid' },
      imagem_url: { type: 'string', description: 'URL da foto do produto (opcional)' },
    },
  },

  Usuario: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      nome: { type: 'string', example: 'Benedito' },
      email: { type: 'string', format: 'email', example: 'benedito@prumo.com' },
      papel: { type: 'string', enum: ['dono', 'vendedor'] },
      ativo: { type: 'boolean' },
      criado_em: { type: 'string', format: 'date-time' },
    },
  },
  UsuarioEntrada: {
    type: 'object',
    required: ['nome', 'email', 'senha'],
    properties: {
      nome: { type: 'string', example: 'Benedito' },
      email: { type: 'string', format: 'email', example: 'benedito@prumo.com' },
      senha: { type: 'string', format: 'password', example: 'segredo123' },
      papel: { type: 'string', enum: ['dono', 'vendedor'] },
    },
  },

  ItemVenda: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      produto_id: { type: 'string', format: 'uuid' },
      produto_nome: { type: 'string', example: 'Cimento CP-II 50kg' },
      quantidade: { type: 'string', example: '40.000' },
      preco_unitario: { type: 'string', example: '37.00' },
      subtotal: { type: 'string', example: '1480.00' },
    },
  },
  Venda: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      cliente_id: { type: 'string', format: 'uuid', nullable: true },
      cliente_nome: { type: 'string', nullable: true },
      usuario_id: { type: 'string', format: 'uuid' },
      usuario_nome: { type: 'string' },
      forma_pagamento: {
        type: 'string',
        enum: ['dinheiro', 'pix', 'cartao', 'fiado'],
      },
      desconto: { type: 'string', example: '0.00', description: 'Desconto aplicado (subtraído do total)' },
      valor_total: { type: 'string', example: '1720.00', description: 'Soma dos itens − desconto' },
      status: { type: 'string', enum: ['concluida', 'cancelada'] },
      vendida_em: { type: 'string', format: 'date-time' },
      cancelada_em: { type: 'string', format: 'date-time', nullable: true },
      itens: { type: 'array', items: { $ref: '#/components/schemas/ItemVenda' } },
    },
  },
  VendaEntrada: {
    type: 'object',
    required: ['forma_pagamento', 'itens'],
    properties: {
      cliente_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Ausente/null = venda "Consumidor"',
      },
      // usuario_id NÃO entra aqui: quem vendeu sai do token de acesso.
      forma_pagamento: {
        type: 'string',
        enum: ['dinheiro', 'pix', 'cartao', 'fiado'],
      },
      desconto: { type: 'number', example: 0, description: 'Desconto em R$ (opcional). Não pode exceder o total dos itens.' },
      itens: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['produto_id', 'quantidade'],
          properties: {
            produto_id: { type: 'string', format: 'uuid' },
            quantidade: { type: 'number', example: 40 },
            preco_unitario: {
              type: 'number',
              description: 'Opcional. Se ausente, usa o preço atual do produto (RF12).',
              example: 37.0,
            },
          },
        },
      },
    },
  },
};

// helpers de resposta
const ok = (schema, desc = 'Sucesso') => ({
  description: desc,
  content: { 'application/json': { schema } },
});
const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const listaDe = (nome) => ({ type: 'array', items: ref(nome) });
const erro = (desc) => ({
  description: desc,
  content: { 'application/json': { schema: ref('Erro') } },
});
const paramId = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

// Rotas protegidas por requireDono.
const SO_DONO = 'Restrito ao dono (requireDono) — outros papéis recebem 403.';

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Prumo API',
    version: '0.1.0',
    description:
      'API do Prumo — sistema de gestão para depósito de material de construção. ' +
      'Todos os endpoints ficam sob `/api`.',
  },
  servers: [{ url: '/api', description: 'API do Prumo' }],
  tags: [
    { name: 'Health', description: 'Status da API e do banco' },
    { name: 'Auth', description: 'Autenticação — login, refresh, logout' },
    { name: 'Clientes', description: 'Cadastro de clientes (RF01–RF05)' },
    { name: 'Categorias', description: 'Categorias de produtos (RF09)' },
    { name: 'Produtos', description: 'Catálogo de produtos (RF06–RF09)' },
    { name: 'Usuários', description: 'Usuários do sistema (RF13)' },
    { name: 'Vendas', description: 'Registro de vendas — o núcleo (RF10–RF14)' },
    { name: 'Fiados', description: 'Contas a receber — vendas fiado em aberto e pagamentos' },
    { name: 'Painel', description: 'Indicadores do painel (RF16–RF22)' },
    { name: 'Assistente', description: 'Chat com IA sobre os dados do negócio (via OpenRouter)' },
  ],
  components: {
    schemas,
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    // ---------------- AUTH ----------------
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login (bcrypt) — retorna access token e seta refresh (cookie httpOnly)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'senha'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'benedito@prumo.com' },
                  senha: { type: 'string', format: 'password', example: '123456' },
                },
              },
            },
          },
        },
        responses: {
          200: ok({
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              usuario: ref('Usuario'),
            },
          }, 'Autenticado'),
          401: erro('Login ou senha inválidos'),
          403: erro('Usuário inativo'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renova o access token (rotaciona o refresh do cookie)',
        responses: {
          200: ok({ type: 'object', properties: { accessToken: { type: 'string' } } }),
          401: erro('Refresh inválido/expirado ou sessão encerrada'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Encerra a sessão (revoga o refresh no banco)',
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Usuário do access token atual (requer Bearer)',
        security: [{ bearerAuth: [] }],
        responses: { 200: ok(ref('Usuario')), 401: erro('Token ausente/inválido') },
      },
    },

    // ---------------- HEALTH ----------------
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica API e conexão com o banco',
        responses: {
          200: ok({
            type: 'object',
            properties: {
              status: { type: 'string' },
              api: { type: 'string' },
              banco: { type: 'string' },
              hora_do_banco: { type: 'string', format: 'date-time' },
            },
          }),
          503: erro('Banco sem conexão'),
        },
      },
    },

    // ---------------- CLIENTES ----------------
    '/clientes/estatisticas': {
      get: {
        tags: ['Clientes'],
        summary: 'Clientes com estatísticas de compra (total, nº compras, última compra)',
        description:
          'LEFT JOIN com vendas concluídas. dias_sem_comprar ajuda a identificar clientes sumidos (RF24).',
        responses: {
          200: ok({
            type: 'array',
            items: {
              allOf: [
                { $ref: '#/components/schemas/Cliente' },
                {
                  type: 'object',
                  properties: {
                    total_gasto: { type: 'number' },
                    qtd_compras: { type: 'number' },
                    ultima_compra: { type: 'string', format: 'date-time', nullable: true },
                    dias_sem_comprar: { type: 'integer', nullable: true },
                  },
                },
              ],
            },
          }),
        },
      },
    },
    '/clientes': {
      get: {
        tags: ['Clientes'],
        summary: 'Lista clientes (com busca opcional)',
        parameters: [
          {
            name: 'busca',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filtra por nome parcial OU telefone (RF05)',
          },
        ],
        responses: { 200: ok(listaDe('Cliente'), 'Lista de clientes') },
      },
      post: {
        tags: ['Clientes'],
        summary: 'Cria um cliente',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ClienteEntrada') } },
        },
        responses: {
          201: ok(ref('Cliente'), 'Cliente criado'),
          400: erro('Dados inválidos'),
        },
      },
    },
    '/clientes/{id}': {
      get: {
        tags: ['Clientes'],
        summary: 'Busca um cliente',
        parameters: [paramId],
        responses: { 200: ok(ref('Cliente')), 404: erro('Não encontrado') },
      },
      put: {
        tags: ['Clientes'],
        summary: 'Atualiza um cliente',
        parameters: [paramId],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ClienteEntrada') } },
        },
        responses: {
          200: ok(ref('Cliente'), 'Atualizado'),
          400: erro('Dados inválidos'),
          404: erro('Não encontrado'),
        },
      },
      delete: {
        tags: ['Clientes'],
        summary: 'Remove um cliente',
        parameters: [paramId],
        responses: {
          204: { description: 'Removido' },
          404: erro('Não encontrado'),
          409: erro('Cliente possui vendas'),
        },
      },
    },

    // ---------------- CATEGORIAS ----------------
    '/categorias': {
      get: {
        tags: ['Categorias'],
        summary: 'Lista categorias',
        responses: { 200: ok(listaDe('Categoria')) },
      },
      post: {
        tags: ['Categorias'],
        summary: 'Cria uma categoria',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('CategoriaEntrada') } },
        },
        responses: {
          201: ok(ref('Categoria'), 'Criada'),
          400: erro('Dados inválidos'),
          409: erro('Nome já existe'),
        },
      },
    },
    '/categorias/{id}': {
      get: {
        tags: ['Categorias'],
        summary: 'Busca uma categoria',
        parameters: [paramId],
        responses: { 200: ok(ref('Categoria')), 404: erro('Não encontrada') },
      },
      put: {
        tags: ['Categorias'],
        summary: 'Atualiza uma categoria',
        parameters: [paramId],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('CategoriaEntrada') } },
        },
        responses: {
          200: ok(ref('Categoria')),
          404: erro('Não encontrada'),
          409: erro('Nome já existe'),
        },
      },
      delete: {
        tags: ['Categorias'],
        summary: 'Remove uma categoria',
        parameters: [paramId],
        responses: {
          204: { description: 'Removida' },
          404: erro('Não encontrada'),
          409: erro('Categoria possui produtos'),
        },
      },
    },

    // ---------------- PRODUTOS ----------------
    '/produtos': {
      get: {
        tags: ['Produtos'],
        summary: 'Lista produtos',
        parameters: [
          {
            name: 'categoria_id',
            in: 'query',
            schema: { type: 'string', format: 'uuid' },
          },
          { name: 'ativos', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: ok(listaDe('Produto')) },
      },
      post: {
        tags: ['Produtos'],
        summary: 'Cria um produto',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ProdutoEntrada') } },
        },
        responses: {
          201: ok(ref('Produto'), 'Criado'),
          400: erro('Dados inválidos'),
        },
      },
    },
    '/produtos/{id}': {
      get: {
        tags: ['Produtos'],
        summary: 'Busca um produto',
        parameters: [paramId],
        responses: { 200: ok(ref('Produto')), 404: erro('Não encontrado') },
      },
      put: {
        tags: ['Produtos'],
        summary: 'Atualiza um produto',
        parameters: [paramId],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ProdutoEntrada') } },
        },
        responses: {
          200: ok(ref('Produto')),
          400: erro('Dados inválidos'),
          404: erro('Não encontrado'),
        },
      },
      delete: {
        tags: ['Produtos'],
        summary: 'Remove um produto',
        parameters: [paramId],
        responses: {
          204: { description: 'Removido' },
          404: erro('Não encontrado'),
          409: erro('Produto possui vendas — desative em vez de excluir'),
        },
      },
    },

    // ---------------- USUÁRIOS ----------------
    '/usuarios': {
      get: {
        tags: ['Usuários'],
        summary: 'Lista usuários (sem senha)',
        description: SO_DONO,
        responses: { 200: ok(listaDe('Usuario')), 403: erro('Só o dono') },
      },
      post: {
        tags: ['Usuários'],
        summary: 'Cria um usuário (senha guardada com hash)',
        description: SO_DONO,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('UsuarioEntrada') } },
        },
        responses: {
          201: ok(ref('Usuario'), 'Criado'),
          400: erro('Dados inválidos'),
          403: erro('Só o dono'),
          409: erro('E-mail já existe'),
        },
      },
    },
    '/usuarios/{id}': {
      get: {
        tags: ['Usuários'],
        summary: 'Busca um usuário',
        description: SO_DONO,
        parameters: [paramId],
        responses: {
          200: ok(ref('Usuario')),
          403: erro('Só o dono'),
          404: erro('Não encontrado'),
        },
      },
    },
    '/usuarios/{id}/ativo': {
      patch: {
        tags: ['Usuários'],
        summary: 'Ativa/desativa um usuário (soft, preserva histórico)',
        description: SO_DONO,
        parameters: [paramId],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ativo'],
                properties: { ativo: { type: 'boolean' } },
              },
            },
          },
        },
        responses: {
          200: ok(ref('Usuario')),
          400: erro('Campo ativo obrigatório'),
          403: erro('Só o dono'),
          404: erro('Não encontrado'),
        },
      },
    },
    '/usuarios/me/senha': {
      patch: {
        tags: ['Usuários'],
        summary: 'Troca a própria senha',
        description:
          'Qualquer usuário logado troca a própria senha. Exige a senha atual — o dono usa /usuarios/{id}/senha para resetar a de outro.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['senha_atual', 'senha_nova'],
                properties: {
                  senha_atual: { type: 'string', format: 'password' },
                  senha_nova: {
                    type: 'string',
                    format: 'password',
                    minLength: 4,
                    description: 'Ao menos 4 caracteres',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ type: 'object', properties: { ok: { type: 'boolean' } } }),
          400: erro('Senha atual incorreta ou nova senha curta demais'),
          404: erro('Não encontrado'),
        },
      },
    },
    '/usuarios/{id}/senha': {
      patch: {
        tags: ['Usuários'],
        summary: 'Reseta a senha de um usuário (sem pedir a atual)',
        description: SO_DONO,
        parameters: [paramId],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['senha_nova'],
                properties: {
                  senha_nova: {
                    type: 'string',
                    format: 'password',
                    minLength: 4,
                    description: 'Ao menos 4 caracteres',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok({ type: 'object', properties: { ok: { type: 'boolean' } } }),
          400: erro('Senha curta demais'),
          403: erro('Só o dono'),
          404: erro('Não encontrado'),
        },
      },
    },

    // ---------------- VENDAS ----------------
    '/vendas': {
      get: {
        tags: ['Vendas'],
        summary: 'Lista vendas (filtros de período, status e cliente)',
        parameters: [
          { name: 'de', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'ate', in: 'query', schema: { type: 'string', format: 'date' } },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['concluida', 'cancelada'] },
          },
          {
            name: 'cliente_id',
            in: 'query',
            schema: { type: 'string', format: 'uuid' },
            description: 'Filtra as vendas de um cliente (histórico)',
          },
        ],
        responses: { 200: ok(listaDe('Venda')) },
      },
      post: {
        tags: ['Vendas'],
        summary: 'Lança uma venda (transação: venda + itens)',
        description:
          'Congela produto_nome e preco_unitario no momento da venda. ' +
          'preco_unitario por item é opcional (usa o preço atual do produto se ausente).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('VendaEntrada') } },
        },
        responses: {
          201: ok(ref('Venda'), 'Venda registrada'),
          400: erro('Dados inválidos / produto inexistente'),
        },
      },
    },
    '/vendas/{id}': {
      get: {
        tags: ['Vendas'],
        summary: 'Detalha uma venda (com itens)',
        parameters: [paramId],
        responses: { 200: ok(ref('Venda')), 404: erro('Não encontrada') },
      },
    },
    '/vendas/{id}/cancelar': {
      patch: {
        tags: ['Vendas'],
        summary: 'Cancela uma venda (soft delete, RF14)',
        parameters: [paramId],
        responses: {
          200: ok({
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              cancelada_em: { type: 'string', format: 'date-time' },
            },
          }),
          404: erro('Não encontrada'),
          409: erro('Já está cancelada'),
        },
      },
    },

    // ---------------- FIADOS ----------------
    '/fiados': {
      get: {
        tags: ['Fiados'],
        summary: 'Vendas fiado em aberto (com saldo devedor)',
        description: 'Só vendas concluídas com forma_pagamento=fiado e saldo > 0. Mais antigas primeiro.',
        responses: {
          200: ok({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid', description: 'id da venda' },
                cliente_id: { type: 'string', format: 'uuid', nullable: true },
                cliente_nome: { type: 'string' },
                cliente_telefone: { type: 'string', nullable: true },
                valor_total: { type: 'number' },
                pago: { type: 'number' },
                saldo: { type: 'number', description: 'valor_total − pago' },
                dias: { type: 'integer', description: 'dias desde a venda' },
                vendida_em: { type: 'string', format: 'date-time' },
              },
            },
          }),
        },
      },
    },
    '/fiados/resumo': {
      get: {
        tags: ['Fiados'],
        summary: 'Total a receber e nº de dívidas em aberto',
        responses: {
          200: ok({
            type: 'object',
            properties: {
              total_receber: { type: 'number' },
              qtd: { type: 'integer' },
            },
          }),
        },
      },
    },
    '/fiados/{vendaId}/pagamentos': {
      get: {
        tags: ['Fiados'],
        summary: 'Histórico de quitações de uma venda fiado',
        parameters: [
          { name: 'vendaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: ok({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                valor: { type: 'number' },
                usuario_nome: { type: 'string', nullable: true },
                pago_em: { type: 'string', format: 'date-time' },
              },
            },
          }),
        },
      },
    },
    '/fiados/{vendaId}/pagar': {
      post: {
        tags: ['Fiados'],
        summary: 'Registra um pagamento (parcial ou total) de um fiado',
        parameters: [
          { name: 'vendaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['valor'],
                properties: { valor: { type: 'number', example: 300 } },
              },
            },
          },
        },
        responses: {
          201: ok({
            type: 'object',
            properties: {
              pago: { type: 'number' },
              saldo: { type: 'number', description: 'saldo restante após o pagamento' },
              quitado: { type: 'boolean' },
            },
          }, 'Pagamento registrado'),
          400: erro('Valor inválido, excede o saldo ou venda não é fiado em aberto'),
          404: erro('Venda não encontrada'),
        },
      },
    },

    // ---------------- PAINEL ----------------
    '/painel/faturamento': {
      get: {
        tags: ['Painel'],
        summary: 'Faturamento do mês x anterior (RF16)',
        responses: {
          200: ok({
            type: 'object',
            properties: {
              mes_atual: { type: 'number' },
              mes_anterior: { type: 'number' },
              variacao_pct: { type: 'number', nullable: true },
              vendas_mes_atual: { type: 'number' },
            },
          }),
        },
      },
    },
    '/painel/resumo': {
      get: {
        tags: ['Painel'],
        summary: 'Total, nº de vendas, ticket médio e variação vs. período anterior (RF18)',
        parameters: [
          {
            name: 'periodo',
            in: 'query',
            schema: { type: 'string', enum: ['hoje', 'semana', 'mes', 'ano'] },
          },
          { name: 'de', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'ate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: ok({
            type: 'object',
            properties: {
              total: { type: 'number' },
              qtd_vendas: { type: 'number' },
              ticket_medio: { type: 'number' },
              clientes: { type: 'number' },
              variacao: {
                type: 'object',
                description: '% vs. período anterior (null se sem base)',
                properties: {
                  total: { type: 'number', nullable: true },
                  qtd_vendas: { type: 'number', nullable: true },
                  ticket_medio: { type: 'number', nullable: true },
                  clientes: { type: 'number', nullable: true },
                },
              },
            },
          }),
        },
      },
    },
    '/painel/ranking-clientes': {
      get: {
        tags: ['Painel'],
        summary: 'Ranking de clientes (RF17)',
        parameters: [
          { name: 'periodo', in: 'query', schema: { type: 'string' } },
          { name: 'limite', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/painel/produtos-mais-vendidos': {
      get: {
        tags: ['Painel'],
        summary: 'Produtos mais vendidos (RF19)',
        parameters: [
          { name: 'periodo', in: 'query', schema: { type: 'string' } },
          { name: 'limite', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/painel/vendas-por-vendedor': {
      get: {
        tags: ['Painel'],
        summary: 'Vendas por vendedor (RF20)',
        parameters: [{ name: 'periodo', in: 'query', schema: { type: 'string' } }],
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/painel/evolucao-faturamento': {
      get: {
        tags: ['Painel'],
        summary: 'Faturamento diário para gráfico (RF22)',
        parameters: [{ name: 'periodo', in: 'query', schema: { type: 'string' } }],
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },

    // ---------------- ASSISTENTE ----------------
    '/assistente/perguntar': {
      post: {
        tags: ['Assistente'],
        summary: 'Pergunta em linguagem natural sobre o negócio',
        description:
          'Envia a pergunta a um modelo de IA (via OpenRouter) que consulta os dados ' +
          'através de um catálogo fechado de funções somente leitura — o modelo nunca ' +
          'escreve SQL. O catálogo é filtrado pelo papel do usuário: faturamento, ' +
          'ranking de clientes e desempenho de vendedores só para o dono; produtos, ' +
          'fiados e clientes para qualquer usuário logado.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['pergunta'],
                properties: {
                  pergunta: {
                    type: 'string',
                    maxLength: 1000,
                    example: 'Quanto tenho a receber de fiado?',
                  },
                  historico: {
                    type: 'array',
                    description:
                      'Conversa anterior, para dar contexto. As 20 mais recentes são usadas.',
                    items: {
                      type: 'object',
                      properties: {
                        papel: { type: 'string', enum: ['usuario', 'assistente'] },
                        texto: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok({
            type: 'object',
            properties: {
              resposta: {
                type: 'string',
                example: 'Você tem R$ 1.250,00 a receber, de 3 clientes.',
              },
              fontes: {
                type: 'array',
                description: 'Atalhos para as telas que têm o dado completo.',
                items: {
                  type: 'object',
                  properties: {
                    rotulo: { type: 'string', example: 'Fiados' },
                    para: { type: 'string', example: '/fiados' },
                  },
                },
              },
            },
          }),
          400: erro('Pergunta vazia ou acima de 1000 caracteres'),
          502: erro('O provedor de IA falhou ou demorou demais'),
          503: erro('Assistente não configurado (falta OPENROUTER_API_KEY)'),
        },
      },
    },
  },
};
