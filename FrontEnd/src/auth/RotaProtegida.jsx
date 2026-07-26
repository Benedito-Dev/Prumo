// Redireciona para /login quem não está autenticado.
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RotaProtegida({ children }) {
  const { autenticado } = useAuth();
  if (!autenticado) return <Navigate to="/login" replace />;
  return children;
}
