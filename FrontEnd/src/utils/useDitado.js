// Ditado por voz usando a Web Speech API do navegador (nativa, sem custo).
// Suporte: Chrome, Edge e Safari. No Firefox a API não existe — o hook
// devolve suportado=false e a UI simplesmente não mostra o microfone.
//
// O reconhecimento do navegador não conhece nome próprio de depósito
// ("Vergalhao 10mm", "Jose Ferreira") e chuta pelo som. Quem conhece é o
// catálogo — por isso cada trecho final passa pelo corretor antes de virar
// texto. Sem vocabulário, o hook se comporta exatamente como antes.
import { useState, useRef, useEffect, useCallback } from 'react';
import { corrigir } from './corrigirDitado';

const Reconhecimento =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export const ditadoSuportado = Boolean(Reconhecimento);

// onTexto(textoFinal) é chamado a cada trecho que o navegador dá como
// definitivo. O parcial (enquanto a pessoa ainda fala) vem em `parcial`.
export function useDitado(onTexto, vocabulario) {
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState('');
  const reconhecimento = useRef(null);
  // Guarda o callback numa ref: assim os handlers nunca ficam com uma
  // versão velha da função sem precisar recriar o reconhecimento.
  const aoTexto = useRef(onTexto);
  aoTexto.current = onTexto;
  // Mesma razão para o vocabulário: ele chega depois (vem da API) e não
  // pode obrigar a recriar o reconhecimento no meio de uma fala.
  const vocab = useRef(vocabulario);
  vocab.current = vocabulario;

  useEffect(() => {
    if (!Reconhecimento) return;

    const r = new Reconhecimento();
    r.lang = 'pt-BR';
    r.continuous = true;      // não corta na primeira pausa
    r.interimResults = true;  // mostra o texto enquanto fala
    // O navegador tem várias hipóteses do que ouviu e antes só a primeira
    // era lida. Quando ela não casa com nada do catálogo mas a terceira
    // casa, é a terceira que vale — e isso não custa nada.
    r.maxAlternatives = 5;

    r.onresult = (evento) => {
      let novoParcial = '';
      // Cada resultado final vira uma correção independente: o corretor
      // trabalha por frase, e juntar tudo antes atrapalharia as janelas.
      const finais = [];

      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        if (resultado.isFinal) {
          const hipoteses = [];
          for (let h = 0; h < resultado.length; h++) {
            hipoteses.push(resultado[h].transcript);
          }
          finais.push(hipoteses);
        } else {
          // O parcial NÃO é corrigido de propósito: ele muda a cada
          // sílaba, e trocar nome no meio da fala faria o texto dançar
          // na tela. A correção acontece quando o trecho fecha.
          novoParcial += resultado[0].transcript;
        }
      }

      setParcial(novoParcial);

      for (const hipoteses of finais) {
        const texto = corrigir(hipoteses, vocab.current);
        if (texto) aoTexto.current?.(texto);
      }
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
