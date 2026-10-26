import 'dotenv/config';
import { createServer } from './server';

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = createServer();
const server = app.listen(PORT, () => {
  console.log(`\n🚀 cli-openai-proxy running on http://localhost:${PORT}`);
  console.log(`   Models:      GET  http://localhost:${PORT}/v1/models`);
  console.log(`   Chat:        POST http://localhost:${PORT}/v1/chat/completions`);
  console.log(`   Health:      GET  http://localhost:${PORT}/health`);
  console.log(`\n   Default provider: ${process.env.DEFAULT_PROVIDER || 'claude'}`);
  console.log(`   Auth:             ${process.env.API_KEY ? 'enabled' : 'disabled (set API_KEY to enable)'}\n`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
