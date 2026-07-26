// Formatação de valores para exibição (pt-BR).

// R$ 48.230,00 — moeda cheia
export function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// R$ 48.230 — moeda curta, sem centavos (para KPIs grandes)
export function moedaCurta(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

// 1.480 — número com separador de milhar
export function numero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

// Quantidade que pode ter decimais (1,5 m³) mas some o ,00 quando inteiro
export function quantidade(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
