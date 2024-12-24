import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";  
import mongoose, { Types, Document } from "mongoose";  
import { Roles } from "src/utils/ROLES/roles";  
import { farmer } from "./farmers";

@Schema()  
export class User extends Document {  
  @Prop({ required: true })  
  name: string;  

  @Prop({ unique: true, required: true })  
  email: string;  

  @Prop({ required: true })  
  password: string;  

  @Prop()
  profilePicture: string; // URL for the profile picture

  @Prop({ required: true, enum: Roles, default: Roles.User })  
  role: Roles;  

  @Prop({ nullable: true })  
  resetToken?: string;  

  @Prop({ type: Date, nullable: true })  
  resetTokenExpiry?: Date;  

  @Prop({ type: Types.ObjectId, ref: 'farmer' })
  farmId: Types.ObjectId | farmer;
  
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Cart' }) // Single Cart reference
  cart?: Types.ObjectId;  

  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'Order' }) // Now supports multiple orders  
  orders?: Types.ObjectId[];  
}  

export const UserSchema = SchemaFactory.createForClass(User);