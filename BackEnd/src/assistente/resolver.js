// Resolve o que a pessoa FALA para um registro do banco (Fatia 4).
//
// A regra: a tool nunca escolhe. Ou acha um, ou devolve as opções para
// o Zé perguntar. Escolha errada grava dado errado em silêncio, e o
// usuário só descobre depois — pior que a pergunta a mais.
//
// A ambiguidade vira uma pergunta natural na conversa, não um
// mecanismo de segurança:
//
//   Você: "muda o preço do cimento pra 45"
//   Zé:   "Tenho dois: Cimento CP-II 50kg (R$ 42,00) e Cimento Mizu
//          50kg (R$ 38,00). Qual deles?"
//   Você: "o Mizu"
//   Zé:   chama a tool DE NOVO, agora com o id que veio nas opções
//
// Esse segundo turno só fecha porque as tools aceitam `id` além de
// `busca` — sem isso o Zé fica em laço, perguntando eternamente.
import { buscarProdutosPorNome, buscarProduto } from '../produto/produto.service.js';
import { buscarClientesPorNome, buscarCliente } from '../cliente/cliente.service.js';

// Quantas opções o Zé oferece de uma vez. Mais que isso não é uma
// pergunta de balcão, é uma lista — e o modelo despeja tudo na tela.
const MAX_OPCOES = 5;

// Decide entre "achei um", "não achei" e "achei vários".
// Devolve { item } ou { falha } — a falha já é o objeto que a tool retorna.
export function resolverUm(candidatos, termo, rotuloEntidade, rotularOpcao) {
  if (candidatos.length === 0) {
    return {
      falha: {
        ok: false,
        erro: `Não achei nenhum ${rotuloEntidade} com "${termo}".`,
      },
    };
  }

  if (candidatos.length === 1) return { item: candidatos[0] };

  // Nome digitado exato desempata: "Marcos" ganha de "Marcos Antônio".
  const alvo = String(termo).trim().toLowerCase();
  const exatos = candidatos.filter((c) => String(c.nome).toLowerCase() === alvo);
  if (exatos.length === 1) return { item: exatos[0] };

  const mostrados = candidatos.slice(0, MAX_OPCOES);
  const sobra = candidatos.length - mostrados.length;

  return {
    falha: {
      ok: false,
      erro:
        `Achei ${candidatos.length} ${rotuloEntidade}s com "${termo}"` +
        (sobra > 0 ? ` (mostrando ${MAX_OPCOES})` : '') +
        '. Pergunte qual antes de continuar e chame de novo usando o id da opção escolhida.',
      precisa_escolher: mostrados.map((c) => ({ id: c.id, rotulo: rotularOpcao(c) })),
    },
  };
}

// Acha UM produto por id (2º turno) ou por nome (1º turno).
// O id tem prioridade: quando ele vem, a pessoa já escolheu.
export async function resolverProduto({ id, busca }) {
  if (id) {
    const produto = await buscarProduto(id);
    if (!produto) {
      return { falha: { ok: false, erro: 'Esse produto não existe mais. Busque pelo nome.' } };
    }
    return { item: produto };
  }

  if (!busca) {
    return { falha: { ok: false, erro: 'Diga qual produto — pelo nome.' } };
  }

  const candidatos = await buscarProdutosPorNome(busca);
  return resolverUm(candidatos, busca, 'produto', (p) => rotuloProduto(p));
}

export async function resolverCliente({ id, busca }) {
  if (id) {
    const cliente = await buscarCliente(id);
    if (!cliente) {
      return { falha: { ok: false, erro: 'Esse cliente não existe mais. Busque pelo nome.' } };
    }
    return { item: cliente };
  }

  if (!busca) {
    return { falha: { ok: false, erro: 'Diga qual cliente — pelo nome.' } };
  }

  const candidatos = await buscarClientesPorNome(busca);
  return resolverUm(candidatos, busca, 'cliente', (c) => rotuloCliente(c));
}

// Como cada opção aparece para quem lê. Precisa carregar o que
// DISTINGUE um do outro: dois cimentos só se separam pelo preço e pela
// unidade; dois Marcos, pelo telefone.
export function rotuloProduto(p) {
  const preco = Number(p.preco_venda).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  return `${p.nome} — ${preco} / ${p.unidade}${p.ativo === false ? ' (inativo)' : ''}`;
}

export function rotuloCliente(c) {
  return c.telefone ? `${c.nome} — ${c.telefone}` : c.nome;
}
