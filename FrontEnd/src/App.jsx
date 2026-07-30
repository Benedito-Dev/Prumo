import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Painel from './pages/Painel';
import NovaVenda from './pages/NovaVenda';
import Vendas from './pages/Vendas';
import Produtos from './pages/Produtos';
import Clientes from './pages/Clientes';
import ClienteDetalhe from './pages/ClienteDetalhe';
import RotaProtegida from './auth/RotaProtegida';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RotaProtegida>
            <Painel />
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
      <Route
        path="/clientes"
        element={
          <RotaProtegida>
            <Clientes />
          </RotaProtegida>
        }
      />
      <Route
        path="/clientes/:id"
        element={
          <RotaProtegida>
            <ClienteDetalhe />
          </RotaProtegida>
        }
      />
    </Routes>
  );
}
