// Vocabulário do depósito (nomes de produtos e clientes) para o corretor de
// ditado consultar. O reconhecimento de voz do navegador não conhece nome
// próprio de catálogo — quem conhece é o banco, então trazemos a lista uma vez
// e deixamos em memória.
import { useState, useEffect, useCallback, useRef } from 'react';
import { produtosService } from '../services/produtos';
import { clientesService } from '../services/clientes';

const VAZIO = { produtos: [], clientes: [] };

// Só os nomes, sem vazio nem repetido — é tudo que o corretor compara.
function nomes(lista) {
  if (!Array.isArray(lista)) return [];
  const limpos = lista
    .map((item) => (typeof item?.nome === 'string' ? item.nome.trim() : ''))
    .filter(Boolean);
  return [...new Set(limpos)];
}

export function useVocabulario() {
  const [vocabulario, setVocabulario] = useState(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // Cada carga tem um número; só a mais recente pode escrever no estado.
  // Assim o StrictMode (que monta o efeito duas vezes em dev) e um
  // recarregar() disparado no meio do caminho não brigam pelo resultado.
  const cargaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    setCarregando(true);
    setErro('');
    try {
      const [produtos, clientes] = await Promise.all([
        produtosService.listar(),
        clientesService.listar(),
      ]);
      if (carga !== cargaAtual.current) return;
      setVocabulario({ produtos: nomes(produtos), clientes: nomes(clientes) });
    } catch (e) {
      // Falha aqui não pode derrubar a tela: sem vocabulário o ditado apenas
      // deixa de corrigir nomes, que é o comportamento de antes deste recurso.
      if (carga !== cargaAtual.current) return;
      setVocabulario(VAZIO);
      setErro(e?.message || 'Não consegui carregar o vocabulário.');
    } finally {
      if (carga === cargaAtual.current) setCarregando(false);
    }
  }, []);

  // carregar() é estável, então o efeito roda uma vez por montagem — nunca a
  // cada render.
  useEffect(() => {
    carregar();
  }, [carregar]);

  return { vocabulario, carregando, erro, recarregar: carregar };
}
