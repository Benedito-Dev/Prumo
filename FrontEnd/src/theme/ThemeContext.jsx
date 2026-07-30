// Contexto de tema (claro/escuro). Guarda a preferência em localStorage
// e aplica a classe .dark no <html> — as variáveis CSS fazem o resto.
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const CHAVE = 'prumo.tema';

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem(CHAVE) || 'claro');

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.toggle('dark', tema === 'escuro');
    localStorage.setItem(CHAVE, tema);
  }, [tema]);

  const alternar = () => setTema((t) => (t === 'claro' ? 'escuro' : 'claro'));

  return (
    <ThemeContext.Provider value={{ tema, alternar, escuro: tema === 'escuro' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return ctx;
}
