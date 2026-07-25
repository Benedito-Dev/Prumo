// Resolve o intervalo de datas do painel (RF21).
// Aceita ?periodo=hoje|semana|mes|ano OU ?de=YYYY-MM-DD&ate=YYYY-MM-DD.
// Retorna { de, ate } como strings ISO (ate é EXCLUSIVO — início do dia seguinte).

function inicioDoDia(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function resolverPeriodo(query) {
  const { periodo, de, ate } = query;
  const agora = new Date();

  // Intervalo customizado tem prioridade
  if (de || ate) {
    const inicio = de ? inicioDoDia(de) : new Date(0);
    // ate é inclusivo para o usuário -> somamos 1 dia para virar exclusivo na query
    let fim;
    if (ate) {
      fim = inicioDoDia(ate);
      fim.setDate(fim.getDate() + 1);
    } else {
      fim = new Date(agora);
      fim.setDate(fim.getDate() + 1);
    }
    return { de: inicio.toISOString(), ate: fim.toISOString() };
  }

  let inicio;
  switch (periodo) {
    case 'hoje':
      inicio = inicioDoDia(agora);
      break;
    case 'semana': {
      // últimos 7 dias (inclui hoje)
      inicio = inicioDoDia(agora);
      inicio.setDate(inicio.getDate() - 6);
      break;
    }
    case 'ano':
      inicio = new Date(agora.getFullYear(), 0, 1);
      break;
    case 'mes':
    default:
      // padrão: mês corrente
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      break;
  }

  const fim = new Date(agora);
  fim.setDate(fim.getDate() + 1);
  fim.setHours(0, 0, 0, 0);
  return { de: inicio.toISOString(), ate: fim.toISOString() };
}

// Mês corrente e mês anterior — para a comparação do RF16.
export function mesCorrenteEAnterior() {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  return {
    inicioMes: inicioMes.toISOString(),
    inicioMesAnterior: inicioMesAnterior.toISOString(),
    agora: agora.toISOString(),
  };
}
