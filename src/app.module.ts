import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FarmAppModule } from './modules/farm_app.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CartService } from './cart/cart.service';
@Module({
  imports: [

    ConfigModule.forRoot({
    isGlobal: true,  // This makes the config module available across the entire app without re-importing
  }),

  // Set up the MongooseModule with async configuration using ConfigService
  MongooseModule.forRootAsync({
    imports: [ConfigModule],  // Import the ConfigModule
    inject: [ConfigService],  // Inject ConfigService to access environment variables
    useFactory: (configService: ConfigService) => ({
      uri: configService.get<string>('MONGO_URI'), // Use MONGODB_URI directly
    }),
  }),
    FarmAppModule,  
  ],
  
  controllers: [],
  providers: [CartService],
})
export class AppModule {}
