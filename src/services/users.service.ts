import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { comparePwd, encodedPwd } from 'src/utils/bcrypt';
import { AddCartItemDto, CartItemDto, UpdateItemDto } from 'src/utils/dtos/cart';
import { signupDto } from 'src/utils/dtos/signup';
import { Roles } from 'src/utils/ROLES/roles';
import { Cart } from 'src/utils/schemas/cart';
import { createCrop } from 'src/utils/schemas/createCrop';
import { farmer } from 'src/utils/schemas/farmers';
import { Order, OrderItem } from 'src/utils/schemas/orders';
import { User } from 'src/utils/schemas/user';
import axios from 'axios';
import * as crypto from 'crypto';
import { OrderDto } from 'src/utils/dtos/order';
import { createCropDto } from 'src/utils/dtos/createCrop';
import * as Mandrill from 'mandrill-api/mandrill';
import { Notification } from 'src/utils/schemas/notification';
import { Types } from 'mongoose';
import { CreateNotificationDto } from 'src/utils/dtos/notification';
import { UpdateProfileDto } from  'src/utils/dtos/profile'

@Injectable()
export class userService {

  private mandrillClient;

  constructor(@InjectModel(User.name) private userModel: Model<User>, @InjectModel(farmer.name) private farmerModel: Model<farmer>, @InjectModel(createCrop.name) private cropModel: Model<createCrop>, @InjectModel(Cart.name) private cartModel: Model<Cart>,  @InjectModel(Order.name) private orderModel: Model<Order>,  @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>){
    this.mandrillClient = new Mandrill.Mandrill(process.env.MANDRILL_API_KEY); // Ensure you have set this in .env
  }
    
