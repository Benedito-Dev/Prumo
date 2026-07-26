// Contexto de autenticação (versão visual/protótipo).
// Guarda o usuário logado e persiste em localStorage para sobreviver ao reload.
// NOTA: ainda não valida senha nem usa token — isso entra na fase de auth real.
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

const CHAVE = 'prumo.usuario';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const salvo = localStorage.getItem(CHAVE);
    return salvo ? JSON.parse(salvo) : null;
  });

  useEffect(() => {
    if (usuario) localStorage.setItem(CHAVE, JSON.stringify(usuario));
    else localStorage.removeItem(CHAVE);
  }, [usuario]);

  const entrar = (dadosUsuario) => setUsuario(dadosUsuario);
  const sair = () => setUsuario(null);

  return (
    <AuthContext.Provider value={{ usuario, entrar, sair, autenticado: !!usuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
