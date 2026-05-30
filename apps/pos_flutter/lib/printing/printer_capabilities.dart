class PrinterCapabilityValidator {
  const PrinterCapabilityValidator();

  void validatePaperWidth(String paperWidth) {
    if (paperWidth != '58mm' && paperWidth != '80mm') {
      throw ArgumentError('Unsupported paper width: $paperWidth');
    }
  }

  void validateEncoding(String encoding) {
    if (encoding.isEmpty) {
      throw ArgumentError('Printer encoding is required');
    }
  }
}