  async register(signupDto: signupDto): Promise<User> {
    const { name, password, email } = signupDto;
    
    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash the password
    const hashedPassword = encodedPwd(password);

    // Create a new user
    const newUser = new this.userModel({
      email,
      name,
      password: hashedPassword,
      role: Roles.User
    });

    return await newUser.save(); 
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).exec();
    if (user && await comparePwd(password, user.password)) {
      return user;
    }
    return null;
  }

  
  async searchAll(query: string) {
    const crops = await this.cropModel
      .find({ cropName: new RegExp(query, 'i') }) // Case-insensitive search
      .populate('farmId', 'farmName state LGA') // Populate specific fields from Farmer
      .exec();
  
    return { crops };
  }
      

  async addOrUpdateCartItem(userId: string, addCartItemDto: AddCartItemDto): Promise<Cart> {
    // Find the cart for the given user
    const cart = await this.cartModel.findOne({ userId }).exec();

    if (!cart) {
      // Create a new cart if it doesn't exist
      const newCart = new this.cartModel({ userId, items: [addCartItemDto], totalPrice: 0 });
      await newCart.save();
      return newCart;
    }

    // Check if the item already exists in the cart
    const existingItemIndex = cart.items.findIndex(item => item.cropName === addCartItemDto.cropName);

    if (existingItemIndex > -1) {
        // If the item exists, update the quantity
        const existingItem = cart.items[existingItemIndex];
        existingItem.quantity += addCartItemDto.quantity;

        // Update the price per bag if provided
        if (addCartItemDto.pricePerBag && addCartItemDto.pricePerBag !== existingItem.pricePerBag) {
          existingItem.pricePerBag = addCartItemDto.pricePerBag; // Update only if it's a new price
        }
     } else {
      // If item does not exist, add it to the cart
      cart.items.push(addCartItemDto);
    }

    // Recalculate total price
    cart.totalPrice = cart.items.reduce((total, item) => {
      const itemTotal = (item.quantity || 0) * (item.pricePerBag || 0);
      return total + itemTotal;
    }, 0);

    // Save the updated cart
    await cart.save();

    // Optionally, update the user cart reference
    const user = await this.userModel.findById(userId).exec();
    if (user) {
      user.cart = cart._id as Types.ObjectId; 
      await user.save();
    }

    return cart; // Return the updated cart
  }

  async updateItemQuantity(updateItemDto: UpdateItemDto, userId: string): Promise<Cart> {
    const { cropName, quantity } = updateItemDto;

    // Fetch the crop details to check available quantity
    const crop = await this.cropModel.findOne({ cropName }).exec();
  
    if (!crop) {
      throw new NotFoundException(`Crop ${cropName} not found`);
    }

    // Check if the quantity requested exceeds the stock
    if (quantity > crop.quantity) {
      throw new BadRequestException({
        message: `Requested quantity for ${cropName} exceeds available stock.`,
        availableStock: crop.quantity
      });
    }

    // Update the quantity if valid
    const cart = await this.cartModel.findOneAndUpdate(
      { userId, 'items.cropName': cropName },
      { $set: { 'items.$.quantity': quantity } },
      { new: true, runValidators: true }
    );

    if (!cart) {
      throw new NotFoundException(`Item ${cropName} not found in the cart for user ${userId}`);
    }

    // Recalculate and update total cart price
    cart.totalPrice = cart.items.reduce((total, item) => total + item.pricePerBag * item.quantity, 0);
    return cart.save();
  }

  
  async removeItemFromCart(userId: string, cropName: string): Promise<Cart> {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Filter out the item to be removed
    cart.items = cart.items.filter(item => item.cropName !== cropName);

      // Recalculate totalPrice
      cart.totalPrice = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.pricePerBag,
      0, );

      return await cart.save();
    }


    // Fetch cart for a specific user
    async getCart(userId: string): Promise<Cart> {
    const cart = await this.cartModel.findOne({ userId });

    if (!cart) {
      throw new NotFoundException('Cart not found for this user');
    }

    // Optionally, calculate total price based on items in the cart
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + item.quantity * item.pricePerBag;
    }, 0);

    console.log(cart.totalPrice)
    return cart;
  }

  async processDirectPurchase( userId: string, email: string, orderDto: OrderDto): Promise<string> {

    //console.log(orderDto)
    if (!orderDto.items || orderDto.items.length === 0) {
      throw new BadRequestException('No items provided for purchase');
    }

    // Map and calculate total price for each item
    const items = orderDto.items.map(item => ({
      cropName: item.cropName,
      quantity: item.quantity,
      pricePerBag: item.pricePerBag,
      imageUrl: item.imageUrl,
      totalPrice: item.pricePerBag * item.quantity,
    }));

    const grandTotal = items.reduce((total, item) => total + item.totalPrice, 0);

    // Create order with calculated grandTotal and unique transaction reference
    const newOrder = new this.orderModel({
      userId: new Types.ObjectId(userId),
      items,
      grandTotal,
      status: 'pending',
      transactionReference: crypto.randomBytes(16).toString('hex'),
    });

    await newOrder.save();

    console.log(newOrder)

    // Initialize payment with Paystack
    return this.initializeTransaction(email, grandTotal, newOrder.transactionReference);
  }

  // Method to process the order
  async processOrder(OrderDto: OrderDto, userId: string, email: string): Promise<string> {

    console.log(OrderDto)
    // Verify and prepare order items from the cart
    const orderItems = await this.verifyAndProcessOrder(userId);

    if (!orderItems.length) {
      throw new BadRequestException('No items in cart');
    }

    // Calculate grand total from order items
    const grandTotal = this.calculateGrandTotal(orderItems);

    // Create a new order object
    const newOrder = {
      userId,
      email,
      items: orderItems,
      grandTotal,
      status: 'pending',
      transactionReference: crypto.randomBytes(16).toString('hex'), // Generate a random transaction reference
    };

    // Save the order to the order database
    const order = await this.createOrder(newOrder);

    // Initialize payment with Paystack
    const paymentUrl = await this.initializeTransaction(email, grandTotal, order.transactionReference);

    return paymentUrl;
  }

    // In your CropService
    async findSimilarCrops(cropName: string): Promise<createCrop[]> {
    return await this.cropModel
      .find({ cropName: { $ne: cropName } }).populate('farmId', 'farmName state LGA') // Exclude the current crop
      .limit(5) // Limit to a few similar items
      .exec();
    }


    async handlePaymentCallback(reference: string): Promise<void> {
      // Verify the transaction with Paystack
      const verificationResult = await this.verifyTransaction(reference);
    
      if (verificationResult.data.status === 'success') {
        // Update the order status to 'paid'
        await this.updateOrderStatus(reference, 'paid');
    
        // Get the order by reference to find the userId and items
        const order = await this.orderModel.findOne({ transactionReference: reference }).exec();
    
        if (!order) {
          throw new NotFoundException('Order not found');
        }
    
        // Loop through each item in the order and update the crop stock
        for (const item of order.items) {
          const { cropName, quantity } = item;
    
          // Find the corresponding crop in the cropModel
          const crop = await this.cropModel.findOne({ cropName }).populate('farmId', 'farmName state LGA').exec();
    
          if (!crop) {
            throw new NotFoundException(`Crop ${cropName} not found`);
          }
    
          // Check if the crop stock is sufficient
          if (crop.quantity < quantity) {
            throw new BadRequestException(`Insufficient stock for ${cropName}.`);
          }
    
          // Subtract the ordered quantity from the crop's stock
          crop.quantity -= quantity;
    
          // Create an in-app notification for the user
          const userNotification = {
            userId: order.userId.toString(),
            title: 'Order Receipt',
            message: `Thank you for your purchase! Here are the details:
                      - "image: ${crop.imageUrl}"
                      - "Crop: ${crop.cropName}"
                      - "Quantity: ${quantity}"
                      - "Price: ${crop.amountPerBag}"
                      - "Total ${crop.amountPerBag * quantity}"`,

            isRead: false, // Default unread status
          };
          console.log(userNotification)
          await this.createNotification(userNotification);
    
          // Create an in-app notification for the farmer
          const farmerNotification = {
            userId: crop.farmId._id.toString(), // Assuming farmId is linked to the farmer's user ID
            title: 'Crop Sold',
            message: `Your crop "${crop.cropName}" has been purchased.\n
                      - Quantity Sold: ${quantity}\n
                      - Remaining Stock: ${crop.quantity}\n`,
            isRead: false,
          };
          await this.createNotification(farmerNotification);
    
          // Handle stock depletion or low stock warnings
          if (crop.quantity === 0) {
            // Notify the farmer and remove the crop from the database
            const deleteNotification = {
              userId: crop.farmId._id.toString(),
              title: 'Crop Depleted',
              message: `Your crop "${cropName}" has been sold out and removed from the platform.`,
              isRead: false,
            };
            await this.createNotification(deleteNotification);
    
            await crop.deleteOne(); // Deletes the current document
          } else if (crop.quantity <= 10) {
            // Notify the farmer about low stock
            const lowStockNotification = {
              userId: crop.farmId._id.toString(),
              title: 'Low Stock Alert',
              message: `Your crop "${cropName}" stock is low (${crop.quantity} left). Please update your inventory to avoid removal.`,
              isRead: false,
            };
            await this.createNotification(lowStockNotification);
          }
    
          // Save the updated crop stock
          await crop.save();
        }
    
        // Clear the cart for the user after successful payment
        await this.clearUserCart(order.userId.toString());
      } else {
        throw new BadRequestException('Transaction verification failed');
      }
    }
    
    private async createNotification(CreateNotificationDto: CreateNotificationDto) {
      const newNotification = new this.notificationModel(CreateNotificationDto);
      await newNotification.save();
    }
  
    async getNotifications(userId: string) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException(`User not found for userId: ${userId}`);
      }
  
      const notifications = await this.notificationModel.find({ userId }).exec();
  
      const userNotifications = notifications.filter(notification => user.role === 'user');
      const farmerNotifications = notifications.filter(notification => user.role === 'farmer');
  
      return {
        userNotifications,
        farmerNotifications,
      };
    }
      
    async markAsRead(notificationId: string): Promise<void> {
    
      await this.notificationModel.findByIdAndUpdate(notificationId, { isRead: true });
    }

  // Method to clear the user's cart after payment
  private async clearUserCart(userId: string): Promise<void> {
    // Find the user's cart and remove all items
    await this.cartModel.findOneAndUpdate(
      { userId },
      { $set: { items: [] } },  // Clear the items array
      { new: true }
    );
  }

  // Method to verify and process cart items into order items
  private async verifyAndProcessOrder(userId: string): Promise<any[]> {
    // Find the cart for the user
    const cart = await this.cartModel.findOne({ userId });

    if (!cart || !cart.items.length) {
      throw new BadRequestException('No items found in cart');
    }

    const orderItems = cart.items.map(item => ({
      cropName: item.cropName,
      quantity: item.quantity,
      pricePerBag: item.pricePerBag, // Access the pricePerBag inside each item
      totalPrice: item.quantity * item.pricePerBag, // Calculate total price for each item
      imageUrl: item.imageUrl, // Store image URL
    }));

    return orderItems;
  }

  // Method to calculate grand total
  private calculateGrandTotal(orderItems: any[]): number {
    return orderItems.reduce((total, item) => total + item.totalPrice, 0);
  }

  // Method to create and save the order in the database
  private async createOrder(orderData: any): Promise<any> {
    const newOrder = new this.orderModel(orderData);
    return await newOrder.save();
  }

  // Method to initialize a transaction with Paystack
  private async initializeTransaction(email: string, amount: number, reference: string): Promise<string> {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {   
        email,
        amount: amount * 100, // Paystack uses kobo, so multiply by 100
        reference,
      },
      {
        headers: {
          Authorization: "Bearer sk_test_ac3ea693ba6514087a7948495cfaf5d3dcb7baf2", // Your Paystack secret key
        },
      },
    );

    if (response.data.status) {
      return response.data.data.authorization_url; // Return the payment URL
    } else {
    throw new BadRequestException('Transaction initialization failed');
    }
  }

  // Method to verify Paystack transaction by reference
  private async verifyTransaction(reference: string): Promise<any> {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: "Bearer sk_test_ac3ea693ba6514087a7948495cfaf5d3dcb7baf2", // Your Paystack secret key
        },
      },
    );

    return response.data;
  }

  // Method to update the order status by transaction reference
  private async updateOrderStatus(reference: string, status: string): Promise<void> {
    await this.orderModel.updateOne({ transactionReference: reference }, { status });
  }

  // Method to send an email using Mandrill
  private async sendEmail(to: string, subject: string, text: string, from: string = 'your-email@example.com'): Promise<void> {
    const message = {
    from_email: from,
    subject: subject,
    text: text,
    to: [{ email: to, type: 'to' }],
  };

  return new Promise((resolve, reject) => {
    this.mandrillClient.messages.send({ message }, (result) => {
    resolve(result);
    }, (error) => {
      reject(error);
    });

    });

  }

  // Method to clear the cart after successful payment
  async clearCart(userId: string): Promise<void> {
  await this.cartModel.deleteMany({ userId }); // Delete all items in the cart for the specific user
  }


  async getUserProfile(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user || user.role !== 'user') {
      throw new NotFoundException(`User profile not found for userId: ${userId}`);
    }
  
    const orders = await this.orderModel.find({ _id: { $in: user.orders } }).exec();
  
    const profileData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture, // Ensure this is populated
      orders,
    };
  
    console.log(`Retrieved profile data:`, profileData);
    return profileData;
    
  }
    
  async updateUserProfile(userId: string, UpdateProfileDto: UpdateProfileDto): Promise<User> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User not found for userId: ${userId}`);
    }
  
    if (UpdateProfileDto.name) {
      user.name = UpdateProfileDto.name;
    }
    if (UpdateProfileDto.profilePicture) {
      user.profilePicture = UpdateProfileDto.profilePicture;
      console.log(`Updating profile picture: ${UpdateProfileDto.profilePicture}`);
    }
  
    const savedUser = await user.save();
    console.log(`User updated successfully: ${savedUser}`);
    return savedUser;
  }
    

    
}
