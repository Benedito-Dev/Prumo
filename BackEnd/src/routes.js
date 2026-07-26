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

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/clientes', clienteRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/produtos', produtoRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/vendas', vendaRoutes);
router.use('/painel', painelRoutes);

export default router;
