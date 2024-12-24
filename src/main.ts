import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as  cookieParser from 'cookie-parser'
import * as passport from 'passport';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');
  app.use(cookieParser())
  app.use(
    session({
      name: configService.get<string>('SESSION_NAME'),      
      secret: configService.get<string>('SESSION_SECRET'), 
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: parseInt(configService.get<string>('SESSION_MAX_AGE'), 10) || 3600000, // Default to 1 hour if not set
        }
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(3000);
}
bootstrap();
