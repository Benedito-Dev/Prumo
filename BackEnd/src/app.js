// Configuração do Express: middlewares e rotas.
// Separado do server.js para facilitar testes futuros.
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import routes from './routes.js';
import { openapiSpec } from './docs/openapi.js';

const app = express();

// A API roda atrás do proxy do Vite em desenvolvimento e de um reverse
// proxy em produção. Sem isso, req.ip é sempre o do proxy e o limite de
// tentativas de login contaria a loja inteira como um visitante só.
// O 1 é o número de saltos confiáveis — não use `true`, que faria a API
// aceitar qualquer X-Forwarded-For forjado e o limite viraria decoração.
app.set('trust proxy', 1);

// credentials:true permite o cookie httpOnly do refresh trafegar
app.use(cors({ origin: true, credentials: true }));

// Teto de 256 KB: uma venda de balcão tem alguns itens, não megabytes.
// Sem limite, um corpo gigante ocupa memória do processo antes de
// qualquer validação rodar.
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// JSON malformado (ou grande demais) é erro de quem chamou, não do
// servidor. Sem este middleware, o express.json lança e a requisição cai
// no handler genérico como 500 — dizendo "Falha inesperada" para um
// problema que está no corpo enviado.
app.use((erro, req, res, next) => {
  if (erro?.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Requisição grande demais.' });
  }
  if (erro instanceof SyntaxError && 'body' in erro) {
    return res.status(400).json({ erro: 'Requisição malformada.' });
  }
  next(erro);
});

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

// Endereço que não existe. Sem isto, o Express devolve uma página HTML de
// erro para um cliente que só sabe ler JSON.
app.use((req, res) => {
  res.status(404).json({ erro: 'Endereço não encontrado' });
});

// Rede de segurança: só chega aqui o erro que escapou do try/catch de um
// controller. Hoje todos se protegem — este middleware existe para o dia em
// que um controller novo esquecer, porque o padrão do Express nesse caso é
// devolver a stack trace inteira em HTML.
//
// O `next` é obrigatório mesmo sem uso: é a assinatura de 4 argumentos que
// diz ao Express que este middleware trata erro, e não requisição.
// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  console.error('[erro] Exceção não tratada:', erro);
  if (res.headersSent) return; // resposta já começou — deixa o Express encerrar
  res.status(500).json({ erro: 'Falha inesperada. Tente de novo.' });
});

export default app;
