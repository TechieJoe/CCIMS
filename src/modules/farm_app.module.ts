import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { FarmersService } from 'src/services/farmers.service';
import { userService } from 'src/services/users.service';
import { Cart, CartSchema } from 'src/utils/schemas/cart';
import { createCrop, CropSchema } from 'src/utils/schemas/createCrop';
import { farmer, farmerSchema } from 'src/utils/schemas/farmers';
import { Order, OrderSchema } from 'src/utils/schemas/orders';
import { User, UserSchema } from 'src/utils/schemas/user';
import { localStrategy } from 'src/utils/strategies/passport';
import { ServeStaticModule } from '@nestjs/serve-static';
import { Notification, NotificationSchema } from 'src/utils/schemas/notification';
import { SessionSerializer } from 'src/utils/strategies/serializer';
import { FarmAppController } from '../controllers/farm_app.controller';


@Module({

    imports: [

        ServeStaticModule.forRoot({
            rootPath: join('c/user/USERS/ajogwu/agric_app/uploads'), // Absolute path to serve static files
            serveRoot: '/uploads', // URL path prefix to access the files
        }),
      
        
        MulterModule.register({
            dest: './uploads',
        }),

        PassportModule.register({session: true}),
          
        MongooseModule.forFeature
        ([
            {
                name: User.name,
                schema: UserSchema
            },
            {
                name: farmer.name,
                schema: farmerSchema
            },
            {
                name: createCrop.name,
                schema: CropSchema
            },
            {
                name: Cart.name,
                schema: CartSchema
            },
            {
                name: Order.name,
                schema: OrderSchema
            },
            {
                name: Notification.name,
                schema: NotificationSchema
            },

        ]),

    ],

    providers:[

        {
            provide: 'FARMERS_SERVICE',
            useClass: FarmersService
   
        },
        {
            provide: 'USER_SERVICE',
            useClass: userService
        },

        localStrategy, SessionSerializer
    ],

    controllers: [ FarmAppController ]

})
export class FarmAppModule {}
