import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, Users, Package, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

// Layout das telas internas (web/desktop): sidebar fixa à esquerda +
// área de conteúdo à direita. Cada item de navegação tem ícone e rótulo.
const NAV = [
  { para: '/', rotulo: 'Painel', Icone: LayoutDashboard, fim: true },
  { para: '/vendas', rotulo: 'Vendas', Icone: Receipt },
  { para: '/clientes', rotulo: 'Clientes', Icone: Users },
  { para: '/produtos', rotulo: 'Produtos', Icone: Package },
];

export default function LayoutApp({ titulo, periodo, acao, children }) {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();

  async function aoSair() {
    await sair();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-concreto-fundo flex">
      {/* ---------- SIDEBAR ---------- */}
      <aside className="w-[210px] shrink-0 bg-grafite text-superficie flex flex-col fixed inset-y-0 left-0">
        {/* marca */}
        <div className="px-5 py-4 flex items-center gap-2.5 border-b border-white/10">
          <div className="relative w-[3px] h-6 bg-superficie">
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-x-[4px] border-x-transparent border-t-[7px] border-t-superficie" />
          </div>
          <span className="font-display text-[18px] tracking-tight">PRUMO</span>
        </div>

        {/* navegação */}
        <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.fim}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-p text-[13.5px] font-semibold transition-colors
                 ${isActive
                   ? 'bg-white/10 text-superficie shadow-[inset_3px_0_0_var(--color-trena)]'
                   : 'text-[#A8B0B8] hover:bg-white/5 hover:text-superficie'}`
              }
            >
              <item.Icone size={17} strokeWidth={2} className="shrink-0" />
              {item.rotulo}
            </NavLink>
          ))}
        </nav>

        {/* usuário + sair */}
        <div className="px-2.5 py-3 border-t border-white/10">
          {usuario?.nome && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 mb-0.5">
              <span className="w-8 h-8 rounded-full bg-trena text-grafite font-bold text-[13px] flex items-center justify-center shrink-0">
                {usuario.nome.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-superficie truncate">
                  {usuario.nome}
                </p>
                <p className="text-[11px] text-[#A8B0B8] capitalize">{usuario.papel}</p>
              </div>
            </div>
          )}
          <button
            onClick={aoSair}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-p text-[13px] font-semibold text-[#A8B0B8] hover:bg-white/5 hover:text-superficie transition-colors"
          >
            <LogOut size={16} strokeWidth={2} className="shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* ---------- ÁREA DE CONTEÚDO ---------- */}
      <div className="flex-1 ml-[210px] flex flex-col min-h-screen">
        {/* topbar leve */}
        <header className="h-14 bg-superficie border-b border-linha flex items-center justify-between px-5 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="font-ui font-bold text-[15px] text-grafite tracking-tight">{titulo || 'Painel'}</h2>
            {periodo && (
              <span className="text-[11px] text-grafite-medio font-semibold uppercase tracking-wide">
                · {periodo}
              </span>
            )}
          </div>
          {acao}
        </header>

        {/* conteúdo */}
        <main className="flex-1 px-5 py-4 w-full">{children}</main>
      </div>
    </div>
  );
}
