import { useEffect, useState } from 'react';
import { Printer, MessageCircle } from 'lucide-react';
import { lojaService } from '../services/loja';
import { reciboTermico, linkWhatsApp } from '../utils/recibo';

// Botões de imprimir e mandar no WhatsApp o recibo de uma venda.
//
// Vive em components/ porque duas telas o usam: a confirmação pós-venda
// (NovaVenda) e o detalhe da venda (Vendas) — é o caso em que o projeto
// manda promover o sub-componente.
//
// A impressão usa uma janela própria com o texto em <pre> monoespaçado, em
// vez de window.print() na página inteira: a tela do Prumo tem menu,
// cartões e cores que não têm o que fazer numa bobina de 80mm.

// @page com largura de 80mm faz a impressora térmica usar a bobina inteira
// sem margem de A4. Em impressora comum o mesmo CSS sai como uma tira
// estreita no meio da folha, que ainda serve de comprovante.
const ESTILO_IMPRESSAO = `
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    line-height: 1.35;
    color: #000;
    background: #fff;
  }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
`;

export default function AcoesRecibo({ venda, telefoneCliente = '', compacto = false }) {
  const [loja, setLoja] = useState(null);
  const [erro, setErro] = useState('');

  // O cabeçalho é opcional: se a requisição falhar, o recibo sai com a
  // marca PRUMO em vez de travar a impressão. Nunca deixe a identificação
  // da loja impedir o cliente de sair com o papel.
  useEffect(() => {
    let ativo = true;
    lojaService
      .dados()
      .then((d) => ativo && setLoja(d))
      .catch(() => ativo && setLoja({}));
    return () => {
      ativo = false;
    };
  }, []);

  function imprimir() {
    setErro('');
    const texto = reciboTermico(venda, loja || {});
    const janela = window.open('', '_blank', 'width=380,height=640');
    // Bloqueador de pop-up ativo: sem janela não há o que imprimir.
    if (!janela) {
      setErro('Libere as janelas pop-up deste site para imprimir o recibo.');
      return;
    }

    // textContent (não innerHTML): nome de produto com < ou & viraria
    // marcação no meio do recibo.
    const doc = janela.document;
    doc.title = `Recibo ${String(venda.id || '').slice(0, 8).toUpperCase()}`;
    const estilo = doc.createElement('style');
    estilo.textContent = ESTILO_IMPRESSAO;
    doc.head.appendChild(estilo);
    const pre = doc.createElement('pre');
    pre.textContent = texto;
    doc.body.appendChild(pre);

    // O foco antes do print evita que o diálogo abra atrás da janela
    // principal em alguns navegadores.
    janela.focus();
    janela.print();
  }

  function mandarWhatsApp() {
    window.open(linkWhatsApp(venda, loja || {}, telefoneCliente), '_blank');
  }

  const classe = compacto
    ? 'flex-1 h-11 rounded-p border border-linha text-[13px] font-semibold text-grafite hover:bg-concreto flex items-center justify-center gap-1.5'
    : 'flex-1 py-3 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto flex items-center justify-center gap-2';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button onClick={imprimir} className={classe}>
          <Printer size={compacto ? 15 : 16} /> Imprimir
        </button>
        <button onClick={mandarWhatsApp} className={classe}>
          <MessageCircle size={compacto ? 15 : 16} /> WhatsApp
        </button>
      </div>
      {erro && <p className="text-[12.5px] text-prumo font-semibold">{erro}</p>}
    </div>
  );
}
