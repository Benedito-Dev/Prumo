// Agregador central de rotas.
// Cada novo recurso (clientes, produtos, vendas...) entra aqui.
import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);
// router.use('/clientes', clienteRoutes);   ← próximas fases
// router.use('/produtos', produtoRoutes);
// router.use('/vendas', vendaRoutes);

export default router;
