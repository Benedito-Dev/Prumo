// Tools de escrita de cliente (Fatia 2).
//
// Vendedor também usa: cliente novo chega no balcão e a venda não pode
// parar esperando o dono. Corrigir telefone errado é trabalho de balcão.
//
// Nenhuma das duas confirma antes de gravar — mesmo raciocínio de
// tools.produto.js. A conferência é a leitura do registro depois.

import {
  TIPOS_VALIDOS,
  criarCliente,
  atualizarClienteParcial,
  buscarClientesPorNome,
} from '../cliente/cliente.service.js';
import { protegido, resolverUnico, diferencas } from './tools.escrita.comum.js';

const FONTE = { rotulo: 'Clientes', para: '/clientes' };

const CAMPOS_COMPARADOS = [
  { campo: 'nome', rotulo: 'Nome' },
  { campo: 'telefone', rotulo: 'Telefone' },
  { campo: 'tipo', rotulo: 'Tipo' },
  { campo: 'observacao', rotulo: 'Observação' },
];

// Campo vazio aparece explícito, como no produto: "sem tipo" é o que faz
// a pessoa perceber que esqueceu de dizer que o João é pedreiro.
function resumirCliente(c) {
  return [
    c.nome,
    c.telefone,
    c.tipo ? c.tipo.replace(/_/g, ' ') : 'sem tipo',
    c.observacao ? c.observacao : 'sem observação',
  ].join(' · ');
}

async function acharCliente(busca) {
  const candidatos = await buscarClientesPorNome(busca);
  return resolverUnico(candidatos, busca, 'cliente', (c) => `${c.nome} (${c.telefone})`);
}

export const TOOLS_CLIENTE = {
  criar_cliente: {
    papeis: '*',
    fonte: FONTE,
    schema: {
      name: 'criar_cliente',
      description:
        'Cadastra um cliente novo. Use para "cadastra o João Silva, 98812-3344". Grava na hora — não peça confirmação antes. O telefone é OBRIGATÓRIO: se o usuário só disser o nome, pergunte o telefone antes de chamar esta função. Nunca invente um número.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do cliente.' },
          telefone: {
            type: 'string',
            description: 'Telefone do cliente, como ele falou. Obrigatório — pergunte se não souber.',
          },
          tipo: {
            type: 'string',
            enum: TIPOS_VALIDOS,
            description: 'Que tipo de comprador é. Opcional — só mande se o usuário disser.',
          },
          observacao: { type: 'string', description: 'Anotação livre sobre o cliente. Opcional.' },
        },
        required: ['nome', 'telefone'],
      },
    },
    async executar(args) {
      return protegido(async () => {
        const registro = await criarCliente({
          nome: args.nome,
          telefone: args.telefone,
          tipo: args.tipo,
          observacao: args.observacao,
        });

        return {
          ok: true,
          acao: 'criado',
          entidade: 'cliente',
          registro,
          resumo: resumirCliente(registro),
        };
      }, 'Não consegui cadastrar o cliente agora.');
    },
  },

  editar_cliente: {
    papeis: '*',
    fonte: FONTE,
    schema: {
      name: 'editar_cliente',
      description:
        'Altera um cliente que já existe, achando-o pelo nome. Use para "corrige o telefone do João para 98812-3344". Mande APENAS os campos que o usuário pediu para mudar: o que você não mandar continua como está. Grava na hora — não peça confirmação antes.',
      parameters: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Parte do nome do cliente, como o usuário falou.' },
          nome: { type: 'string', description: 'Novo nome. Só mande se o usuário pediu para renomear.' },
          telefone: { type: 'string', description: 'Novo telefone.' },
          tipo: { type: 'string', enum: TIPOS_VALIDOS, description: 'Novo tipo de comprador.' },
          observacao: { type: 'string', description: 'Nova anotação. Substitui a anterior.' },
        },
        required: ['busca'],
      },
    },
    async executar(args) {
      return protegido(async () => {
        const achado = await acharCliente(args.busca);
        if (achado.falha) return achado.falha;
        const antes = achado.item;

        // Só o que o usuário citou. Ausente é "não mencionou", e o merge
        // parcial preserva — nunca vira NULL.
        const alteracoes = {};
        if (args.nome !== undefined) alteracoes.nome = args.nome;
        if (args.telefone !== undefined) alteracoes.telefone = args.telefone;
        if (args.tipo !== undefined) alteracoes.tipo = args.tipo;
        if (args.observacao !== undefined) alteracoes.observacao = args.observacao;

        const depois = await atualizarClienteParcial(antes.id, alteracoes);
        const mudancas = diferencas(antes, depois, CAMPOS_COMPARADOS);

        return {
          ok: true,
          acao: 'editado',
          entidade: 'cliente',
          registro: depois,
          alteracoes: mudancas,
          resumo: mudancas.length
            ? `${depois.nome}: ${mudancas
                .map((m) => `${m.rotulo} ${m.de ?? 'vazio'} → ${m.para ?? 'vazio'}`)
                .join('; ')}`
            : `Nada mudou em ${depois.nome} — os valores enviados já eram os que estavam gravados.`,
        };
      }, 'Não consegui alterar o cliente agora.');
    },
  },
};
