import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Users, Package, NotebookPen,
  LogOut, Sun, Moon, UserCog, KeyRound, Sparkles, Menu, X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import ModalTrocarSenha from './ModalTrocarSenha';

// Layout das telas internas.
// - Até lg: a sidebar é um drawer que desliza sobre o conteúdo (o balcão
//   raramente tem PC livre — ver princípio mobile-first do README).
// - A partir de lg: sidebar fixa à esquerda, como era antes.
// Alvos de toque no mobile seguem os 56–64px do documento de requisitos.
const NAV = [
  { para: '/', rotulo: 'Painel', Icone: LayoutDashboard, fim: true },
  { para: '/vendas', rotulo: 'Vendas', Icone: Receipt },
  { para: '/fiados', rotulo: 'Fiados', Icone: NotebookPen },
  { para: '/clientes', rotulo: 'Clientes', Icone: Users },
  { para: '/produtos', rotulo: 'Produtos', Icone: Package },
  { para: '/assistente', rotulo: 'Zé', Icone: Sparkles },
];

export default function LayoutApp({ titulo, periodo, acao, children }) {
  const { usuario, sair } = useAuth();
  const { escuro, alternar } = useTheme();
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const ehDono = usuario?.papel === 'dono';
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Navegou? fecha o drawer — senão ele cobre a tela que acabou de abrir.
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  // Trava o scroll do fundo enquanto o drawer está aberto.
  useEffect(() => {
    if (!menuAberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [menuAberto]);

  // Esc fecha o drawer.
  useEffect(() => {
    if (!menuAberto) return;
    const aoTeclar = (e) => e.key === 'Escape' && setMenuAberto(false);
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [menuAberto]);

  async function aoSair() {
    await sair();
    navigate('/login', { replace: true });
  }

  // Classes compartilhadas pelos itens de navegação.
  const itemNav = (isActive, ativoComFio = true) =>
    `flex items-center gap-3 px-3 min-h-[52px] lg:min-h-0 lg:py-2 rounded-p
     text-[15px] lg:text-[13.5px] font-semibold transition-colors ${
       isActive
         ? `bg-white/10 text-white ${ativoComFio ? 'shadow-[inset_3px_0_0_var(--color-trena)]' : ''}`
         : 'text-[#A8B0B8] hover:bg-white/5 hover:text-white'
     }`;

  return (
    <div className="min-h-screen bg-concreto-fundo">
      {/* ---------- VÉU (só no mobile, com o drawer aberto) ---------- */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* ---------- SIDEBAR / DRAWER (sempre escura, nos dois temas) ---------- */}
      <aside
        className={`w-[260px] lg:w-[210px] bg-[#16191d] text-white flex flex-col
                    fixed inset-y-0 left-0 z-40 transition-transform duration-200
                    ${menuAberto ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* marca + fechar (o fechar só existe no mobile) */}
        <div className="px-5 h-14 flex items-center gap-2.5 border-b border-white/10 shrink-0">
          <div className="relative w-[3px] h-6 bg-white">
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-x-[4px] border-x-transparent border-t-[7px] border-t-white" />
          </div>
          <span className="font-display text-[18px] tracking-tight">PRUMO</span>
          <button
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
            className="ml-auto w-10 h-10 -mr-2 flex items-center justify-center rounded-p text-[#A8B0B8] hover:text-white hover:bg-white/5 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* navegação */}
        <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.fim}
              className={({ isActive }) => itemNav(isActive)}
            >
              <item.Icone size={18} strokeWidth={2} className="shrink-0" />
              {item.rotulo}
            </NavLink>
          ))}
        </nav>

        {/* usuário + sair */}
        <div className="px-2.5 py-3 border-t border-white/10 shrink-0">
          {usuario?.nome && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 mb-0.5">
              <span className="w-9 h-9 rounded-full bg-trena text-white font-bold text-[14px] flex items-center justify-center shrink-0">
                {usuario.nome.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">
                  {usuario.nome}
                </p>
                <p className="text-[11px] text-[#A8B0B8] capitalize">{usuario.papel}</p>
              </div>
            </div>
          )}
          {ehDono && (
            <NavLink
              to="/usuarios"
              className={({ isActive }) => `w-full ${itemNav(isActive, false)}`}
            >
              <UserCog size={18} strokeWidth={2} className="shrink-0" />
              Usuários
            </NavLink>
          )}
          <button
            onClick={() => setTrocandoSenha(true)}
            className={`w-full ${itemNav(false)}`}
          >
            <KeyRound size={18} strokeWidth={2} className="shrink-0" />
            Trocar senha
          </button>
          <button onClick={aoSair} className={`w-full ${itemNav(false)}`}>
            <LogOut size={18} strokeWidth={2} className="shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* ---------- ÁREA DE CONTEÚDO ---------- */}
      <div className="lg:ml-[210px] flex flex-col min-h-screen min-w-0">
        {/* topbar leve */}
        <header className="h-14 bg-superficie border-b border-linha flex items-center justify-between gap-2 px-3 sm:px-5 sticky top-0 z-20">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              className="w-10 h-10 -ml-1 flex items-center justify-center rounded-p text-grafite-medio hover:text-grafite hover:bg-concreto lg:hidden shrink-0"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
            <h2 className="font-ui font-bold text-[15px] text-grafite tracking-tight truncate">
              {titulo || 'Painel'}
            </h2>
            {periodo && (
              <span className="hidden sm:inline text-[11px] text-grafite-medio font-semibold uppercase tracking-wide whitespace-nowrap">
                · {periodo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {acao}
            <button
              onClick={alternar}
              title={escuro ? 'Tema claro' : 'Tema escuro'}
              className="w-9 h-9 flex items-center justify-center rounded-p border border-linha text-grafite-medio hover:text-grafite hover:bg-concreto transition-colors shrink-0"
            >
              {escuro ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            </button>
          </div>
        </header>

        {/* conteúdo */}
        <main className="flex-1 px-3 sm:px-5 py-4 w-full min-w-0">{children}</main>
      </div>

      {trocandoSenha && <ModalTrocarSenha onFechar={() => setTrocandoSenha(false)} />}
    </div>
  );
}
