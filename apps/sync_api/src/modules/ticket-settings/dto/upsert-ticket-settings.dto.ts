import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertTicketSettingsDto {
  @IsString()
  @IsNotEmpty()
  businessId: string;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsString()
  @IsNotEmpty()
  sellerDisplayName: string;

  @IsString()
  @IsNotEmpty()
  legalName: string;

  @IsString()
  @IsNotEmpty()
  fiscalId: string;

  @IsString()
  @IsNotEmpty()
  branchName: string;

  @IsString()
  @IsNotEmpty()
  branchAddress: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsString()
  @IsNotEmpty()
  receiptPrefix: string;

  @IsOptional()
  @IsIn(['breakdown', 'included'])
  taxMode?: 'breakdown' | 'included';

  @IsOptional()
  @IsString()
  footerText?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
