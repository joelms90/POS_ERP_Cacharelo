import { IsString, IsNotEmpty, IsUUID, IsOptional, Length } from 'class-validator';

export class CreateBranchDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @Length(5, 20)
  phone?: string;
}
