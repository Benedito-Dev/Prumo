// Ditado por voz usando a Web Speech API do navegador (nativa, sem custo).
// Suporte: Chrome, Edge e Safari. No Firefox a API não existe — o hook
// devolve suportado=false e a UI simplesmente não mostra o microfone.
import { useState, useRef, useEffect, useCallback } from 'react';

const Reconhecimento =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export const ditadoSuportado = Boolean(Reconhecimento);

// onTexto(textoFinal) é chamado a cada trecho que o navegador dá como
// definitivo. O parcial (enquanto a pessoa ainda fala) vem em `parcial`.
export function useDitado(onTexto) {
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState('');
  const reconhecimento = useRef(null);
  // Guarda o callback numa ref: assim os handlers nunca ficam com uma
  // versão velha da função sem precisar recriar o reconhecimento.
  const aoTexto = useRef(onTexto);
  aoTexto.current = onTexto;

  useEffect(() => {
    if (!Reconhecimento) return;

    const r = new Reconhecimento();
    r.lang = 'pt-BR';
    r.continuous = true;      // não corta na primeira pausa
    r.interimResults = true;  // mostra o texto enquanto fala

    r.onresult = (evento) => {
      let novoFinal = '';
      let novoParcial = '';
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const trecho = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) novoFinal += trecho;
        else novoParcial += trecho;
      }
      setParcial(novoParcial);
      if (novoFinal) aoTexto.current?.(novoFinal);
    };

    r.onerror = (evento) => {
      // "aborted" e "no-speech" são normais (parou sozinho / silêncio).
      if (evento.error === 'aborted' || evento.error === 'no-speech') return;
      setErro(
        evento.error === 'not-allowed'
          ? 'Permita o uso do microfone no navegador para ditar.'
          : 'Não consegui captar o áudio. Tente de novo.'
      );
      setOuvindo(false);
    };

    r.onend = () => {
      setOuvindo(false);
      setParcial('');
    };

    reconhecimento.current = r;
    return () => {
      r.onresult = r.onerror = r.onend = null;
      r.abort();
    };
  }, []);

  const alternar = useCallback(() => {
    const r = reconhecimento.current;
    if (!r) return;

    if (ouvindo) {
      r.stop();
      return;
    }
    setErro('');
    setParcial('');
    try {
      r.start();
      setOuvindo(true);
    } catch {
      // start() lança se já estiver rodando — ignora.
    }
  }, [ouvindo]);

  const parar = useCallback(() => {
    if (ouvindo) reconhecimento.current?.stop();
  }, [ouvindo]);

  return { suportado: ditadoSuportado, ouvindo, parcial, erro, alternar, parar };
}
