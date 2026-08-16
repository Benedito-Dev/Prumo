import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Painel from './pages/Painel';
import MeuPainel from './pages/MeuPainel';
import NovaVenda from './pages/NovaVenda';
import Vendas from './pages/Vendas';
import Produtos from './pages/Produtos';
import Clientes from './pages/Clientes';
import ClienteDetalhe from './pages/ClienteDetalhe';
import Fiados from './pages/Fiados';
import Assistente from './pages/Assistente';
import Usuarios from './pages/Usuarios';
import UsuarioDetalhe from './pages/UsuarioDetalhe';
import RotaProtegida from './auth/RotaProtegida';
import { useAuth } from './auth/AuthContext';

// A tela inicial depende do papel: o dono vê os indicadores da loja, o
// vendedor vê os próprios números. As rotas do painel da loja são
// requireDono no back — mandar o vendedor para lá lhe daria uma tela de
// erro como primeira coisa depois do login.
function PainelDoPapel() {
  const { usuario } = useAuth();
  return usuario?.papel === 'dono' ? <Painel /> : <MeuPainel />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RotaProtegida>
            <PainelDoPapel />
          </RotaProtegida>
        }
      />
      <Route
        path="/vendas"
        element={
          <RotaProtegida>
            <Vendas />
          </RotaProtegida>
        }
      />
      <Route
        path="/vendas/nova"
        element={
          <RotaProtegida>
            <NovaVenda />
          </RotaProtegida>
        }
      />
      <Route
        path="/produtos"
        element={
          <RotaProtegida>
            <Produtos />
          </RotaProtegida>
        }
      />
      {/* A carteira de clientes e o mapa de fiados são do dono. O vendedor
          acha e cadastra cliente dentro de Nova Venda, e recebe fiado pelo
          aviso que aparece no meio da venda. */}
      <Route
        path="/clientes"
        element={
          <RotaProtegida soDono>
            <Clientes />
          </RotaProtegida>
        }
      />
      <Route
        path="/clientes/:id"
        element={
          <RotaProtegida soDono>
            <ClienteDetalhe />
          </RotaProtegida>
        }
      />
      <Route
        path="/fiados"
        element={
          <RotaProtegida soDono>
            <Fiados />
          </RotaProtegida>
        }
      />
      <Route
        path="/assistente"
        element={
          <RotaProtegida>
            <Assistente />
          </RotaProtegida>
        }
      />
      {/* Administrar usuários sempre foi só do dono no back (requireDono);
          o front deixava a tela abrir e ela quebrava em 403. */}
      <Route
        path="/usuarios"
        element={
          <RotaProtegida soDono>
            <Usuarios />
          </RotaProtegida>
        }
      />
      <Route
        path="/usuarios/:id"
        element={
          <RotaProtegida soDono>
            <UsuarioDetalhe />
          </RotaProtegida>
        }
      />
    </Routes>
  );
}
