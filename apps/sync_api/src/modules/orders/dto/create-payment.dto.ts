import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class CreatePaymentDto {
  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsEnum(['cash', 'card'], {
    message: 'paymentMethod must be one of: cash, card',
  })
  @IsNotEmpty()
  paymentMethod: 'cash' | 'card';

  @IsString()
  @IsOptional()
  @Length(2, 50)
  referenceCode?: string;
}
