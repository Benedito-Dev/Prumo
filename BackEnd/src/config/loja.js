// Identificação da loja — usada no cabeçalho do recibo.
//
// Mora em variável de ambiente, não no banco: não há ferramenta de
// migração (alterar o schema exige `docker compose down -v`), e criar uma
// tabela de uma linha só para três campos custaria mais do que resolve.
// Quando existir tela de configuração, isto vira o valor padrão dela.
//
// Todos os campos são opcionais: sem nenhum, o recibo sai com a marca
// PRUMO e os dados da venda, que já servem de comprovante.
export function dadosDaLoja() {
  return {
    nome: process.env.LOJA_NOME || 'PRUMO',
    telefone: process.env.LOJA_TELEFONE || '',
    endereco: process.env.LOJA_ENDERECO || '',
    prazo_fiado_dias: prazoFiadoDias(),
  };
}

// Prazo padrão do fiado, em dias.
//
// Não é data por venda: o schema não tem essa coluna e criá-la exigiria
// recriar o banco (não há ferramenta de migração). Um prazo geral também
// reflete melhor como depósito combina — "pra semana que vem", "final do
// mês" — e vale retroativamente para as dívidas que já existem.
//
// 30 dias é o padrão do ramo. Valor inválido cai nele em vez de deixar a
// loja sem prazo nenhum: um NaN aqui faria toda dívida parecer vencida.
export function prazoFiadoDias() {
  const n = Number(process.env.LOJA_PRAZO_FIADO_DIAS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}
