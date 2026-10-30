import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UpdateRequisitionStatusDto {
  @IsEnum(['pending', 'pending_approval', 'approved', 'standby', 'rejected', 'completed'])
  @IsNotEmpty()
  status: 'pending' | 'pending_approval' | 'approved' | 'standby' | 'rejected' | 'completed';

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;
}

