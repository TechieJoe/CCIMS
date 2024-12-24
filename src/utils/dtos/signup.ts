import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CartDto } from './cart';
import { OrderDto } from './order';
import { Type } from 'class-transformer';

export class signupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  readonly profilePicture?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CartDto)
  cart?: CartDto; // Single cart, no array

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderDto) // Use a DTO here instead of schema
  orders?: OrderDto[];
}
