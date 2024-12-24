import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface OrderItem {
  cropName: string;
  quantity: number;
  pricePerBag: number;
  imageUrl: string;
  totalPrice: number;
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: [Object], required: true }) // Array of OrderItem objects
  items: OrderItem[];

  @Prop({ required: true })
  grandTotal: number; // Total price for the entire order

  @Prop({ default: 'pending' })
  status: string; // Order status (e.g., 'pending', 'paid')

  @Prop({ required: true, unique: true })
  transactionReference: string; // Unique reference for the transaction

}

export const OrderSchema = SchemaFactory.createForClass(Order);
