import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export interface CartItem {
  cropName: string;
  quantity: number;
  pricePerBag: number;
  imageUrl: string;
}

@Schema({ timestamps: true })
export class Cart extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }) // Ensure to reference the User model  
  userId: Types.ObjectId;

  @Prop({ type: [Object], required: true }) // Array of CartItem objects
  items: CartItem[];

  @Prop({ default: 0 })
  totalPrice: number; // Total price of all items in the cart
}

export const CartSchema = SchemaFactory.createForClass(Cart);
