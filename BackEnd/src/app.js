// Configuração do Express: middlewares e rotas.
// Separado do server.js para facilitar testes futuros.
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import routes from './routes.js';
import { openapiSpec } from './docs/openapi.js';

const app = express();

app.use(cors());
app.use(express.json());

// Documentação interativa (Swagger UI) em /api/docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customSiteTitle: 'Prumo API — Docs',
}));
// Spec bruto em JSON, útil para importar em outras ferramentas
app.get('/api/openapi.json', (req, res) => res.json(openapiSpec));

// Todas as rotas da API ficam sob /api
app.use('/api', routes);

// Rota raiz — cartão de visita da API
app.get('/', (req, res) => {
  res.json({ nome: 'Prumo API', versao: '0.1.0', docs: '/api/docs' });
});

export default app;
