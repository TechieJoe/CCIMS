import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Document } from "mongoose";

@Schema()
export class farmer extends Document {
  @Prop({ required: true })
  farmName: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  LGA: string;

  @Prop({ type: [Types.ObjectId], ref: 'createCrop' }) // Add relationship to multiple crops
  crops?: Types.ObjectId[];
}

export const farmerSchema = SchemaFactory.createForClass(farmer);
