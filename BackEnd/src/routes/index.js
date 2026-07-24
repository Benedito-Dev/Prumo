// Agregador central de rotas.
// Cada novo recurso (clientes, produtos, vendas...) entra aqui.
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import clienteRoutes from './cliente.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/clientes', clienteRoutes);
// router.use('/produtos', produtoRoutes);   ← próximas etapas
// router.use('/vendas', vendaRoutes);

export default router;
