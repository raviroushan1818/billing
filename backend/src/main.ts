import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3000);
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger:
      nodeEnv === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 2));

  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins?.length
      ? corsOrigins
      : nodeEnv === 'production'
        ? false
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const uploadDir =
    process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(uploadDir, { prefix: '/api/uploads/' });
  logger.log(`Serving uploads from ${uploadDir}`);

  await app.listen(port);
  logger.log(`API listening on port ${port} (${nodeEnv})`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
