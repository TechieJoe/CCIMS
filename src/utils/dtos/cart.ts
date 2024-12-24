import { IsArray, IsNumber, IsNotEmpty, IsString, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  cropName: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  pricePerBag: number;

  @IsString()
  @IsNotEmpty()
  imageUrl: string; // Image path or URL
}

export class CartDto {
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  @IsArray()
  items: CartItemDto[];

  @IsNumber()
  @IsNotEmpty()
  totalPrice: number; // Total price of all items in the cart
}


export class AddCartItemDto {  
  cropName: string;  
  quantity: number; // Make sure this is defined as a number  
  pricePerBag: number; // Ensure this is also defined as a number  
  imageUrl: string; // Image path or URL
}


export class UpdateItemDto {
  @IsString()
  cropName: string;

  @IsInt()
  @Min(1) // Quantity cannot be less than 1
  quantity: number;
}
