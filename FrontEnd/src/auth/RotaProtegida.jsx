// Redireciona para /login quem não está autenticado.
// Enquanto a sessão é restaurada (via cookie de refresh), mostra um
// estado de carregamento em vez de mandar para o login por engano.
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RotaProtegida({ children }) {
  const { autenticado, carregando } = useAuth();

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
  return children;
}
