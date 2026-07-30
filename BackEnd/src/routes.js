// Agregador central de rotas.
// Cada novo recurso (clientes, produtos, vendas...) entra aqui.
import { Router } from 'express';
import healthRoutes from './health/health.routes.js';
import authRoutes from './auth/auth.routes.js';
import clienteRoutes from './cliente/cliente.routes.js';
import categoriaRoutes from './categoria/categoria.routes.js';
import produtoRoutes from './produto/produto.routes.js';
import usuarioRoutes from './usuario/usuario.routes.js';
import vendaRoutes from './venda/venda.routes.js';
import painelRoutes from './painel/painel.routes.js';
import fiadoRoutes from './fiado/fiado.routes.js';
import { requireAuth } from './auth/requireAuth.js';

const router = Router();

// --- Rotas públicas (sem token) ---
router.use('/health', healthRoutes); // status da API/banco
router.use('/auth', authRoutes); // login, refresh, logout

// --- Rotas protegidas (exigem access token válido) ---
// A partir daqui tudo passa pelo requireAuth.
router.use(requireAuth);
router.use('/clientes', clienteRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/produtos', produtoRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/vendas', vendaRoutes);
router.use('/painel', painelRoutes);
router.use('/fiados', fiadoRoutes);

export default router;
