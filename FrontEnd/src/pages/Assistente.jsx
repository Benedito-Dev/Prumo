import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Send, ArrowRight, RotateCcw, Mic, Square } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { assistenteService, SUGESTOES } from '../services/assistente';
import { useDitado } from '../utils/useDitado';
import { useAuth } from '../auth/AuthContext';

// Chat com IA sobre os dados do negócio.
// Cada resposta pode vir com "fontes": atalhos para a tela que tem o dado
// completo — o chat responde, a tela comprova.
export default function Assistente() {
  const { usuario } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [entrada, setEntrada] = useState('');
  const [pensando, setPensando] = useState(false);
  const fimDaLista = useRef(null);
  const campo = useRef(null);

  // Ditado: cada trecho final é acrescentado ao que já está escrito,
  // para a pessoa poder misturar voz e teclado na mesma pergunta.
  const ditado = useDitado((trecho) => {
    setEntrada((atual) => (atual ? `${atual.trimEnd()} ` : '') + trecho.trim());
  });

  // Rola para a última mensagem sempre que a conversa cresce.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, pensando]);

  async function enviar(texto) {
    const pergunta = (texto ?? entrada).trim();
    if (!pergunta || pensando) return;
    ditado.parar(); // não deixa o microfone aberto depois de enviar

    // Histórico ANTES de acrescentar a pergunta atual (o back recebe o
    // contexto anterior; a pergunta vai no campo próprio).
    const historico = mensagens
      .filter((m) => !m.erro)
      .map((m) => ({ papel: m.papel, texto: m.texto }));

    setMensagens((ms) => [...ms, { papel: 'usuario', texto: pergunta }]);
    setEntrada('');
    setPensando(true);

    try {
      const r = await assistenteService.perguntar(pergunta, historico);
      setMensagens((ms) => [
        ...ms,
        { papel: 'assistente', texto: r.resposta, fontes: r.fontes || [] },
      ]);
    } catch (e) {
      setMensagens((ms) => [
        ...ms,
        {
          papel: 'assistente',
          erro: true,
          texto:
            e.message === 'Sessão expirada'
              ? 'Sua sessão expirou. Entre novamente para continuar.'
              : 'O Zé não conseguiu responder agora. Tente de novo em instantes.',
        },
      ]);
    } finally {
      setPensando(false);
      campo.current?.focus();
    }
  }

  // Enter envia, Shift+Enter quebra linha.
  function aoTeclar(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  const vazio = mensagens.length === 0;
  const primeiroNome = usuario?.nome?.split(' ')[0];

  return (
    <LayoutApp
      titulo="Zé"
      acao={
        !vazio && (
          <button
            onClick={() => setMensagens([])}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-grafite-medio hover:text-grafite"
          >
            <RotateCcw size={15} /> Nova conversa
          </button>
        )
      }
    >
      <div className="h-[calc(100vh-56px-32px)] min-h-[500px] flex flex-col max-w-[820px] mx-auto">
        {/* ---------- conversa ---------- */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {vazio ? (
            <BoasVindas nome={primeiroNome} onEscolher={enviar} />
          ) : (
            <div className="flex flex-col gap-4 py-2">
              {mensagens.map((m, i) => (
                <Mensagem key={i} {...m} />
              ))}
              {pensando && <Pensando />}
              <div ref={fimDaLista} />
            </div>
          )}
        </div>

        {/* ---------- campo de pergunta ---------- */}
        <div className="shrink-0 pt-3">
          <div
            className={`flex items-end gap-2 bg-superficie border-2 rounded-md px-3 py-2 transition-colors ${
              ditado.ouvindo
                ? 'border-prumo'
                : 'border-linha focus-within:border-grafite'
            }`}
          >
            <div className="flex-1 min-w-0">
              <textarea
                ref={campo}
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                onKeyDown={aoTeclar}
                rows={1}
                autoFocus
                placeholder={
                  ditado.ouvindo
                    ? 'Ouvindo… pode falar'
                    : 'Pergunte sobre suas vendas, clientes, fiados…'
                }
                className="w-full resize-none bg-transparent text-[14px] py-1.5 outline-none max-h-32"
              />
              {/* o que o navegador ainda está transcrevendo */}
              {ditado.parcial && (
                <p className="text-[13.5px] text-grafite-medio italic pb-1">
                  {ditado.parcial}
                </p>
              )}
            </div>

            {ditado.suportado && (
              <button
                onClick={ditado.alternar}
                disabled={pensando}
                title={ditado.ouvindo ? 'Parar de ditar' : 'Ditar a pergunta'}
                aria-label={ditado.ouvindo ? 'Parar de ditar' : 'Ditar a pergunta'}
                className={`w-9 h-9 shrink-0 rounded-p flex items-center justify-center border transition-colors disabled:opacity-40 ${
                  ditado.ouvindo
                    ? 'bg-prumo border-prumo text-white animate-pulse'
                    : 'border-linha text-grafite-medio hover:text-grafite hover:border-grafite'
                }`}
              >
                {ditado.ouvindo ? <Square size={14} /> : <Mic size={16} />}
              </button>
            )}

            <button
              onClick={() => enviar()}
              disabled={!entrada.trim() || pensando}
              title="Enviar"
              aria-label="Enviar pergunta"
              className="w-9 h-9 shrink-0 rounded-p bg-trena hover:bg-trena-escuro text-trena-texto flex items-center justify-center disabled:opacity-40 disabled:hover:bg-trena transition-colors"
            >
              <Send size={16} />
            </button>
          </div>

          {ditado.erro ? (
            <p className="text-[11.5px] text-prumo font-semibold mt-1.5 px-1">
              {ditado.erro}
            </p>
          ) : (
            <p className="text-[11px] text-grafite-medio mt-1.5 px-1">
              O Zé responde com base nos seus dados. Confira os números na tela
              correspondente antes de decidir.
            </p>
          )}
        </div>
      </div>
    </LayoutApp>
  );
}

// ---------- estado inicial ----------
function BoasVindas({ nome, onEscolher }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <span className="w-14 h-14 rounded-full bg-trena/15 text-trena-escuro flex items-center justify-center mb-4">
        <Sparkles size={26} />
      </span>
      <p className="text-[20px] font-bold">
        {nome ? `Olá, ${nome}. Aqui é o Zé.` : 'Olá. Aqui é o Zé.'}
      </p>
      <p className="text-[13.5px] text-grafite-medio mt-1.5 max-w-[420px]">
        Pergunte em português sobre o seu depósito — vendas, clientes, fiados
        ou produtos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-[560px]">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            onClick={() => onEscolher(s)}
            className="group flex items-center justify-between gap-2 text-left px-4 py-3 rounded-md border border-linha bg-superficie text-[13px] font-medium hover:border-grafite transition-colors"
          >
            {s}
            <ArrowRight
              size={14}
              className="shrink-0 text-grafite-medio/50 group-hover:text-grafite transition-colors"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- balão de mensagem ----------
function Mensagem({ papel, texto, fontes = [], erro = false }) {
  const ehUsuario = papel === 'usuario';

  if (ehUsuario) {
    return (
      <div className="flex justify-end">
        {/* trena é fixa nos dois temas — grafite viraria quase-branco no escuro */}
        <div className="max-w-[80%] bg-trena text-trena-texto rounded-md rounded-br-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm">
          {texto}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
          erro ? 'bg-prumo/10 text-prumo' : 'bg-trena/15 text-trena-escuro'
        }`}
      >
        <Sparkles size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`inline-block max-w-full rounded-md rounded-tl-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap border ${
            erro
              ? 'bg-prumo/5 border-prumo/30 text-prumo font-medium'
              : 'bg-superficie border-linha'
          }`}
        >
          {texto}
        </div>

        {/* atalhos para a tela que tem o dado completo */}
        {fontes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {fontes.map((f) => (
              <Link
                key={f.para}
                to={f.para}
                className="flex items-center gap-1 px-2.5 py-1 rounded-p border border-linha text-[12px] font-semibold text-grafite-medio hover:border-grafite hover:text-grafite transition-colors"
              >
                {f.rotulo} <ArrowRight size={12} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- "digitando" ----------
function Pensando() {
  return (
    <div className="flex gap-2.5">
      <span className="w-8 h-8 shrink-0 rounded-full bg-trena/15 text-trena-escuro flex items-center justify-center">
        <Sparkles size={15} />
      </span>
      <div className="bg-superficie border border-linha rounded-md rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 150, 300].map((atraso) => (
          <span
            key={atraso}
            className="w-1.5 h-1.5 rounded-full bg-grafite-medio/50 animate-bounce"
            style={{ animationDelay: `${atraso}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
