import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Botao, Campo } from '../components';

// Foto de fundo da vitrine. Coloque uma imagem de obra/depósito em
// src/assets/obra.jpg. Enquanto não houver, o fallback de textura
// (definido no CSS abaixo) aparece no lugar — a tela nunca quebra.
// A importação é opcional: se o arquivo não existir, o Vite ignora
// via o try dinâmico abaixo.
let obraUrl = null;
try {
  // eslint-disable-next-line
  obraUrl = new URL('../assets/obra.jpg', import.meta.url).href;
} catch {
  obraUrl = null;
}

// Tela de login (versão visual/protótipo) — split-screen com vitrine
// em foto de obra (P&B + overlay grafite).
export default function Login() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { entrar } = useAuth();
  const navigate = useNavigate();

  async function aoEnviar(e) {
    e.preventDefault();
    setErro('');

    if (!login || !senha) {
      setErro('Preencha login e senha.');
      return;
    }

    setCarregando(true);
    try {
      await entrar(login.trim(), senha);
      navigate('/', { replace: true });
    } catch (e) {
      // mensagem vinda da API (401/403) ou fallback de conexão
      setErro(e.message === 'Sessão expirada' ? 'Login ou senha inválidos.' : e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ---------- VITRINE (esquerda): foto de obra P&B + overlay ---------- */}
      <aside className="relative overflow-hidden bg-grafite text-superficie px-8 py-14 lg:px-16 lg:py-0 lg:flex lg:flex-col lg:justify-between">
        {/* camada 1: fallback de textura (concreto) — sempre presente atrás da foto */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(135deg, #1a1e23 0px, #1a1e23 2px, #16191d 2px, #16191d 22px)',
          }}
        />

        {/* camada 2: a foto de obra (se existir), em preto e branco */}
        {obraUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${obraUrl})`, filter: 'grayscale(1) contrast(1.05)' }}
          />
        )}

        {/* camada 3: overlay grafite em gradiente — garante legibilidade da marca */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, rgba(22,25,29,0.94) 0%, rgba(22,25,29,0.78) 45%, rgba(22,25,29,0.55) 100%)',
          }}
        />

        {/* faixa trena vertical à esquerda */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-trena" />

        {/* topo: marca com o fio de prumo */}
        <div className="relative lg:pt-16">
          <div className="flex items-stretch gap-6">
            <div className="relative w-[4px] bg-superficie self-stretch min-h-[120px] shadow-[0_0_20px_rgba(255,255,255,0.25)]">
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-0 h-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-superficie" />
            </div>
            <div>
              <h1 className="font-display text-[clamp(60px,9vw,104px)] leading-[0.9] tracking-[-0.03em] m-0 drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
                PRUMO
              </h1>
              <span className="inline-block mt-5 bg-trena text-grafite font-bold text-[13px] tracking-[0.1em] uppercase px-4 py-2">
                Seu depósito no prumo
              </span>
            </div>
          </div>
        </div>

        {/* base: frase de posicionamento */}
        <div className="relative mt-12 lg:mb-16 max-w-[42ch]">
          <p className="text-[20px] leading-[1.5] text-[#E3E7EA] drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
            O sistema de gestão feito para quem atende{' '}
            <span className="text-superficie font-semibold">em pé, no balcão</span>, com o
            cliente esperando.
          </p>
        </div>
      </aside>

      {/* ---------- FORMULÁRIO (direita) ---------- */}
      <main className="flex items-center justify-center px-8 py-16 bg-concreto-fundo">
        <form onSubmit={aoEnviar} className="w-full max-w-[400px]">
          <p className="text-[12px] font-bold tracking-[0.14em] uppercase text-grafite-medio">
            Acesso ao sistema
          </p>
          <h2 className="font-display text-[30px] text-grafite mt-2 mb-8 leading-tight">
            Entrar
          </h2>

          <Campo
            rotulo="Login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus
            autoCapitalize="none"
            placeholder="seu usuário"
          />
          <Campo
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••"
          />

          {erro && (
            <div className="flex items-center gap-2 text-[13.5px] text-prumo font-semibold mb-4 -mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-prumo" />
              {erro}
            </div>
          )}

          <div className="mt-2">
            <Botao variante="primario" type="submit" disabled={carregando}>
              {carregando ? 'Entrando…' : 'Entrar no Prumo →'}
            </Botao>
          </div>

          <p className="text-[13px] text-grafite-medio mt-8 text-center">
            Problemas para entrar? Fale com o responsável pelo sistema.
          </p>
        </form>
      </main>
    </div>
  );
}
