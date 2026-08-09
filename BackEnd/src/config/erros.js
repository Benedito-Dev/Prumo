// Erro de regra de negócio — a ponte entre os services e quem os chama.
//
// Um service não sabe o que é HTTP: ele lança ErroNegocio e quem chamou
// decide o que fazer. O controller traduz em status + JSON; as tools do
// Zé (fatias seguintes) traduzem em texto para o modelo explicar.
//
// `status` é a sugestão de código HTTP e `codigo` é o identificador
// estável para quem precisa decidir por programa, sem casar string de
// mensagem — que muda com o tempo e é escrita para gente ler.
export class ErroNegocio extends Error {
  constructor(mensagem, { status = 400, codigo = 'regra_de_negocio' } = {}) {
    super(mensagem);
    this.name = 'ErroNegocio';
    this.status = status;
    this.codigo = codigo;
  }
}

// Açúcar para os casos que se repetem nos services.
export const naoEncontrado = (mensagem) =>
  new ErroNegocio(mensagem, { status: 404, codigo: 'nao_encontrado' });

export const conflito = (mensagem) =>
  new ErroNegocio(mensagem, { status: 409, codigo: 'conflito' });

// Responde uma requisição a partir de um erro qualquer.
// ErroNegocio vira o status que ele mesmo declarou; o resto é 500 com o
// detalhe da exceção — exatamente o formato que os controllers já usavam.
export function responderErro(res, erro, mensagem500) {
  if (erro instanceof ErroNegocio) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  return res.status(500).json({ erro: mensagem500, detalhe: erro.message });
}
