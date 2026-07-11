export class UpsertTicketSettingsDto {
  businessId: string;
  branchId?: string | null;
  sellerDisplayName: string;
  legalName: string;
  fiscalId: string;
  branchName: string;
  branchAddress: string;
  phone?: string | null;
  receiptPrefix: string;
  taxMode?: 'breakdown' | 'included';
  footerText?: string | null;
  isActive?: boolean;
}
