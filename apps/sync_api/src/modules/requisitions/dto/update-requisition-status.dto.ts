import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class UpdateRequisitionStatusDto {
  @IsEnum(['pending', 'approved', 'rejected', 'completed'])
  @IsNotEmpty()
  status: 'pending' | 'approved' | 'rejected' | 'completed';

  @IsString()
  @IsOptional()
  notes?: string;
}
