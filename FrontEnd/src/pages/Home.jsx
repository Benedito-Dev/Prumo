import { useAuth } from '../auth/AuthContext';
import { Botao, Fio } from '../components';

// Tela provisória pós-login. Será substituída pelo Painel de indicadores.
export default function Home() {
  const { usuario, sair } = useAuth();

  return (
    <div className="min-h-screen">
      <div className="bg-grafite text-superficie px-5 py-6">
        <div className="max-w-[600px] mx-auto flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <Fio claro className="h-8" />
            <span className="font-display text-[19px]">PRUMO</span>
          </div>
          <button onClick={sair} className="text-[13px] text-[#A8B0B8] underline underline-offset-4">
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-5 py-10">
        <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-grafite-medio">
          Bem-vindo
        </p>
        <h2 className="font-display text-[30px] mt-1">{usuario?.nome}</h2>
        <p className="text-grafite-medio mt-1">
          Login: {usuario?.login} · Papel: {usuario?.papel}
        </p>

        <div className="mt-8 max-w-[280px]">
          <Botao variante="primario" onClick={() => {}}>Nova venda</Botao>
        </div>
        <p className="text-[13.5px] text-grafite-medio mt-4">
          As telas de Painel e Vendas entram em seguida.
        </p>
      </div>
    </div>
  );
}
