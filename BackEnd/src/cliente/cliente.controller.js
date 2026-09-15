// Controller de clientes (RF01–RF05).
// Casca HTTP — a regra mora em cliente.service.js.
import { responderErro } from '../config/erros.js';
import * as clientes from './cliente.service.js';

// Quantos clientes uma busca do balcão pode devolver ao vendedor.
// Procurar "João" e receber 5 nomes é atendimento; receber a lista inteira
// é a carteira da loja saindo pela porta.
const MAX_BUSCA_VENDEDOR = 8;

// GET /api/clientes?busca=termo
//
// O dono recebe a lista completa. O vendedor **precisa** achar cliente para
// lançar venda (sem isso toda venda vira "Consumidor", que some do
// histórico e do ranking e não dá para corrigir depois) — mas recebe só o
// resultado de uma busca, nunca a lista inteira.
export async function listarClientes(req, res) {
  try {
    const ehDono = req.usuario.papel === 'dono';
    const busca = (req.query.busca || '').trim();

    if (!ehDono) {
      // Sem termo de busca não há o que atender: devolver tudo aqui seria
      // a mesma exposição que a tela de Clientes, por outra porta.
      if (busca.length < 2) return res.json([]);

      const achados = await clientes.listarClientes({ busca });
      return res.json(achados.slice(0, MAX_BUSCA_VENDEDOR));
    }

    res.json(await clientes.listarClientes(req.query));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao listar clientes');
  }
}

// GET /api/clientes/estatisticas
export async function estatisticasClientes(req, res) {
  try {
    res.json(await clientes.estatisticasClientes());
  } catch (erro) {
    responderErro(res, erro, 'Falha ao carregar estatísticas');
  }
}

// GET /api/clientes/:id
export async function buscarCliente(req, res) {
  try {
    res.json(await clientes.exigirCliente(req.params.id));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao buscar cliente');
  }
}

// POST /api/clientes
export async function criarCliente(req, res) {
  try {
    res.status(201).json(await clientes.criarCliente(req.body, req.usuario));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao criar cliente');
  }
}

// PUT /api/clientes/:id
export async function atualizarCliente(req, res) {
  try {
    res.json(await clientes.atualizarCliente(req.params.id, req.body, req.usuario));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao atualizar cliente');
  }
}

// DELETE /api/clientes/:id
export async function removerCliente(req, res) {
  try {
    await clientes.removerCliente(req.params.id, req.usuario);
    res.status(204).send();
  } catch (erro) {
    responderErro(res, erro, 'Falha ao remover cliente');
  }
}
