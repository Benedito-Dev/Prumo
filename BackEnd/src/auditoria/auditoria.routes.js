// Rotas do histórico de alterações.
//
// Tudo restrito ao dono: o log mostra o que cada pessoa fez, e isso é
// informação de quem administra, não do balcão.
import { Router } from 'express';
import { requireDono } from '../auth/requireDono.js';
import * as auditoria from './auditoria.service.js';
import { responderErro } from '../config/erros.js';

const router = Router();

router.use(requireDono);

// GET /api/auditoria?usuario_id=&entidade=&de=&ate=&limite=
router.get('/', async (req, res) => {
  try {
    res.json(await auditoria.listar(req.query));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao carregar o histórico');
  }
});

// GET /api/auditoria/:entidade/:id — histórico de um registro específico.
router.get('/:entidade/:id', async (req, res) => {
  try {
    res.json(await auditoria.historicoDe(req.params.entidade, req.params.id));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao carregar o histórico');
  }
});

export default router;
