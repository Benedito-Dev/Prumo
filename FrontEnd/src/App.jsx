import { useEffect, useState } from 'react';
import { api } from './services/api';

// Tela inicial provisória: confirma a identidade visual (design system)
// e que o FrontEnd conversa com a API. Será substituída pelas telas reais.
export default function App() {
  const [status, setStatus] = useState('verificando...');
  const [ok, setOk] = useState(null);

  useEffect(() => {
    api
      .get('/health')
      .then((r) => {
        setStatus(`API no ar · banco ${r.banco}`);
        setOk(true);
      })
      .catch(() => {
        setStatus('API fora do ar — o back-end está rodando?');
        setOk(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-superficie rounded-[10px] shadow-sm border border-linha p-10 max-w-md w-full text-center">
        {/* fio de prumo: elemento assinatura */}
        <div className="flex justify-center mb-6">
          <div className="w-[3px] h-12 bg-grafite relative">
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[10px] border-t-prumo" />
          </div>
        </div>

        <h1 className="font-display text-4xl text-prumo tracking-tight">PRUMO</h1>
        <p className="text-grafite-medio mt-1">Seu depósito no prumo.</p>

        <div
          className={`mt-8 inline-flex items-center gap-2 rounded-[6px] px-4 py-2 text-sm font-medium ${
            ok === true
              ? 'bg-nivel/10 text-nivel'
              : ok === false
                ? 'bg-prumo/10 text-prumo'
                : 'bg-concreto text-grafite-medio'
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              ok === true ? 'bg-nivel' : ok === false ? 'bg-prumo' : 'bg-grafite-medio'
            }`}
          />
          {status}
        </div>
      </div>
    </div>
  );
}
