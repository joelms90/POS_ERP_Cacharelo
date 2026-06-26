import { IsArray, IsOptional } from 'class-validator';

export class PushSyncDto {
  @IsArray()
  @IsOptional()
  orders?: any[];

  @IsArray()
  @IsOptional()
  orderItems?: any[];

  @IsArray()
  @IsOptional()
  payments?: any[];

  @IsArray()
  @IsOptional()
  cashShifts?: any[];

  @IsArray()
  @IsOptional()
  cashTransactions?: any[];
}
