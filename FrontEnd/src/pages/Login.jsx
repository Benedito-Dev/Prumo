import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { Botao, Campo, Fio } from '../components';

// Tela de login (versão visual/protótipo).
// Valida se o login existe na base; senha ainda não é conferida — a
// autenticação real (bcrypt + token) entra numa fase posterior.
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
      // Protótipo: busca o usuário pelo login na lista existente.
      const usuarios = await api.get('/usuarios');
      const usuario = usuarios.find((u) => u.login === login.trim());

      if (!usuario) {
        setErro('Usuário não encontrado.');
        return;
      }
      if (!usuario.ativo) {
        setErro('Este usuário está inativo.');
        return;
      }

      entrar(usuario);
      navigate('/', { replace: true });
    } catch {
      setErro('Não foi possível conectar. O sistema está no ar?');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* topo grafite com a marca */}
      <div className="bg-grafite text-superficie px-5 pt-16 pb-12">
        <div className="max-w-[420px] mx-auto flex gap-[26px]">
          <Fio claro />
          <div>
            <h1 className="font-display text-[52px] leading-[0.92] tracking-[-0.02em] m-0">
              PRUMO
            </h1>
            <p className="text-[15px] text-[#A8B0B8] mt-3">Seu depósito no prumo.</p>
          </div>
        </div>
      </div>

      {/* formulário */}
      <div className="flex-1 px-5 py-10">
        <form onSubmit={aoEnviar} className="max-w-[420px] mx-auto">
          <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-grafite-medio mb-6">
            Entrar no sistema
          </p>

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
            <p className="text-[13.5px] text-prumo font-semibold mb-4 -mt-2">{erro}</p>
          )}

          <div className="mt-2">
            <Botao variante="primario" type="submit" disabled={carregando}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </Botao>
          </div>
        </form>
      </div>
    </div>
  );
}
