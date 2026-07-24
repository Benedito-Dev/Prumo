// Agregador central de rotas.
// Cada novo recurso (clientes, produtos, vendas...) entra aqui.
import { Router } from 'express';
import healthRoutes from './health/health.routes.js';
import clienteRoutes from './cliente/cliente.routes.js';
import categoriaRoutes from './categoria/categoria.routes.js';
import produtoRoutes from './produto/produto.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/clientes', clienteRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/produtos', produtoRoutes);
// router.use('/vendas', vendaRoutes);   ← próximo módulo (o núcleo)

export default router;
