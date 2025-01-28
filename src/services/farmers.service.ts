import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { farmer } from 'src/utils/schemas/farmers';
import { userService } from './users.service';
import { CreateFarmerDto } from 'src/utils/dtos/farmers';
import { Model, Types } from 'mongoose';
import { Roles } from 'src/utils/ROLES/roles';
import { createCropDto } from 'src/utils/dtos/createCrop';
import { createCrop } from 'src/utils/schemas/createCrop';
import { User } from 'src/utils/schemas/user';

@Injectable()
export class FarmersService {

  constructor(@InjectModel(farmer.name) private farmerModel: Model<farmer>, @InjectModel(createCrop.name) private cropModel: Model<createCrop>, @InjectModel(User.name) private userModel: Model<User>) {}

  async upgradeToFarmer(userId: string, createFarmerDto: CreateFarmerDto): Promise<User> {
   
    // Create a new farmer entry
    const farmer = new this.farmerModel(createFarmerDto);
    const savedFarmer = await farmer.save();

    // Update the existing user role and name, linking to the farmer entry
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      {
        role: 'farmer',
        name: createFarmerDto.farmName, // Update user name to farm name
        farmId: savedFarmer._id, // Link the farmer document
      },
      { new: true },
      );

      console.log(savedFarmer);
      console.log(updatedUser);
      return updatedUser;
  }
  
  
  async createCrop(farmId: string, createCropDto: createCropDto, imageUrl: string): Promise<createCrop> {
    const newCrop = new this.cropModel({
      ...createCropDto,
      farmId,
      imageUrl,
    });
    return await newCrop.save();
  }
  
  async getAllCropsWithDetails() {
    return await this.cropModel
      .find()
      .populate('farmId', 'farmName state LGA') // Populate specific fields from Farmer model
      .exec();
  }
  

  async findCropByName(cropName: string) {
    return this.cropModel
      .findOne({ cropName }) // Replace `findOne` with `find` if you want multiple crops
      .populate('farmId'); // Populate the farm details
  }

  async findCropsAndDelete(farmId: string, cropName: string) {
    return this.cropModel
      .findOne({ farmId, cropName }) // Query based on both farmId and cropName
      .populate('farmId'); // Populate the farm details
  }

  async findAllCropsByFarmer(farmerId: string): Promise<createCrop[]> {  
    return this.cropModel.find({ farmId: farmerId }).exec();  
  } 

  async deleteCrop(farmId: string, cropName: string): Promise<void> {
    const result = await this.cropModel.deleteOne({ farmId, cropName }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Crop with name ${cropName} not found for the specified farmer`);
    }
  }

    async getUserProfile(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User not found for userId: ${userId}`);
    }
  
    const userProfile: any = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
    };
  
    if (user.role === 'farmer') {
      const farmer = await this.farmerModel
        .findById(user.farmId)
        .populate('crops')
        .exec();
  
      if (!farmer) {
        throw new NotFoundException(`Farmer details not found for userId: ${userId}`);
      }
  
      const crops = await this.cropModel.find({ _id: { $in: farmer.crops } }).exec();
  
      userProfile.farmDetails = {
        farmName: farmer.farmName,
        description: farmer.description,
        state: farmer.state,
        LGA: farmer.LGA,
        crops,
      };
    }
  
    return userProfile;
  }
  
  async updateFarmerProfile(userId: string, updateData: { name?: string; profilePicture?: string }): Promise<User> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User not found for userId: ${userId}`);
    }
  
    if (updateData.name) {
      user.name = updateData.name;
    }
  
    if (updateData.profilePicture) {
      user.profilePicture = updateData.profilePicture;
    }
  
    return await user.save();
  }

  async search(query: string): Promise<{ crops: any[], farmers: any[] }> {
    const searchQuery = new RegExp(query, 'i'); // Case-insensitive search

    // Search crops by cropName and join farmer details
    const crops = await this.cropModel
      .find({ cropName: searchQuery })
      .populate({
        path: 'farmId',
        model: 'farmer',
        select: 'farmName state LGA', // Select farm details to return
      })
      .exec();

    // Search farmers by farmName or location (state or LGA)
    const farmers = await this.farmerModel
      .find({
        $or: [
          { farmName: searchQuery },
          { state: searchQuery },
          { LGA: searchQuery },
        ],
      })
      .populate({
        path: 'crops',
        model: 'createCrop',
        select: 'cropName quantity amountPerBag imageUrl', // Include imageUrl in the selection
      })
      .exec();

    return { crops, farmers };
  }  
}

