import { IsUUID, IsNotEmpty, IsNumberString } from 'class-validator';

export class OpenShiftDto {
  @IsUUID()
  @IsNotEmpty()
  cashierId: string;

  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsNumberString()
  @IsNotEmpty()
  initialFloat: string;
}
