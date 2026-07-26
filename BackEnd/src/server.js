// Ponto de entrada: sobe o servidor HTTP.
import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🧱 Prumo API no ar em http://localhost:${PORT}`);
  console.log(`   Health-check: http://localhost:${PORT}/api/health`);
});
