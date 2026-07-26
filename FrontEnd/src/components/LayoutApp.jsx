import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Layout das telas internas: cabeçalho grafite + conteúdo + barra de
// navegação inferior (design system seção 06). Rótulo sempre visível.
const ABAS = [
  { para: '/', rotulo: 'Painel', fim: true },
  { para: '/vendas', rotulo: 'Vendas' },
  { para: '/clientes', rotulo: 'Clientes' },
  { para: '/produtos', rotulo: 'Produtos' },
];

export default function LayoutApp({ titulo, periodo, children }) {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();

  function aoSair() {
    sair();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-concreto-fundo">
      {/* cabeçalho grafite */}
      <header className="bg-grafite text-superficie px-5 py-4">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* fio de prumo compacto */}
            <div className="relative w-[3px] h-7 bg-superficie">
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-x-[5px] border-x-transparent border-t-[8px] border-t-superficie" />
            </div>
            <span className="font-display text-[19px] tracking-tight">{titulo || 'PRUMO'}</span>
          </div>
          <div className="flex items-center gap-4">
            {periodo && (
              <span className="text-[12.5px] text-[#A8B0B8] font-semibold uppercase tracking-wide">
                {periodo}
              </span>
            )}
            <button
              onClick={aoSair}
              title={`Sair (${usuario?.nome || ''})`}
              className="text-[12.5px] text-[#A8B0B8] hover:text-superficie underline underline-offset-4"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* conteúdo */}
      <main className="flex-1 w-full max-w-[640px] mx-auto px-5 py-6 pb-24">
        {children}
      </main>

      {/* navegação inferior */}
      <nav className="fixed bottom-0 inset-x-0 bg-superficie border-t border-linha">
        <div className="max-w-[640px] mx-auto flex">
          {ABAS.map((aba) => (
            <NavLink
              key={aba.para}
              to={aba.para}
              end={aba.fim}
              className={({ isActive }) =>
                `flex-1 text-center pt-3 pb-3.5 text-[11.5px] font-bold tracking-[0.05em] uppercase
                 ${isActive
                   ? 'text-grafite shadow-[inset_0_3px_0_var(--color-trena)]'
                   : 'text-grafite-medio'}`
              }
            >
              {aba.rotulo}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
