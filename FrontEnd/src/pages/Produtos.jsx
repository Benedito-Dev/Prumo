import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Pencil, Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { produtosService, UNIDADES, rotuloUnidade } from '../services/produtos';
import { painelService } from '../services/painel';
import { moeda } from '../utils/formato';
import { X, Check } from 'lucide-react';

// Placeholder de imagem por categoria (até existir upload de foto real).
// { emoji base + cor de fundo } conforme o nome da categoria/produto.
function estiloPlaceholder(nomeCategoria, nomeProduto) {
  const chave = (nomeCategoria || nomeProduto || '').toLowerCase();
  if (/cimento|argamassa|cal/.test(chave)) return { emoji: '🧱', cor: '#8a8f97' };
  if (/areia|brita|pedra|agregado/.test(chave)) return { emoji: '⛰️', cor: '#b8926a' };
  if (/ferro|vergalh|a[çc]o|prego/.test(chave)) return { emoji: '🔩', cor: '#6b7280' };
  if (/tijolo|bloco|cer[âa]mic/.test(chave)) return { emoji: '🧱', cor: '#c0703f' };
  if (/tinta|verniz/.test(chave)) return { emoji: '🎨', cor: '#4f86c6' };
  if (/hidr|cano|tubo|conex/.test(chave)) return { emoji: '🚰', cor: '#4f9dc6' };
  if (/el[ée]tric|fio|cabo/.test(chave)) return { emoji: '💡', cor: '#d9a500' };
  return { emoji: '📦', cor: '#0E7C86' };
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tendencias, setTendencias] = useState({}); // { produto_id: 'alta'|'media'|'baixa' }
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState(null); // produto ou {} (novo) ou null (fechado)

  async function carregar() {
    setCarregando(true);
    try {
      const [prods, cats, ranking] = await Promise.all([
        produtosService.listar(),
        produtosService.listarCategorias(),
        painelService.produtosMaisVendidos('ano', 50).catch(() => []),
      ]);
      setProdutos(prods);
      setCategorias(cats);

      // Classifica a tendência de cada produto pela posição no ranking:
      // terço superior = alta, meio = media, inferior/sem vendas = baixa.
      const vendidos = ranking.map((r) => r.produto_id);
      const n = vendidos.length;
      const t = {};
      prods.forEach((p) => {
        const pos = vendidos.indexOf(p.id);
        if (pos === -1) t[p.id] = 'baixa'; // não vendeu no período
        else if (pos < Math.ceil(n / 3)) t[p.id] = 'alta';
        else if (pos < Math.ceil((2 * n) / 3)) t[p.id] = 'media';
        else t[p.id] = 'baixa';
      });
      setTendencias(t);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = produtos
    .filter((p) => (mostrarInativos ? true : p.ativo))
    .filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <LayoutApp
      titulo="Produtos"
      acao={
        <button
          onClick={() => setEditando({})}
          className="h-8 px-4 rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[13px] transition-colors flex items-center gap-1.5"
        >
          <Plus size={15} /> Novo produto
        </button>
      }
    >
      <div className="flex flex-col gap-4 h-[calc(100vh-56px-32px)] min-h-[500px]">
        {/* barra de busca + filtros */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2 border-2 border-linha rounded-p px-3 bg-superficie focus-within:border-grafite flex-1 min-w-[240px]">
            <Search size={16} className="text-grafite-medio shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto…"
              className="flex-1 py-2 bg-transparent text-[14px] outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-grafite-medio cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="accent-trena w-4 h-4"
            />
            Mostrar inativos
          </label>
        </div>

        {/* grade de cards — estica e rola internamente */}
        {carregando ? (
          <div className="flex-1 flex items-center justify-center text-grafite-medio text-[13px]">
            Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-superficie border border-linha rounded-md">
            <Package size={32} className="text-grafite-medio/40 mb-3" />
            <p className="text-[15px] font-semibold">Nenhum produto encontrado</p>
            <p className="text-[13px] text-grafite-medio mt-1">
              {busca ? 'Tente outra busca.' : 'Cadastre o primeiro produto.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtrados.map((p) => (
                <CardProduto
                  key={p.id}
                  produto={p}
                  tendencia={tendencias[p.id]}
                  onEditar={() => setEditando(p)}
                />
              ))}
            </div>
          </div>
        )}

        {!carregando && filtrados.length > 0 && (
          <p className="shrink-0 text-[12px] text-grafite-medio">
            {filtrados.length} produto(s){busca && ` para "${busca}"`}
          </p>
        )}
      </div>

      {editando !== null && (
        <ModalProduto
          produto={editando}
          categorias={categorias}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </LayoutApp>
  );
}

// tendência de vendas: seta + cor + texto
const TENDENCIAS = {
  alta: { Icone: TrendingUp, cor: 'text-nivel', texto: 'Vende bem' },
  media: { Icone: Minus, cor: 'text-grafite-medio', texto: 'Vende ok' },
  baixa: { Icone: TrendingDown, cor: 'text-prumo', texto: 'Vende pouco' },
};

// ---------- Card de produto (foto à ESQUERDA, infos à DIREITA) ----------
function CardProduto({ produto: p, tendencia, onEditar }) {
  const ph = estiloPlaceholder(p.categoria_nome, p.nome);
  const t = TENDENCIAS[tendencia] || TENDENCIAS.media;
  const TIcone = t.Icone;
  return (
    <div
      className={`group relative bg-superficie border border-linha rounded-md overflow-hidden hover:shadow-md transition-shadow flex h-[162px] ${
        !p.ativo ? 'opacity-60' : ''
      }`}
    >
      {/* METADE ESQUERDA: foto (topo ao fundo) */}
      <div
        className="w-[45%] shrink-0 flex items-center justify-center relative overflow-hidden"
        style={{ background: p.imagem_url ? '#fff' : `${ph.cor}22` }}
      >
        {p.imagem_url ? (
          <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-contain p-2" />
        ) : (
          <span className="text-[46px]">{ph.emoji}</span>
        )}
        {!p.ativo && (
          <span className="absolute top-2 left-2 bg-grafite/80 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            inativo
          </span>
        )}
      </div>

      {/* METADE DIREITA: categoria, título, descrição, preço, tendência */}
      <div className="flex-1 min-w-0 p-3 flex flex-col relative">
        {/* editar (hover) */}
        <button
          onClick={onEditar}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-grafite-medio hover:text-grafite hover:bg-concreto opacity-0 group-hover:opacity-100 transition-opacity"
          title="Editar"
        >
          <Pencil size={13} />
        </button>

        <p className="text-[10px] font-bold uppercase tracking-wide text-grafite-medio pr-6">
          {p.categoria_nome || rotuloUnidade(p.unidade)}
        </p>
        <p className="text-[15px] font-semibold leading-tight line-clamp-1 mt-0.5">{p.nome}</p>
        {/* descrição (campo estático por ora — ligar no back depois) */}
        <p className="text-[12.5px] text-grafite-medio leading-snug line-clamp-2 mt-1 flex-1">
          {p.descricao || 'Produto para construção civil.'}
        </p>

        <div className="mt-1">
          <span className="text-[17px] font-bold tabular-nums">{moeda(p.preco_venda)}</span>
          <span className="text-[11px] text-grafite-medio ml-1">/ {rotuloUnidade(p.unidade)}</span>
        </div>
        {/* tendência com texto */}
        <div className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${t.cor} mt-1.5`}>
          <TIcone size={15} strokeWidth={2.5} />
          {t.texto}
        </div>
      </div>
    </div>
  );
}

// ---------- Modal criar/editar produto ----------
function ModalProduto({ produto, categorias: categoriasIniciais, onFechar, onSalvo }) {
  const edicao = !!produto.id;
  const [nome, setNome] = useState(produto.nome || '');
  const [unidade, setUnidade] = useState(produto.unidade || 'saco');
  const [precoVenda, setPrecoVenda] = useState(produto.preco_venda || '');
  const [precoCusto, setPrecoCusto] = useState(produto.preco_custo || '');
  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [categoriaId, setCategoriaId] = useState(produto.categoria_id || '');
  const [imagemUrl, setImagemUrl] = useState(produto.imagem_url || '');
  const [ativo, setAtivo] = useState(produto.ativo ?? true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  // criação inline de categoria
  const [criandoCat, setCriandoCat] = useState(false);
  const [novaCat, setNovaCat] = useState('');
  const [salvandoCat, setSalvandoCat] = useState(false);

  async function criarCategoria() {
    const nomeCat = novaCat.trim();
    if (!nomeCat) return;
    setSalvandoCat(true);
    try {
      const cat = await produtosService.criarCategoria(nomeCat);
      setCategorias((atual) => [...atual, cat].sort((a, b) => a.nome.localeCompare(b.nome)));
      setCategoriaId(cat.id); // já seleciona a nova
      setNovaCat('');
      setCriandoCat(false);
    } catch (e) {
      setErro(e.message || 'Falha ao criar categoria.');
    } finally {
      setSalvandoCat(false);
    }
  }

  async function salvar() {
    setErro('');
    if (!nome.trim()) return setErro('Informe o nome.');
    if (!precoVenda || Number(precoVenda) < 0) return setErro('Informe um preço de venda válido.');

    setSalvando(true);
    try {
      const dados = {
        nome: nome.trim(),
        unidade,
        preco_venda: Number(precoVenda),
        preco_custo: precoCusto ? Number(precoCusto) : null,
        categoria_id: categoriaId || null,
        imagem_url: imagemUrl.trim() || null,
      };
      if (edicao) {
        await produtosService.atualizar(produto.id, { ...dados, ativo });
      } else {
        await produtosService.criar(dados);
      }
      onSalvo();
    } catch (e) {
      setErro(e.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div
        className="bg-superficie rounded-md w-full max-w-[440px] my-auto p-5 max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold">{edicao ? 'Editar produto' : 'Novo produto'}</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite">
            <X size={18} />
          </button>
        </div>

        <Campo rotulo="Nome">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            placeholder="Ex: Cimento CP-II 50kg"
            className={inputCls}
          />
        </Campo>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo rotulo="Unidade">
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputCls}>
              {UNIDADES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <label className="block min-w-0 mb-3">
            <span className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-grafite-medio">
                Categoria
              </span>
              {!criandoCat && (
                <button
                  type="button"
                  onClick={() => setCriandoCat(true)}
                  className="text-[11px] font-semibold text-trena hover:underline"
                >
                  + nova
                </button>
              )}
            </span>
            {criandoCat ? (
              <div className="flex gap-1.5">
                <input
                  value={novaCat}
                  onChange={(e) => setNovaCat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), criarCategoria())}
                  placeholder="Nome da categoria"
                  autoFocus
                  className="flex-1 min-w-0 py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none"
                />
                <button
                  type="button"
                  onClick={criarCategoria}
                  disabled={salvandoCat}
                  className="px-3 rounded-p bg-trena text-white text-[13px] font-bold disabled:opacity-50"
                  title="Salvar categoria"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCriandoCat(false);
                    setNovaCat('');
                  }}
                  className="px-3 rounded-p border border-linha text-grafite-medio"
                  title="Cancelar"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className={inputCls}
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo rotulo="Preço de venda">
            <CampoPreco valor={precoVenda} onChange={setPrecoVenda} />
          </Campo>
          <Campo rotulo="Preço de custo (opcional)">
            <CampoPreco valor={precoCusto} onChange={setPrecoCusto} />
          </Campo>
        </div>

        <Campo rotulo="Imagem (URL, opcional)">
          <input
            value={imagemUrl}
            onChange={(e) => setImagemUrl(e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
        </Campo>
        {imagemUrl.trim() && (
          <div className="mb-3 flex items-center gap-3">
            <img
              src={imagemUrl}
              alt="prévia"
              className="w-16 h-16 object-contain border border-linha rounded-p bg-white"
              onError={(e) => (e.target.style.visibility = 'hidden')}
              onLoad={(e) => (e.target.style.visibility = 'visible')}
            />
            <span className="text-[12px] text-grafite-medio">Prévia da imagem</span>
          </div>
        )}

        {edicao && (
          <label className="flex items-center gap-2 text-[13px] mt-1 mb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="accent-trena w-4 h-4"
            />
            Produto ativo (aparece na venda)
          </label>
        )}

        {erro && <p className="text-[12.5px] text-prumo font-semibold my-3">{erro}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 py-2.5 rounded-p bg-trena hover:bg-trena-escuro text-white text-[14px] font-bold disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : edicao ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full min-w-0 py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none';

// Campo de preço com ajuste por scroll do mouse (roda pra cima sobe,
// pra baixo desce). Segurar Shift usa passo maior (R$ 5).
function CampoPreco({ valor, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function aoRolar(e) {
      e.preventDefault(); // não rola a página enquanto ajusta o preço
      const passo = e.shiftKey ? 5 : 0.5;
      const atual = Number(valor) || 0;
      // deltaY negativo = rolou pra cima = aumenta
      const novo = Math.max(0, atual + (e.deltaY < 0 ? passo : -passo));
      onChange(novo.toFixed(2));
    }
    el.addEventListener('wheel', aoRolar, { passive: false });
    return () => el.removeEventListener('wheel', aoRolar);
  }, [valor, onChange]);

  return (
    <div
      ref={ref}
      className="flex items-center border-2 border-linha rounded-p px-3 focus-within:border-grafite hover:border-grafite-medio transition-colors"
      title="Dica: role o mouse sobre o campo para ajustar (Shift = passo maior)"
    >
      <span className="text-[13px] text-grafite-medio shrink-0">R$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className="w-full min-w-0 py-2.5 pl-2 text-right tabular-nums bg-transparent outline-none text-[14px]"
      />
    </div>
  );
}

function Campo({ rotulo, children }) {
  return (
    <label className="block min-w-0 mb-3">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">
        {rotulo}
      </span>
      {children}
    </label>
  );
}
