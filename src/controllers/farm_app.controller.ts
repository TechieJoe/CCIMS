import { BadRequestException, Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, InternalServerErrorException, NotFoundException, Param, Patch, Post, Put, Query, Render, Req, Request, Res, Session, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { FarmersService } from 'src/services/farmers.service';
import { userService } from 'src/services/users.service';
import { createCropDto } from 'src/utils/dtos/createCrop';
import { loginDto } from 'src/utils/dtos/login';
import { signupDto } from 'src/utils/dtos/signup';
import { Roles } from 'src/utils/ROLES/decorator';
import { RolesGuard } from 'src/utils/ROLES/guard';
import { AddCartItemDto, UpdateItemDto } from 'src/utils/dtos/cart';
import { AuthService } from 'src/services/auth.service';
import { OrderDto } from 'src/utils/dtos/order';
import { v4 as uuidv4 } from 'uuid';
import { CreateFarmerDto } from 'src/utils/dtos/farmers';
import { farmer } from 'src/utils/schemas/farmers';
import { UpdateProfileDto } from 'src/utils/dtos/profile';

@Controller('farm-app')
export class FarmAppController {

  constructor(@Inject("USER_SERVICE") private userService: userService, @Inject("FARMERS_SERVICE") private farmerService: FarmersService, @Inject("AUTH_SERVICE") private AuthService: AuthService){}

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
        
      // Return the user data with a success response
      return res.status(201).json({
        message: 'Signup successful',
        user
      });
    } catch (error) {
      // Handle errors and return a bad request response
      return res.status(400).json({ message: error.message });
    }
  }

  @Render('login')
  @Get('/login')
  log(){}

    
  @Post('/login')
  async login(
    @Request() req, 
    @Body() loginDto: loginDto, 
    @Session() session: Record<string, any>, 
    @Res() res: Response
  ) {
      const { email, password } = loginDto;
      const user = await this.userService.validateUser(email, password);
      
      if (user) {
        // Store user information and role in session
        session.userId = user._id;
        session.email = user.email;
        session.role = user.role; // Store role in session

        if (user.farmId) {
          session.farmId = user.farmId;
        }    

        console.log(session.farmId)
        
        console.log('Session after login:', session);
        
        // Redirect to home page after login
        return res.redirect('home');
      } else {
        throw new UnauthorizedException('Invalid credentials');
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
  async upgradeToFarmer(@Body() CreateFarmerDto: CreateFarmerDto, @Request() req) {
    const userId = req.session.userId // Get user ID from the session
    console.log(userId)
    return this.farmerService.upgradeToFarmer( userId, CreateFarmerDto);
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
  async crops() {}

  @Post('post-crop')
  @UseGuards(AuthGuard('session')) // Protect route using passport-session
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/crops', // Save the image in the correct folder
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // Max file size: 5MB
    }),
  )
  async postCrop(
    @Request() req, 
    @UploadedFile() file: Express.Multer.File, 
    @Body() createCropDto: createCropDto
  ) {
    const farmId = req.session.farmId;
    console.log(farmId)
    const imageUrl = `/uploads/crops/${file.filename}`; // Correct image URL
    return this.farmerService.createCrop(farmId, createCropDto, imageUrl);
  }
  
  @Delete('delete_crops')
  async deleteCrop(@Body('cropId') cropId: string) {
    if (!cropId) {
      throw new BadRequestException('Crop ID is required');
    }
    return this.farmerService.deleteCrop(cropId);
  }

  @Render('search')
  @Get('search')
  async search(@Query('q') query: string, @Res() res: Response) {
    if (!query) {
      return { errorMessage: 'Search query is required', crops: [] };
    }
  
    try {
      const { crops } = await this.userService.searchAll(query);
  
      if (!crops.length) {
        return { errorMessage: 'No results found', crops: [] };
      }
  
      const formattedCrops = crops.map((crop) => {
        const farmer = crop.farmId as farmer;
        return {
          cropName: crop.cropName,
          amountPerBag: crop.amountPerBag,
          quantity: crop.quantity,
          imageUrl: crop.imageUrl,
          farmName: farmer?.farmName || 'Unknown',
          state: farmer?.state || 'Unknown',
          city: farmer?.LGA || 'Unknown',
        };
      });
  
      console.log(formattedCrops)
      return { crops: formattedCrops };
    } catch (error) {
      console.error('Error during search:', error); // Log the actual error
      res.status(500).render('search', { crops: [], error: 'An error occurred. Please try again later.' });
    }
  }
    
  @Render('cart')
  @Get('cart')
  async getCart(@Request() req) {
      const userId = req.session.userId;
      const cart = await this.userService.getCart(userId);
      return { cart };
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
    console.log('userID' + userId)
    const notifications = await this.userService.getNotifications(userId);
    console.log(notifications)
    return { notifications };
  }
  
  @Patch(':id/mark-read')
  async markAsRead(@Param('id') notificationId: string) {
    return await this.userService.markAsRead(notificationId);
  }


  @Post('update-profile')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: diskStorage({
        destination: 'uploads/profile-pictures',
        filename: (req, file, cb) => {
          const fileExt = extname(file.originalname);
          const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
          cb(null, fileName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
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
      let updateData: UpdateProfileDto;  
      let updatedProfile;  
  
      // Define role-based update logic  
      if (role === 'farmer') {  
        updateData = {  
          ...body,  
          profilePicture: file ? `uploads/profile-pictures/${file.filename}` : undefined,  
        };  
        updatedProfile = await this.farmerService.updateFarmerProfile(userId, updateData);  
        return res.json({  
          message: 'Profile updated successfully.',  
          data: updatedProfile,  
          redirectUrl: 'farmer_profile',  
        });  
      } else if (role === 'user') {  
        updateData = {  
          name: body.name,  
          profilePicture: file ? `uploads/profile-pictures/${file.filename}` : undefined,  
        };  
        updatedProfile = await this.userService.updateUserProfile(userId, updateData);  
        return res.json({  
          message: 'Profile updated successfully.',  
          data: updatedProfile,  
          redirectUrl: 'user_profile',  
        });  
      } else {  
        return res.status(400).json({ message: 'Invalid role specified' });  
      }  
    } catch (error) {  
      console.error('Error updating profile:', error);  
      res.status(500).json({ message: 'Error updating profile', error: error.message });  
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

  
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    await this.AuthService.handlePasswordReset(email);
    return { message: 'Reset email sent' };
  }

  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.AuthService.handlePasswordReset(null, token, newPassword);
    return { message: 'Password has been reset' };
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