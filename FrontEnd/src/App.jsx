import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Painel from './pages/Painel';
import NovaVenda from './pages/NovaVenda';
import Produtos from './pages/Produtos';
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
    </Routes>
  );
}
