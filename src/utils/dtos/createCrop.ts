import { IsMongoId, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class createCropDto {

  @IsMongoId()
  cropId: string;

  @IsNotEmpty()
  @IsString()
  cropName: string;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  amountPerBag: number;

  @IsMongoId()
  farmId: string;

  @IsString()
  imageUrl: string;

}
