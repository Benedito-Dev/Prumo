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
    },
  },

  Usuario: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      nome: { type: 'string', example: 'Benedito' },
      email: { type: 'string', format: 'email', example: 'benedito@prumo.com' },
      papel: { type: 'string', enum: ['dono', 'vendedor', 'caixa', 'estoque'] },
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
      papel: { type: 'string', enum: ['dono', 'vendedor', 'caixa', 'estoque'] },
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
      valor_total: { type: 'string', example: '1720.00' },
      status: { type: 'string', enum: ['concluida', 'cancelada'] },
      vendida_em: { type: 'string', format: 'date-time' },
      cancelada_em: { type: 'string', format: 'date-time', nullable: true },
      itens: { type: 'array', items: { $ref: '#/components/schemas/ItemVenda' } },
    },
  },
  VendaEntrada: {
    type: 'object',
    required: ['usuario_id', 'forma_pagamento', 'itens'],
    properties: {
      cliente_id: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Ausente/null = venda "Consumidor"',
      },
      usuario_id: { type: 'string', format: 'uuid', description: 'Quem vendeu (obrigatório)' },
      forma_pagamento: {
        type: 'string',
        enum: ['dinheiro', 'pix', 'cartao', 'fiado'],
      },
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
    { name: 'Painel', description: 'Indicadores do painel (RF16–RF22)' },
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
        responses: { 200: ok(listaDe('Usuario')) },
      },
      post: {
        tags: ['Usuários'],
        summary: 'Cria um usuário (senha guardada com hash)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('UsuarioEntrada') } },
        },
        responses: {
          201: ok(ref('Usuario'), 'Criado'),
          400: erro('Dados inválidos'),
          409: erro('E-mail já existe'),
        },
      },
    },
    '/usuarios/{id}': {
      get: {
        tags: ['Usuários'],
        summary: 'Busca um usuário',
        parameters: [paramId],
        responses: { 200: ok(ref('Usuario')), 404: erro('Não encontrado') },
      },
    },
    '/usuarios/{id}/ativo': {
      patch: {
        tags: ['Usuários'],
        summary: 'Ativa/desativa um usuário (soft, preserva histórico)',
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
          404: erro('Não encontrado'),
        },
      },
    },

    // ---------------- VENDAS ----------------
    '/vendas': {
      get: {
        tags: ['Vendas'],
        summary: 'Lista vendas (filtro de período)',
        parameters: [
          { name: 'de', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'ate', in: 'query', schema: { type: 'string', format: 'date' } },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['concluida', 'cancelada'] },
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
        summary: 'Total, nº de vendas e ticket médio (RF18)',
        parameters: [
          {
            name: 'periodo',
            in: 'query',
            schema: { type: 'string', enum: ['hoje', 'semana', 'mes', 'ano'] },
          },
          { name: 'de', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'ate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: ok({ type: 'object' }) },
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
  },
};
