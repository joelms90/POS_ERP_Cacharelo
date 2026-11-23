import { IsEnum, IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** Structured categories (spec 019 MV-02); mirrors the labels already used by the POS dialogs. */
export const CASH_IN_CATEGORIES = ['aporte_cambio', 'reposicion_fondo', 'correccion', 'otro_ingreso'] as const;
export const CASH_OUT_CATEGORIES = ['gasto_operativo', 'entrega_encargado', 'transferencia_caja', 'correccion', 'otro_egreso'] as const;
export const CASH_MOVEMENT_CATEGORIES = Array.from(new Set([...CASH_IN_CATEGORIES, ...CASH_OUT_CATEGORIES]));

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

  @IsOptional()
  @IsIn(CASH_MOVEMENT_CATEGORIES)
  category?: string;

  /** Client-generated id; retries with the same value never duplicate the entry. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientUuid?: string;
}
