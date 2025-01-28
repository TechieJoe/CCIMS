import { BadRequestException, Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, InternalServerErrorException, NotFoundException, Param, Patch, Post, Put, Query, Render, Req, Request, Res, Session, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { extname } from 'path';
import { FarmersService } from '../services/farmers.service';
import { userService } from '../services/users.service';
import { createCropDto } from '../utils/dtos/createCrop';
import { loginDto } from '../utils/dtos/login';
import { signupDto } from '../utils/dtos/signup';
import { Roles } from '../utils/ROLES/decorator';
import { RolesGuard } from '../utils/ROLES/guard';
import { AddCartItemDto, UpdateItemDto } from '../utils/dtos/cart';
import { OrderDto } from '../utils/dtos/order';
import { farmer } from '../utils/schemas/farmers';
import { UpdateProfileDto } from '../utils/dtos/profile';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { CreateFarmerDto } from 'src/utils/dtos/farmers';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';



@Controller('farm-app')
export class FarmAppController {

  constructor(@Inject("USER_SERVICE") private userService: userService, @Inject("FARMERS_SERVICE") private farmerService: FarmersService, private configService: ConfigService){

    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });

  }

  @Render('signup')
  @Get('signup')
  register(){}


  @Post('signup')
  async signup(
    @Body() signupDto: signupDto,
    @Res() res: Response,
    @Session() session: Record<string, any>
  ) {
    try {
      // Register the new user
      const user = await this.userService.register(signupDto);
  
      // Store user information and role in session
      session.userId = user._id;
      session.email = user.email;
      session.role = user.role; // Store role (e.g., 'farmer' or 'user')
  
      console.log('Session after signup:', session);
  
      // Redirect the user to the home page after successful signup
      return res.redirect('home');
    } catch (error) {
      // Handle errors and return a bad request response
      return res.status(400).json({ message: error.message });
    }
  }
  
  @Render('login')
  @Get('/login')
  log(){}

    
  @Post('login')
  async login(
    @Request() req,
    @Body() loginDto: loginDto,
    @Session() session: Record<string, any>,
    @Res() res: Response,
  ) {
    const { email, password } = loginDto;
  
    try {
      const user = await this.userService.validateUser(email, password);
  
      if (user) {
        // Store user information and role in session
        session.userId = user._id;
        session.email = user.email;
        session.role = user.role;
  
        if (user.farmId) {
          session.farmId = user.farmId;
        }
  
        console.log('Session after login:', session);
  
        // Redirect to home page after login
        return res.status(200).json({ message: 'Login successful', redirectUrl: 'home' });
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        console.log(error);
  
        // Send the error message as a JSON response
        return res.status(401).json({ message: 'Invalid login credentials' });
      }
  
      // Handle unexpected errors
      return res.status(500).json({ message: 'An unexpected error occurred' });
    }
  }
    
  @Get('check-role')
  @UseGuards(AuthGuard('session'))
  checkUserRole(@Request() req) {
    return { role: req.session.role }; // Returns role based on session
  }
    
  @Get('home')
  @Render('home')  // This renders the 'home.ejs' file
  async getAllCropsWithDetails() {
    try {
      const crops = await this.farmerService.getAllCropsWithDetails();
      return { crops };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve crop details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('purchase')
  @Render('buy_page')
  async getCropDetailsAndSimilarCrops(@Query('cropName') cropName: string) {
    try {
      // Fetch crop details
      const cropDetails = await this.farmerService.findCropByName(cropName);
      const crops = Array.isArray(cropDetails) ? cropDetails : [cropDetails];
  
      // Fetch similar crops
      const similarCrops = await this.userService.findSimilarCrops(cropName);
  
      // Return data to the view
      console.log(crops)
      return { crops, similarCrops };
    } catch (error) {
      throw new BadRequestException('Could not retrieve crop details or similar crops');
    }
  }
    
  @Render('farmer')
  @Get('farmer')
  async farmers() {}

  @Post('farmer')
  async upgradeToFarmer(
    @Body() CreateFarmerDto: CreateFarmerDto,
    @Request() req,
    @Res() res: Response
  ) {
    try {
      // Get user ID from the session
      const userId = req.session.userId;
      console.log(userId);
  
      // Upgrade the user to a farmer
      await this.farmerService.upgradeToFarmer(userId, CreateFarmerDto);
  
      // Redirect the user to the home page after successful upgrade
      return res.redirect('home');
    } catch (error) {
      // Handle errors and return a bad request response
      return res.status(400).json({ message: error.message });
    }
  }
  
  @Render('inventory')
  @Get('inventory')
  async getInventory(@Request() req) {
    const farmId = req.session.farmId; // Assuming session stores farmId
    if (!farmId) {
      throw new Error('Farm ID not found in session'); // Optional: Handle missing farmId
    }
    const inventory = await this.farmerService.findAllCropsByFarmer(farmId);
    console.log(inventory);
    return { inventory };
  }

  @Render('crops')
  @Get('crops')
  async getCrops() {}
  
  @Post('post-crop')
  @UseGuards(AuthGuard('session')) // Protect route using passport-session
  @UseInterceptors(
    FileInterceptor('image', {
      storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
          folder: 'crops', // Cloudinary folder
          resource_type: 'image', // Ensures only images are handled
          format: async () => 'png', // Optional: Always store images as PNG
          public_id: (req, file) =>
            `${Date.now()}_${file.originalname.split('.')[0]}`, // Custom public ID
        } as any, // Fix type-checking
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // Max file size: 5MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed!'), false);
        }
      },
    })
  )
  async postCrop(
    @Request() req, 
    @UploadedFile() file: Express.Multer.File, 
    @Body() createCropDto: createCropDto, 
    @Res() res: Response
  ) {
    const farmId = req.session.farmId; // Retrieve farm ID from the session
  
    if (!farmId) {
      return res
        .status(400)
        .json({ message: 'Invalid session. Please log in again.' });
    }
  
    try {
      let imageUrl = null;
  
      if (file) {
        // Get the secure URL of the uploaded image from Cloudinary
        imageUrl = file.path;
      }
  
      // Call the service to create the crop
      const crop = await this.farmerService.createCrop(farmId, createCropDto, imageUrl);
  
      // Redirect to the home page upon success
      return res.redirect('home');
    } catch (error) {
      console.error('Error creating crop:', error);
      return res.status(500).json({ message: 'Error creating crop', error: error.message });
    }
  }
    
  @Delete('delete_crops')
  async deleteCrop(@Request() req, @Body('cropName') cropName: string, @Res() res: Response) {
    if (!cropName) {
      return res.status(400).json({ message: 'Crop Name is required' });
    }
  
    const farmId = req.session.farmId;
    if (!farmId) {
      return res.status(400).json({ message: 'Invalid session. Please log in again.' });
    }
  
    try {
      await this.farmerService.deleteCrop(farmId, cropName);
      return res.status(200).json({ message: 'Crop deleted successfully' });
    } catch (error) {
      console.error('Error deleting crop:', error);
      return res.status(500).json({ message: 'Error deleting crop', error: error.message });
    }
  }
  
  @Render('search') // Renders the search.ejs file
  @Get('search')
  async search(@Query('q') query: string) {
    if (!query) {
      return { message: 'Please provide a search query' };
    }
  
    const result = await this.farmerService.search(query);
    console.log(result); // Ensure this logs the correct result
    return { result }; // Pass the result to the frontend
  }

  
  @Render('cart')
  @Get('cart')
  async getCart(@Request() req) {
    const userId = req.session.userId;
    try {
      const cart = await this.userService.getCart(userId);
      return { cart };
    } catch (error) {
      if (error.status === 404) {
        return { cart: { items: [], totalPrice: 0 } };
      }
      throw error;
    }
  }

  
  @Post('add')
  async addToCart(@Request() req, @Body() addCartItemDto: AddCartItemDto) {
      const userId = req.session.userId;
  
      try {
          const item = await this.userService.addOrUpdateCartItem(userId, addCartItemDto);
          console.log('Cart After Adding Item:', item); // Log the updated cart
          return { message: 'Item added to cart successfully', cart: item };
      } catch (error) {
          return { message: 'Failed to add item to cart', error: error.message };
      }
  }
    
  // Update cart route
  @Patch('update')
  async updateCart(@Request() req,  @Res() res: Response, @Body() UpdateItemDto:UpdateItemDto) {
      const userId = req.session.userId;
  
      try {
          // Call service to update the cart
          const updatedCart = await this.userService.updateItemQuantity(UpdateItemDto, userId);
          return { message: 'Cart updated successfully', cart: updatedCart };
      } catch (error) {
          return { message: 'Failed to update cart', error: error.message };
      }
  }

  
 @Delete('remove/:cropName')
  async removeFromCart(@Request() req, @Param('cropName') cropName: string) {

    console.log(cropName)
    const userId = req.session.userId;  // Retrieve user ID from session or token
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const result = await this.userService.removeItemFromCart(userId, cropName);
    if (!result) {
      throw new BadRequestException('Item not found in cart');
    }

    return { message: 'Item removed from cart successfully' };
  }

  @Post('buy')
  async buyCrop(@Body() orderDto: OrderDto, @Request() req): Promise<any> {
    const userId = req.session.userId;
    const userEmail = req.session.email;

    console.log(orderDto);

    if (!userId || !userEmail) {
      throw new BadRequestException('User ID and email are required');
    }

    try {
      // Process the purchase, create the order, and initialize the Paystack transaction
      const paymentUrl = await this.userService.processDirectPurchase(
        userId,
        userEmail,
        orderDto
      );

      console.log(paymentUrl)

      return { message: 'Order placed successfully', paymentUrl };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('checkout')
  async createOrder(
    @Body() OrderDto: OrderDto,
    @Request() req,
    @Res() res: Response,
  ) {

    console.log("checkout"+ OrderDto)
    try {
      // Retrieve userId and email from session
      const userId = req.session.userId;
      const userEmail = req.session.email;

      if (!userId || !userEmail) {
        throw new HttpException('User ID or email missing from session', HttpStatus.BAD_REQUEST);
      }

      console.log("checkout")

      // Create and process the order, including payment initialization
      const paymentUrl = await this.userService.processOrder(OrderDto, userId, userEmail);

      // Redirect user to Paystack for payment
      return res.json({ authorizationUrl: paymentUrl });
    } catch (error) {
      console.error('Error during order creation:', error);
      throw new HttpException('Order creation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('callback')
  async handlePaymentRedirect(
    @Query('reference') reference: string,
    @Res() res: Response,
    @Request() req,
  ) {
    try {
      if (!reference) {
        throw new HttpException('No reference found in query parameters', HttpStatus.BAD_REQUEST);
      }

      // Verify the transaction and update the order status
      await this.userService.handlePaymentCallback(reference);

      // Clear the user's cart from the database after successful payment
      await this.userService.clearCart(req.session.userId);

      // Redirect to a success page or return a response
      return res.redirect('home'); // Redirect to a success page
    } catch (error) {
      console.error('Error handling payment callback:', error);
      return res.status(500).json({ message: 'Payment handling failed' });
    }
  }


  @Render('notifications')
  @Get('notification')
  async getNotifications(@Request() req) {
    const userId = req.session.userId;
    const farmId = req.session.farmId;
    console.log('userID' + userId)
    const notifications = await this.userService.getNotifications(userId, farmId);
    console.log(notifications)
    return { notifications: notifications.userNotifications.concat(notifications.farmerNotifications) };
  }
  
  @Patch(':id/mark-read')
  async markAsRead(@Param('id') notificationId: string) {
    return await this.userService.markAsRead(notificationId);
  }

  @Get('unread-notifications-count')
  async getUnreadNotificationsCount(@Request() req) {
    const userId = req.session.userId;
    const farmId = req.session.farmId;
    const count = await this.userService.getUnreadNotificationsCount(userId, farmId);
    return { count };
  }


  @Post('update-profile')
  @UseInterceptors(
    FileInterceptor('profilePicture', { // Change the field name here
      storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
          folder: 'profile-pictures',
          resource_type: 'image',
          format: async () => 'png',
          public_id: (req, file) =>
            `${Date.now()}_${file.originalname.split('.')[0]}`,
        } as any,
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed!'), false);
        }
      },
    }),
  )
    async updateProfile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpdateProfileDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const userId = req.session.userId;
    const role = req.session.role; // 'user' or 'farmer'

    if (!userId || !role) {
      return res.status(400).json({ message: 'Invalid session. Please log in again.' });
    }

    try {
      let updateData: UpdateProfileDto = { ...body };

      if (file) {
        // Store the secure URL of the uploaded image in the database
        updateData.profilePicture = file.path;
      }

      let updatedProfile;

      // Define role-based update logic
      if (role === 'farmer') {
        updatedProfile = await this.farmerService.updateFarmerProfile(userId, updateData);
        return res.redirect('farmer_profile');
      } else if (role === 'user') {
        updatedProfile = await this.userService.updateUserProfile(userId, updateData);
        return res.redirect('user_profile');
      } else {
        return res.status(400).json({ message: 'Invalid role specified' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
  }

  @Post('update-profile-picture')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
          folder: 'profile-pictures',
          resource_type: 'image',
          format: async () => 'png',
          public_id: (req, file) =>
            `${Date.now()}_${file.originalname.split('.')[0]}`,
        } as any,
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed!'), false);
        }
      },
    }),
  )
  async updateProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Res() res: Response,
  ) {
    const userId = req.session.userId;
    const role = req.session.role; // 'user' or 'farmer'

    if (!userId || !role) {
      return res.status(400).json({ message: 'Invalid session. Please log in again.' });
    }

    try {
      let updateData: UpdateProfileDto = {};

      if (file) {
        // Store the secure URL of the uploaded image in the database
        updateData.profilePicture = file.path;
      }

      let updatedProfile;

      // Define role-based update logic
      if (role === 'farmer') {
        updatedProfile = await this.farmerService.updateFarmerProfile(userId, updateData);
        return res.redirect('farmer_profile');
      } else if (role === 'user') {
        updatedProfile = await this.userService.updateUserProfile(userId, updateData);
        return res.redirect('user_profile');
      } else {
        return res.status(400).json({ message: 'Invalid role specified' });
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      res.status(500).json({ message: 'Error updating profile picture', error: error.message });
    }
  }

  
  @Get('user_profile')
  @Render('user_profile')
  async getUserProfile(@Request() req, @Res() res: Response) {
    const userId = req.session.userId;
 
    try {
      const profileData = await this.userService.getUserProfile(userId);
      console.log(profileData);
      return { user: profileData };
    } catch (error) {
      return res.status(404).json({
        message: `User profile not found for userId: ${userId}`,
        error: 'Not Found',
        statusCode: 404,
      });
    }
  }
 
  @Render('farmer_profile')
  @Get('farmer_profile')
  async getFarmerProfile(@Request() req) {
    const userId = req.session.userId;
 
    try {
      const profileData = await this.farmerService.getUserProfile(userId);
      console.log(profileData)
      return { profile: profileData }; // Pass the data as 'profile'
    } catch (error) {
      throw new NotFoundException(`Farmer profile not found for userId: ${userId}`);
    }
  }
 
  @Post('logout')
  logout(@Req() req, @Res() res: Response): void {
    req.logout((err) => {
      if (err) {
        return res.status(500).send('Logout failed');
      }
      req.session.destroy(() => {
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('signup'); // Redirect user to the login page after logout
      });
    });
  } 
}