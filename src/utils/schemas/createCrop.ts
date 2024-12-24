import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Document } from "mongoose";
import { farmer } from "./farmers";

@Schema()
export class createCrop extends Document {
  //@Prop({ required: true })
  //cropId: string;

  @Prop({ required: true })
  cropName: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  amountPerBag: number;

  @Prop({ required: true })
  imageUrl: string; // Image path or URL

  @Prop({ type: Types.ObjectId, ref: 'farmer', required: true }) // Reference to Farmer schema
  farmId: Types.ObjectId | farmer;

}

export const CropSchema = SchemaFactory.createForClass(createCrop);
