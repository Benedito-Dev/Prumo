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
  };
}
