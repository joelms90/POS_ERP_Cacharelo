import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class PaymentFlowDialog extends StatefulWidget {
  final TableModel table;
  final AppState state;

  const PaymentFlowDialog({
    super.key,
    required this.table,
    required this.state,
  });

  @override
  State<PaymentFlowDialog> createState() => _PaymentFlowDialogState();
}

class _PaymentFlowDialogState extends State<PaymentFlowDialog> {
  String _selectedMethod = 'Efectivo'; // 'Efectivo' or 'Tarjeta'
  String? _selectedCardBrand;
  final TextEditingController _voucherController = TextEditingController();

  final List<String> _cardBrands = ['Visa', 'Mastercard', 'AMEX', 'Carnet'];

  @override
  void dispose() {
    _voucherController.dispose();
    super.dispose();
  }

  bool get _isCardValid {
    if (_selectedMethod != 'Tarjeta') return true;
    final text = _voucherController.text;
    return _selectedCardBrand != null && text.length == 4 && int.tryParse(text) != null;
  }

  String _generatePreCuentaTicket() {
    final buffer = StringBuffer();
    buffer.writeln(widget.state.formatCenter('=== PRE-CUENTA ==='));
    buffer.writeln(widget.state.formatCenter('EMPIRE NOIR RESTAURANTE'));
    buffer.writeln(widget.state.formatCenter(widget.table.label));
    final dateStr = DateTime.now().toString().substring(0, 16);
    buffer.writeln(widget.state.formatRow('Fecha:', dateStr));
    buffer.writeln(widget.state.formatRow('Mesero:', widget.state.currentUserName));
    buffer.writeln(widget.state.formatDivider());
    buffer.writeln(widget.state.formatRow('Cant Descripcion', 'Total'));
    buffer.writeln(widget.state.formatDivider());

    for (final item in widget.table.items) {
      final line = '${item.quantity}x ${item.item.name}';
      final priceStr = '\$${item.totalPrice.toStringAsFixed(2)}';
      buffer.writeln(widget.state.formatRow(line, priceStr));
      if (item.modifiers.isNotEmpty) {
        buffer.writeln('   + ${item.modifiers.join(', ')}');
      }
      if (item.notes.isNotEmpty) {
        buffer.writeln('   * Nota: ${item.notes}');
      }
    }

    buffer.writeln(widget.state.formatDivider());
    buffer.writeln(widget.state.formatRow('Subtotal:', '\$${widget.table.subtotal.toStringAsFixed(2)}'));
    final tax = widget.table.subtotal * 0.16;
    buffer.writeln(widget.state.formatRow('IVA (16%):', '\$${tax.toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatDivider(char: '='));
    final total = widget.table.subtotal + tax;
    buffer.writeln(widget.state.formatRow('TOTAL:', '\$${total.toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatDivider(char: '='));
    buffer.writeln('');
    buffer.writeln(widget.state.formatCenter('* FAVOR DE PAGAR EN CAJA *'));
    buffer.writeln(widget.state.formatCenter('GRACIAS POR SU VISITA'));
    return buffer.toString();
  }

  String _generateCardCheckoutTicket(String cardBrand, String last4) {
    final buffer = StringBuffer();
    buffer.writeln(widget.state.formatCenter('=== COMPROBANTE PAGO ==='));
    buffer.writeln(widget.state.formatCenter('EMPIRE NOIR RESTAURANTE'));
    buffer.writeln(widget.state.formatCenter(widget.table.label));
    final dateStr = DateTime.now().toString().substring(0, 16);
    buffer.writeln(widget.state.formatRow('Fecha:', dateStr));
    buffer.writeln(widget.state.formatRow('Mesero:', widget.state.currentUserName));
    buffer.writeln(widget.state.formatDivider());
    buffer.writeln(widget.state.formatRow('Metodo:', 'TARJETA'));
    buffer.writeln(widget.state.formatRow('Banco/Marca:', cardBrand));
    buffer.writeln(widget.state.formatRow('Referencia:', '**** $last4'));
    buffer.writeln(widget.state.formatDivider());
    buffer.writeln(widget.state.formatRow('Cant Descripcion', 'Total'));
    buffer.writeln(widget.state.formatDivider());

    for (final item in widget.table.items) {
      final line = '${item.quantity}x ${item.item.name}';
      final priceStr = '\$${item.totalPrice.toStringAsFixed(2)}';
      buffer.writeln(widget.state.formatRow(line, priceStr));
      if (item.modifiers.isNotEmpty) {
        buffer.writeln('   + ${item.modifiers.join(', ')}');
      }
    }

    buffer.writeln(widget.state.formatDivider());
    buffer.writeln(widget.state.formatRow('Subtotal:', '\$${widget.table.subtotal.toStringAsFixed(2)}'));
    final tax = widget.table.subtotal * 0.16;
    buffer.writeln(widget.state.formatRow('IVA (16%):', '\$${tax.toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatDivider(char: '='));
    final total = widget.table.subtotal + tax;
    buffer.writeln(widget.state.formatRow('PAGADO:', '\$${total.toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatDivider(char: '='));
    buffer.writeln('');
    buffer.writeln(widget.state.formatCenter('* TRANSACCION APROBADA *'));
    buffer.writeln(widget.state.formatCenter('GRACIAS POR SU VISITA'));
    return buffer.toString();
  }

  void _handleConfirm() {
    if (_selectedMethod == 'Efectivo') {
      // 1. Add PrintJob for Pre-Cuenta
      final printDetails = _generatePreCuentaTicket();
      widget.state.enqueuePrintJob(
        PrintJob(
          id: 'pc_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Pre-Cuenta - ${widget.table.label}',
          details: printDetails,
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      );

      // 2. Mark table as ready for billing
      widget.state.requestBilling(widget.table.id);

      Navigator.of(context).pop('efectivo');
    } else {
      // Card Payment
      if (!_isCardValid) return;

      final cardBrand = _selectedCardBrand!;
      final last4 = _voucherController.text;
      final refCode = '$cardBrand - **** $last4';

      // 1. Add PrintJob for Card payment receipt
      final printDetails = _generateCardCheckoutTicket(cardBrand, last4);
      widget.state.enqueuePrintJob(
        PrintJob(
          id: 'card_rec_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Ticket Pago Tarjeta - ${widget.table.label}',
          details: printDetails,
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      );

      // 2. Checkout the table using card details
      widget.state.checkoutTable(
        widget.table.id,
        discount: 0.0,
        paymentMethod: 'Tarjeta',
        refCode: refCode,
      );

      Navigator.of(context).pop('tarjeta');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: EmpireColors.obsidian,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
      ),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Title
            Row(
              children: [
                const Icon(
                  Icons.receipt_long,
                  color: EmpireColors.champagneGold,
                  size: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Cobrar - ${widget.table.label}',
                    style: const TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Selector Tabs
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    avatar: const Icon(Icons.money, size: 16, color: EmpireColors.textPrimary),
                    label: const Text('EFECTIVO'),
                    selected: _selectedMethod == 'Efectivo',
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedMethod = 'Efectivo');
                      }
                    },
                    selectedColor: EmpireColors.champagneGold.withOpacity(0.3),
                    backgroundColor: EmpireColors.charcoalSurface,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ChoiceChip(
                    avatar: const Icon(Icons.credit_card, size: 16, color: EmpireColors.textPrimary),
                    label: const Text('TARJETA'),
                    selected: _selectedMethod == 'Tarjeta',
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedMethod = 'Tarjeta');
                      }
                    },
                    selectedColor: EmpireColors.champagneGold.withOpacity(0.3),
                    backgroundColor: EmpireColors.charcoalSurface,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Dynamic Inputs based on selectedMethod
            if (_selectedMethod == 'Efectivo') ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: EmpireColors.charcoalSurface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: EmpireColors.agedBronzeDark),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PAGO EN CAJA',
                      style: TextStyle(
                        color: EmpireColors.textGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Se imprimirá un ticket pre-cuenta para el comensal. La mesa cambiará a estado "Por Cobrar" (Billing) y el cobro final se realizará en caja.',
                      style: TextStyle(
                        color: EmpireColors.textSecondary,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              const Text(
                'Seleccione el tipo de tarjeta:',
                style: TextStyle(
                  color: EmpireColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _cardBrands.map((brand) {
                  final isSelected = _selectedCardBrand == brand;
                  return ChoiceChip(
                    label: Text(brand),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        _selectedCardBrand = selected ? brand : null;
                      });
                    },
                    selectedColor: EmpireColors.champagneGold.withOpacity(0.2),
                    backgroundColor: EmpireColors.charcoalSurface,
                    labelStyle: TextStyle(
                      color: isSelected ? EmpireColors.champagneGold : EmpireColors.textPrimary,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              const Text(
                'Últimos 4 dígitos del voucher bancario:',
                style: TextStyle(
                  color: EmpireColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _voucherController,
                maxLength: 4,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  counterText: '',
                  hintText: 'Ej. 1234',
                  hintStyle: TextStyle(color: EmpireColors.textSecondary),
                  enabledBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: EmpireColors.agedBronze),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: EmpireColors.champagneGold),
                  ),
                ),
                style: const TextStyle(color: EmpireColors.textPrimary),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 8),
              const Text(
                'Asegúrese de procesar la tarjeta primero en la terminal física antes de guardar los datos.',
                style: TextStyle(
                  color: EmpireColors.textSecondary,
                  fontStyle: FontStyle.italic,
                  fontSize: 11,
                ),
              ),
            ],

            const SizedBox(height: 24),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: EmpireColors.textSecondary),
                      foregroundColor: EmpireColors.textPrimary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('CANCELAR'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: (_selectedMethod == 'Efectivo' || _isCardValid) ? _handleConfirm : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: EmpireColors.champagneGold,
                      foregroundColor: EmpireColors.obsidian,
                      disabledBackgroundColor: EmpireColors.charcoalSurface,
                      disabledForegroundColor: EmpireColors.textSecondary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(
                      _selectedMethod == 'Efectivo' ? 'IMPRIMIR TICKET' : 'PROCESAR PAGO',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
