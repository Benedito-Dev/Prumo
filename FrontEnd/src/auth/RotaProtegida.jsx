// Redireciona para /login quem não está autenticado.
// Enquanto a sessão é restaurada (via cookie de refresh), mostra um
// estado de carregamento em vez de mandar para o login por engano.
//
// Com `soDono`, também barra quem não é dono: tirar o link do menu esconde
// a tela, mas não impede quem digita o endereço. Isto é conveniência de
// navegação, não segurança — quem protege de verdade é o requireDono no
// back, porque o front roda na máquina de quem está usando.
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RotaProtegida({ children, soDono = false }) {
  const { autenticado, carregando, usuario } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-concreto-fundo">
        <div className="flex items-center gap-3 text-grafite-medio">
          <span className="inline-block w-4 h-4 border-2 border-grafite border-t-transparent rounded-full animate-spin" />
          Carregando…
        </div>
      </div>
    );
  }

  if (!autenticado) return <Navigate to="/login" replace />;

  // Manda para a tela inicial, não para uma página de "acesso negado": o
  // vendedor não pediu essa tela, ele digitou um endereço que não é dele.
  if (soDono && usuario?.papel !== 'dono') return <Navigate to="/" replace />;

  return children;
}
