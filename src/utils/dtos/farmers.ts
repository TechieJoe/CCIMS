// farmers/dto/create-farmer.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFarmerDto {
  @IsString()
  @IsNotEmpty()
  farmName: string;

  @IsString()
  description: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  lGA: string;
}
