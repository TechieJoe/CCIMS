import { getModelToken } from "@nestjs/mongoose"
import { Test, TestingModule } from "@nestjs/testing"
import { Model } from "mongoose"
import { userService } from "../services/users.service"
import { Cart } from "../utils/schemas/cart"
import { createCrop } from "../utils/schemas/createCrop"
import { Notification } from "../utils/schemas/notification"
import { Order } from "../utils/schemas/orders"
import { User } from "../utils/schemas/user"


describe('userService', () => {
    let service: userService;
    let userModel: Model<User>;
    let orderModel: Model<Order>;
    let cartModel: Model<Cart>;
    let cropModel: Model<createCrop>;
    let notificationModel: Model<Notification>;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            userService,
            {
              provide: getModelToken(User.name),
              useValue: {
                findOne: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                save: jest.fn().mockImplementation(function () {
                  return this;
                }),
                findById: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                create: jest.fn(),
              },
            },
            {
              provide: getModelToken(Cart.name),
              useValue: {
                findOne: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                save: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                findOneAndUpdate: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                deleteMany: jest.fn(),
              },
            },
            {
              provide: getModelToken(Order.name),
              useValue: {
                findOne: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                save: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                updateOne: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                create: jest.fn(),
              },
            },
            {
              provide: getModelToken(Notification.name),
              useValue: {
                find: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                save: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                countDocuments: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                findByIdAndUpdate: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
              },
            },
            {
              provide: getModelToken(createCrop.name),
              useValue: {
                findOne: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                save: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                find: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                findOneAndUpdate: jest.fn().mockReturnValue({
                  exec: jest.fn(),
                }),
                populate: jest.fn().mockReturnThis(),
              },
            },
          ],
        }).compile();

        service = module.get<userService>(userService);
        userModel = module.get<Model<User>>(getModelToken(User.name));
        cartModel = module.get<Model<Cart>>(getModelToken(Cart.name));
        orderModel = module.get<Model<Order>>(getModelToken(Order.name));
        notificationModel = module.get<Model<Notification>>(getModelToken(Notification.name));
        cropModel = module.get<Model<createCrop>>(getModelToken(createCrop.name));
    });

    describe('register', () => {

      it('should return a newUser', async () => {

        const createUserDto = { name: 'John Doe', email: 'john@example.com', password: 'password123' };
        const mockCreatedUser = { _id: 'abc123', ...createUserDto };
        jest.spyOn(userModel.prototype, 'save').mockResolvedValue(mockCreatedUser as any);
        const result = await service.register(createUserDto);

        expect(result).toEqual(mockCreatedUser);
        expect(userModel.prototype.save).toHaveBeenCalled();
      });

    });
    

});