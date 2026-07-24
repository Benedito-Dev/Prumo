// Configuração do Express: middlewares e rotas.
// Separado do server.js para facilitar testes futuros.
import express from 'express';
import cors from 'cors';
import routes from './routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Todas as rotas da API ficam sob /api
app.use('/api', routes);

// Rota raiz — cartão de visita da API
app.get('/', (req, res) => {
  res.json({ nome: 'Prumo API', versao: '0.1.0', docs: '/api/health' });
});

export default app;
