import { useState, useEffect, useCallback } from 'react';
import { Package, Users, X } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { EstadoVazio } from '../components';
import { auditoriaService } from '../services/auditoria';
import { usuariosService } from '../services/usuarios';
import {
  descreverAcao,
  descreverAlteracao,
  corDaAcao,
  quando,
} from '../utils/historico';

// Histórico de alterações de cadastro — só o dono chega aqui.
//
// Responde "quem mexeu no preço do cimento?" e "quem editou esse
// cadastro?". Venda e pagamento de fiado NÃO aparecem: eles já guardam
// autoria em coluna própria e têm telas melhores (Vendas, Fiados).
//
// A lista é de leitura, não de trabalho: sem paginação, sem exportação. O
// back já corta em 500 — se alguém precisar de mais que isso, o caminho é
// consulta ao banco, não uma tela maior.
const FILTROS_ENTIDADE = [
  { id: '', rotulo: 'Tudo' },
  { id: 'produto', rotulo: 'Produtos', Icone: Package },
  { id: 'cliente', rotulo: 'Clientes', Icone: Users },
];

export default function Historico() {
  const [linhas, setLinhas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [entidade, setEntidade] = useState('');
  const [usuarioId, setUsuarioId] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setLinhas(await auditoriaService.listar({ entidade, usuario_id: usuarioId }));
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar o histórico.');
    } finally {
      setCarregando(false);
    }
  }, [entidade, usuarioId]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  // A lista de usuários alimenta o filtro "quem". Falha em silêncio: sem
  // ela o filtro some, mas o histórico continua legível.
  useEffect(() => {
    usuariosService.listar().then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  const temFiltro = entidade || usuarioId;

  return (
    <LayoutApp titulo="Histórico de alterações">
      <div className="flex flex-col gap-4 h-full min-h-[500px] max-w-[900px]">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-0.5 bg-concreto rounded-p p-0.5">
            {FILTROS_ENTIDADE.map((f) => (
              <button
                key={f.id}
                onClick={() => setEntidade(f.id)}
                className={`px-3 py-1.5 rounded-[4px] text-[12.5px] font-bold transition-colors ${
                  entidade === f.id
                    ? 'bg-superficie text-grafite shadow-sm'
                    : 'text-grafite-medio hover:text-grafite'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          {usuarios.length > 1 && (
            <select
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              className="h-9 px-3 rounded-p border border-linha bg-superficie text-[13px] text-grafite"
            >
              <option value="">Todo mundo</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          )}

          {temFiltro && (
            <button
              onClick={() => { setEntidade(''); setUsuarioId(''); }}
              className="h-9 px-3 rounded-p text-[12.5px] font-semibold text-grafite-medio hover:text-grafite flex items-center gap-1.5"
            >
              <X size={14} /> Limpar
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="bg-superficie border border-linha rounded-md overflow-hidden flex-1 flex flex-col min-h-0">
          {carregando ? (
            <div className="flex-1 flex items-center justify-center text-grafite-medio text-[13px]">
              Carregando…
            </div>
          ) : erro ? (
            <div className="flex-1 flex items-center justify-center text-prumo font-semibold text-[13px] px-6 text-center">
              {erro}
            </div>
          ) : linhas.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <EstadoVazio titulo={temFiltro ? 'Nada com esse filtro' : 'Nenhuma alteração ainda'}>
                {temFiltro
                  ? 'Tente outro filtro.'
                  : 'Quando alguém cadastrar ou alterar um produto ou cliente, aparece aqui.'}
              </EstadoVazio>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-linha">
              {linhas.map((l) => (
                <LinhaHistorico key={l.id} linha={l} />
              ))}
            </div>
          )}
        </div>

        {!carregando && linhas.length > 0 && (
          <p className="text-[12px] text-grafite-medio shrink-0">
            {linhas.length} alteração(ões) · da mais recente para a mais antiga
          </p>
        )}
      </div>
    </LayoutApp>
  );
}

// ---------- Linha ----------

function LinhaHistorico({ linha }) {
  const cor = corDaAcao(linha.acao);
  // Cores vêm dos tokens do design system, nunca de utilitário cru do
  // Tailwind — senão quebram no tema escuro.
  const corTexto =
    cor === 'prumo' ? 'text-prumo' : cor === 'nivel' ? 'text-nivel' : 'text-grafite';
  const corPonto =
    cor === 'prumo' ? 'bg-prumo' : cor === 'nivel' ? 'bg-nivel' : 'bg-grafite-medio';

  const Icone = linha.entidade === 'produto' ? Package : Users;

  return (
    <div className="flex items-start gap-3 px-4 sm:px-5 py-3">
      <span className={`w-2 h-2 rounded-full shrink-0 mt-2 ${corPonto}`} aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className={`text-[14px] font-semibold ${corTexto}`}>
          {descreverAcao(linha)}
        </p>

        {/* O que mudou, campo a campo. Só existe em edição — criação e
            remoção não têm "antes e depois". */}
        {Array.isArray(linha.alteracoes) && linha.alteracoes.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {linha.alteracoes.map((a, i) => (
              <li key={`${a.campo}-${i}`} className="text-[12.5px] text-grafite-medio">
                {descreverAlteracao(a)}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11.5px] text-grafite-medio mt-1 flex items-center gap-1.5 tabular-nums">
          <Icone size={12} className="shrink-0" />
          {quando(linha.criado_em)}
        </p>
      </div>
    </div>
  );
}
