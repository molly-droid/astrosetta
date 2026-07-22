import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './lib/config.js';
import healthRoute from './routes/health.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'debug' : 'info',
      transport:
        config.nodeEnv === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: [
      config.webOrigin,
      'capacitor://localhost', // iOS
      'http://localhost', // Android
    ],
    credentials: true,
  });

  // OpenAPI documentation
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Astrosetta API',
        description: 'Natal chart and transit learning application API',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'system', description: 'System endpoints' },
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'profiles', description: 'Birth profile management' },
        { name: 'charts', description: 'Chart generation' },
        { name: 'transits', description: 'Transit calculations' },
        { name: 'learning', description: 'Learning content' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Routes
  await fastify.register(healthRoute, { prefix: '/v1' });

  return fastify;
}
