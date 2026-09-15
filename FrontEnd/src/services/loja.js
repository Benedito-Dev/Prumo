// Identificação da loja — cabeçalho do recibo.
import { api } from './api';

export const lojaService = {
  dados: () => api.get('/loja'),
};
