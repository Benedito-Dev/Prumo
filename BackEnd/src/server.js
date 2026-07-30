// Ponto de entrada: sobe o servidor HTTP.
import 'dotenv/config';
import app from './app.js';
import { seedAdmin } from './config/seed.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🧱 Prumo API no ar em http://localhost:${PORT}`);
  console.log(`   Health-check: http://localhost:${PORT}/api/health`);
  await seedAdmin(); // garante um admin inicial se o banco estiver vazio
});
