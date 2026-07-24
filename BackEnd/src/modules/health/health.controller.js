// Controller de health-check: confirma que a API está no ar
// e que ela consegue conversar com o banco de dados.
import { query } from '../../config/db.js';

export async function healthCheck(req, res) {
  try {
    const resultado = await query('SELECT NOW() AS agora');
    res.json({
      status: 'ok',
      api: 'no ar',
      banco: 'conectado',
      hora_do_banco: resultado.rows[0].agora,
    });
  } catch (erro) {
    res.status(503).json({
      status: 'erro',
      api: 'no ar',
      banco: 'sem conexão',
      detalhe: erro.message,
    });
  }
}
