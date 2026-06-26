import { IsEnum, IsNotEmpty, IsNumberString, IsString, Length } from 'class-validator';

export class CreateTransactionDto {
  @IsEnum(['cash-in', 'cash-out'], {
    message: 'Type must be one of: cash-in, cash-out',
  })
  @IsNotEmpty()
  type: 'cash-in' | 'cash-out';

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  reason: string;
}
