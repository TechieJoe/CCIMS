import { IsNotEmpty, IsNumber, ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsNotEmpty()
  @IsString()
  cropName: string;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  pricePerBag: number;

  @IsString()
  imageUrl: string; // Add this property

  @IsNotEmpty()
  @IsNumber()
  totalPrice: number;
}

export class OrderDto {

  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNotEmpty()
  @IsNumber()
  grandTotal: number;

  @IsNotEmpty()
  @IsString()
  transactionReference: string;
}
