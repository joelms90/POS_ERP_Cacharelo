import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateTicketStatusDto {
  @IsEnum(['pending', 'preparing', 'ready', 'served'], {
    message: 'status must be one of: pending, preparing, ready, served',
  })
  @IsNotEmpty()
  status: 'pending' | 'preparing' | 'ready' | 'served';
}
