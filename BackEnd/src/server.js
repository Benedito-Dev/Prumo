// Ponto de entrada: sobe o servidor HTTP.
import 'dotenv/config';
import app from './app.js';
import { seedAdmin } from './config/seed.js';
import { rodarMigracoes } from './config/migracoes.js';

const PORT = process.env.PORT || 3000;

// Migrar ANTES de aceitar requisição: subir a API com o schema velho faria
// as consultas quebrarem em cima de coluna que ainda não existe.
//
// Migração que falha derruba o boot de propósito. A alternativa — subir
// assim mesmo — deixaria a API atendendo o balcão com metade do schema
// aplicado, e o erro apareceria no meio de uma venda em vez de aqui.
try {
  const aplicadas = await rodarMigracoes();
  if (aplicadas.length > 0) {
    console.log(`🗄️  ${aplicadas.length} migração(ões) aplicada(s).`);
  }
} catch (erro) {
  console.error('❌ Falha ao migrar o banco:', erro.message);
  console.error('   A API não subiu. Corrija a migração e tente de novo.');
  process.exit(1);
}

app.listen(PORT, async () => {
  console.log(`🧱 Prumo API no ar em http://localhost:${PORT}`);
  console.log(`   Health-check: http://localhost:${PORT}/api/health`);
  await seedAdmin(); // garante um admin inicial se o banco estiver vazio
});
