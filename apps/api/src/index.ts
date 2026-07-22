import { buildServer } from './server.js';
import { config } from './lib/config.js';

async function start() {
  try {
    const server = await buildServer();

    await server.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🚀 Server ready at http://${config.host}:${config.port}`);
    console.log(`📚 API docs at http://${config.host}:${config.port}/docs`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
