// Contexto de autenticação (real).
// O access token vive em memória (no api.js). O refresh é um cookie
// httpOnly que o navegador guarda. Ao carregar o app, tentamos /refresh
// para restaurar a sessão sem novo login.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, definirAccessToken, registrarLogout } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true); // enquanto restaura a sessão

  const sair = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // segue mesmo se falhar
    }
    definirAccessToken(null);
    setUsuario(null);
  }, []);

  // Registra o callback de logout usado pelo api.js quando o refresh falha
  useEffect(() => {
    registrarLogout(() => {
      definirAccessToken(null);
      setUsuario(null);
    });
  }, []);

  // Ao montar: tenta restaurar a sessão via cookie de refresh
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (r.ok) {
          const dados = await r.json();
          definirAccessToken(dados.accessToken);
          setUsuario(dados.usuario);
        }
      } catch {
        // sem sessão — segue deslogado
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // login: recebe credenciais, guarda o access em memória e o usuário
  const entrar = useCallback(async (email, senha) => {
    const dados = await api.post('/auth/login', { email, senha });
    definirAccessToken(dados.accessToken);
    setUsuario(dados.usuario);
    return dados.usuario;
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, entrar, sair, autenticado: !!usuario }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
