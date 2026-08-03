import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:ui';
import '../common/colors.dart';
import '../common/app_state.dart';
import 'equal_split_payment_screen.dart';
import 'by_items_payment_screen.dart';

class SplitCheckoutView extends StatefulWidget {
  final TableModel table;
  final AppState state;
  final VoidCallback onCancel;
  final VoidCallback onSuccess;

  const SplitCheckoutView({
    super.key,
    required this.table,
    required this.state,
    required this.onCancel,
    required this.onSuccess,
  });

  @override
  State<SplitCheckoutView> createState() => _SplitCheckoutViewState();
}

enum PaymentType {
  simple, // Cobro Simple - regular full payment
  equalSplit, // División Equitativa
  byItems, // Por Artículos
}

class _SplitCheckoutViewState extends State<SplitCheckoutView> {
  // Payment type selection
  PaymentType _selectedPaymentType = PaymentType.simple;

  // Split settings
  bool isEqualSplit = true;
  int splitCount = 2; // Start with 2 for equal split
  int?
      _originalSplitCount; // Original split count (never changes after first payment)
  int _paymentsMade = 0; // Track how many partial payments have been completed
  List<int> selectedItemIndexes = [];

  // Discounts
  double selectedDiscount = 0.0;
  final List<double> discounts = [0.0, 5.0, 10.0, 15.0, 20.0];

  // Payment
  String selectedPaymentMethod = 'Efectivo'; // 'Efectivo', 'Tarjeta'
  final TextEditingController _cashReceivedController = TextEditingController();
  final TextEditingController _cardRefController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Restore payment session state from table if it exists
    if (widget.table.activePaymentType != null) {
      switch (widget.table.activePaymentType) {
        case 'simple':
          _selectedPaymentType = PaymentType.simple;
          break;
        case 'equalSplit':
          _selectedPaymentType = PaymentType.equalSplit;
          break;
        case 'byItems':
          _selectedPaymentType = PaymentType.byItems;
          break;
      }
    } else {
      widget.table.activePaymentType = 'simple';
    }
    _paymentsMade = widget.table.paymentsMadeInSession;
    _originalSplitCount = widget.table.originalSplitCountInSession;
  }

  Future<void> _handlePrintPreCuenta() async {
    final printed = await widget.state.printPreCuentaForTable(widget.table);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor:
            printed ? EmpireColors.successGreen : EmpireColors.errorRed,
        content: Text(
          printed
              ? 'Pre-cuenta enviada a impresora.'
              : 'No se pudo imprimir la pre-cuenta. Verifica la impresora.',
        ),
      ),
    );
  }

  double get currentGrossSubtotal {
    if (_selectedPaymentType == PaymentType.simple) {
      // Full table total for simple payment
      return widget.table.subtotal;
    } else if (_selectedPaymentType == PaymentType.equalSplit) {
      // Use the original split count (set on first payment) or current split count
      final divisor = _originalSplitCount ?? splitCount;
      // Ensure divisor is never 0 to avoid division by zero
      if (divisor == 0 || divisor < 2) return 0.0;
      return widget.table.subtotal / divisor;
    } else {
      // By items
      double selectedSum = 0.0;
      for (var i in selectedItemIndexes) {
        selectedSum += widget.table.items[i].totalPrice;
      }
      return selectedSum;
    }
  }

  // Get remaining payments to be made
  int get remainingPayments {
    if (_selectedPaymentType != PaymentType.equalSplit) return 0;
    final total = _originalSplitCount ?? splitCount;
    return total - _paymentsMade;
  }

  // Check if this is the last payment
  bool get isLastPayment {
    if (_selectedPaymentType != PaymentType.equalSplit) return false;
    return remainingPayments <= 1;
  }

  double get currentSubtotal =>
      double.parse((currentGrossSubtotal / ivaFactor).toStringAsFixed(2));
  double get discountAmount => double.parse(
      (currentSubtotal * (selectedDiscount / 100.0)).toStringAsFixed(2));
  double get currentTotal =>
      double.parse((currentGrossSubtotal * (1 - (selectedDiscount / 100.0)))
          .toStringAsFixed(2));
  double get currentTax => double.parse(
      (currentTotal - (currentSubtotal - discountAmount)).toStringAsFixed(2));

  double get remainingTableTotal {
    if (isEqualSplit) {
      final divisor = _originalSplitCount ?? splitCount;
      return splitCount * (widget.table.total / divisor);
    } else {
      return widget.table.total;
    }
  }

  double get cashChange {
    final double cash = double.tryParse(_cashReceivedController.text) ?? 0.0;
    return cash > currentTotal ? cash - currentTotal : 0.0;
  }

  double get cashReceived =>
      double.tryParse(_cashReceivedController.text) ?? 0.0;

  @override
  void dispose() {
    _cashReceivedController.dispose();
    _cardRefController.dispose();
    super.dispose();
  }

  void _processPayment() {
    final refCode = selectedPaymentMethod == 'Tarjeta'
        ? _cardRefController.text
        : 'Efectivo';

    if (selectedPaymentMethod == 'Tarjeta' && refCode.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: EmpireColors.errorRed,
          content: Text('Por favor, ingresa el código de referencia bancaria.'),
        ),
      );
      return;
    }

    if (selectedPaymentMethod == 'Efectivo') {
      final cashVal = double.tryParse(_cashReceivedController.text) ?? 0.0;
      if (cashVal < currentTotal) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: EmpireColors.errorRed,
            content: Text(
              'Efectivo recibido es menor que el total de la cuenta.',
            ),
          ),
        );
        return;
      }
    }

    // For simple payment, just process as full payment
    if (_selectedPaymentType == PaymentType.simple) {
      widget.state.checkoutTable(
        widget.table.id,
        discount: selectedDiscount,
        paymentMethod: selectedPaymentMethod,
        refCode: refCode,
        cashReceived: selectedPaymentMethod == 'Efectivo'
            ? double.tryParse(_cashReceivedController.text)
            : null,
        cashChange: selectedPaymentMethod == 'Efectivo' ? cashChange : null,
      );
      // Clear payment session state
      widget.table.activePaymentType = null;
      widget.table.paymentsMadeInSession = 0;
      widget.table.originalSplitCountInSession = null;
      widget.onSuccess();
      return;
    }

    // Set original split count on first payment (for equal split)
    if (_originalSplitCount == null &&
        _selectedPaymentType == PaymentType.equalSplit) {
      _originalSplitCount = splitCount;
      widget.table.originalSplitCountInSession = splitCount;
    }

    final divisor = _originalSplitCount ?? splitCount;

    // Determine if this is a partial payment
    final bool isPartialEqual =
        _selectedPaymentType == PaymentType.equalSplit && !isLastPayment;
    final bool isPartialItems = _selectedPaymentType == PaymentType.byItems &&
        selectedItemIndexes.isNotEmpty &&
        selectedItemIndexes.length < widget.table.items.length;

    // Save state to table BEFORE processing payment (so it survives the rebuild)
    if (isPartialEqual) {
      _paymentsMade += 1;
      widget.table.paymentsMadeInSession = _paymentsMade;
    }

    // Process the payment
    widget.state.checkoutTable(
      widget.table.id,
      discount: selectedDiscount,
      paymentMethod: selectedPaymentMethod,
      refCode: refCode,
      cashReceived: selectedPaymentMethod == 'Efectivo'
          ? double.tryParse(_cashReceivedController.text)
          : null,
      cashChange: selectedPaymentMethod == 'Efectivo' ? cashChange : null,
      isEqualSplit: _selectedPaymentType == PaymentType.equalSplit,
      splitCount: isLastPayment
          ? 1
          : remainingPayments, // Tell backend how many parts remain
      originalSplitCount: divisor,
      itemIndicesToPay: _selectedPaymentType == PaymentType.equalSplit
          ? null
          : List.from(selectedItemIndexes),
    );

    // Clear controllers
    _cashReceivedController.clear();
    _cardRefController.clear();

    if (isPartialEqual) {
      setState(() {}); // Trigger UI update
      final remaining = remainingPayments;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: EmpireColors.successGreen,
          content: Text(
              'Pago ${_paymentsMade} de $divisor registrado. Quedan $remaining pago(s) pendiente(s).'),
        ),
      );
    } else if (isPartialItems) {
      setState(() {
        selectedItemIndexes.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: EmpireColors.successGreen,
          content: Text(
              'Artículos pagados con éxito. Continúe con los artículos restantes.'),
        ),
      );
    } else {
      // Full payment complete - clear payment session state
      widget.table.activePaymentType = null;
      widget.table.paymentsMadeInSession = 0;
      widget.table.originalSplitCountInSession = null;
      widget.onSuccess();
    }
  }

  void _setCashReceived(double amount) {
    final formattedAmount = amount.toStringAsFixed(2);
    _cashReceivedController.value = TextEditingValue(
      text: formattedAmount,
      selection: TextSelection.collapsed(offset: formattedAmount.length),
    );
    setState(() {});
  }

  void _addCashReceived(double amount) {
    _setCashReceived(cashReceived + amount);
  }

  ButtonStyle _cashActionButtonStyle({
    required Color backgroundColor,
    required Color foregroundColor,
    Color? borderColor,
  }) {
    return OutlinedButton.styleFrom(
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      side: BorderSide(
        color: borderColor ?? backgroundColor,
        width: 1.5,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      textStyle: const TextStyle(
        fontWeight: FontWeight.bold,
        fontSize: 13,
      ),
    );
  }

  Widget _buildCashQuickButton({
    required String label,
    required VoidCallback onPressed,
    required ButtonStyle style,
    IconData? icon,
  }) {
    return SizedBox(
      height: 42,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
        label: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(label),
        ),
        style: style,
      ),
    );
  }

  Widget _buildCashPaymentInputs() {
    final denominationStyle = _cashActionButtonStyle(
      backgroundColor: EmpireColors.charcoalSurface,
      foregroundColor: EmpireColors.textPrimary,
      borderColor: EmpireColors.agedBronze,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.champagneGold, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(
                Icons.touch_app,
                color: EmpireColors.champagneGold,
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Monto Recibido',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _cashReceivedController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}$')),
            ],
            decoration: InputDecoration(
              labelText: 'Monto Recibido',
              prefixText: '\$ ',
              hintText: 'Toca para editar',
              filled: true,
              fillColor: EmpireColors.obsidian,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(
                  color: EmpireColors.champagneGold,
                  width: 2,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(
                  color: EmpireColors.champagneGoldLight,
                  width: 2.5,
                ),
              ),
              suffixIcon: IconButton(
                tooltip: 'Limpiar monto recibido',
                onPressed: () => _setCashReceived(0),
                icon: const Icon(
                  Icons.backspace_outlined,
                  color: EmpireColors.textSecondary,
                ),
              ),
            ),
            style: const TextStyle(
              color: EmpireColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
            onChanged: (val) => setState(() {}),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _buildCashQuickButton(
                  label: 'Exacto \$${currentTotal.toStringAsFixed(2)}',
                  icon: Icons.price_check,
                  onPressed: () => _setCashReceived(currentTotal),
                  style: _cashActionButtonStyle(
                    backgroundColor: EmpireColors.champagneGold,
                    foregroundColor: EmpireColors.obsidian,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildCashQuickButton(
                  label: 'Limpiar',
                  icon: Icons.refresh,
                  onPressed: () => _setCashReceived(0),
                  style: _cashActionButtonStyle(
                    backgroundColor: EmpireColors.onyxSurface,
                    foregroundColor: EmpireColors.textPrimary,
                    borderColor: EmpireColors.agedBronze,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text(
            'Sumar billetes recibidos',
            style: TextStyle(
              color: EmpireColors.textSecondary,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [20, 50, 100, 200, 500]
                .map(
                  (amount) => SizedBox(
                    width: 88,
                    child: _buildCashQuickButton(
                      label: '+\$$amount',
                      onPressed: () => _addCashReceived(amount.toDouble()),
                      style: denominationStyle,
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: EmpireColors.onyxSurface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: EmpireColors.agedBronzeDark),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Text(
                    'Cambio a devolver',
                    style: TextStyle(
                      color: EmpireColors.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '\$${cashChange.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: EmpireColors.successGreen,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _guestEmojiForAssignedGuest(String? assignedGuest) {
    if (assignedGuest == null) return '👨';
    final match = RegExp(r'P(\d+)').firstMatch(assignedGuest);
    if (match == null) return '👨';

    final idx = int.parse(match.group(1)!) - 1;
    if (idx < 0 || idx >= widget.table.guestGenders.length) return '👨';

    final gender = widget.table.guestGenders[idx];
    return gender == 'F' ? '👩' : (gender == 'K' ? '🧒' : '👨');
  }

  Widget _buildGuestBadge(String assignedGuest) {
    final guestEmoji = _guestEmojiForAssignedGuest(assignedGuest);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: EmpireColors.champagneGold.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: EmpireColors.champagneGold.withOpacity(0.3),
        ),
      ),
      child: Text(
        '$assignedGuest $guestEmoji',
        style: const TextStyle(
          color: EmpireColors.champagneGold,
          fontSize: 9,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildOrderReviewPanel() {
    final totalQuantity = widget.table.items.fold<int>(
      0,
      (sum, item) => sum + item.quantity,
    );

    return Container(
      constraints: const BoxConstraints(maxHeight: 320),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: EmpireColors.agedBronzeDark,
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: EmpireColors.agedBronzeDark,
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.receipt_long,
                  color: EmpireColors.champagneGold,
                  size: 18,
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Artículos de la orden',
                    style: TextStyle(
                      color: EmpireColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Text(
                  '$totalQuantity artículos · \$${widget.table.total.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: EmpireColors.textGold,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            color: EmpireColors.onyxSurface.withOpacity(0.45),
            child: Text(
              'Esta división cobra 1 de $splitCount partes. Los artículos se muestran solo para revisión.',
              style: const TextStyle(
                color: EmpireColors.textSecondary,
                fontSize: 11,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.zero,
              itemCount: widget.table.items.length,
              separatorBuilder: (context, index) => const Divider(
                height: 1,
                color: EmpireColors.agedBronzeDark,
              ),
              itemBuilder: (context, index) {
                final item = widget.table.items[index];
                final assignedGuest = item.assignedGuest;
                final detailLines = <String>[
                  if (item.modifiers.isNotEmpty)
                    'Modificadores: ${item.modifiers.join(', ')}',
                  if (item.notes.trim().isNotEmpty)
                    'Nota: ${item.notes.trim()}',
                ];

                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 34,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: EmpireColors.onyxSurface,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: EmpireColors.agedBronzeDark,
                          ),
                        ),
                        child: Text(
                          '${item.quantity}x',
                          style: const TextStyle(
                            color: EmpireColors.champagneGold,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item.item.name,
                                    style: const TextStyle(
                                      color: EmpireColors.textPrimary,
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                if (assignedGuest != null) ...[
                                  const SizedBox(width: 8),
                                  _buildGuestBadge(assignedGuest),
                                ],
                              ],
                            ),
                            if (detailLines.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                detailLines.join(' · '),
                                style: const TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 11,
                                  height: 1.25,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        '\$${item.totalPrice.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: EmpireColors.textGold,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(
    String label,
    String value, {
    Color valueColor = EmpireColors.textPrimary,
    double valueSize = 14,
    FontWeight valueWeight = FontWeight.bold,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: EmpireColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              color: valueColor,
              fontSize: valueSize,
              fontWeight: valueWeight,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentSummaryCard() {
    final received = double.tryParse(_cashReceivedController.text) ?? 0.0;
    final totalParts = _originalSplitCount ?? splitCount;
    final currentPaymentNumber = _paymentsMade + 1;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'RESUMEN DE PAGO',
                style: TextStyle(
                  color: EmpireColors.textGold,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
              if (isEqualSplit && _originalSplitCount != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: EmpireColors.champagneGold.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: EmpireColors.champagneGold.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Text(
                    'Pago $currentPaymentNumber de $totalParts',
                    style: const TextStyle(
                      color: EmpireColors.champagneGold,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          _buildSummaryRow(
              'Subtotal', '\$${currentSubtotal.toStringAsFixed(2)}'),
          if (selectedDiscount > 0)
            _buildSummaryRow(
              'Descuento ${selectedDiscount.toInt()}%',
              '-\$${discountAmount.toStringAsFixed(2)}',
              valueColor: EmpireColors.errorRed,
            ),
          _buildSummaryRow('IVA (16%)', '\$${currentTax.toStringAsFixed(2)}'),
          const Divider(color: EmpireColors.agedBronzeDark, height: 18),
          _buildSummaryRow(
            'Total Restante (Mesa)',
            '\$${remainingTableTotal.toStringAsFixed(2)}',
            valueColor: EmpireColors.textSecondary,
          ),
          const Divider(color: EmpireColors.agedBronzeDark, height: 10),
          _buildSummaryRow(
            'Total Seleccionado',
            '\$${currentTotal.toStringAsFixed(2)}',
            valueColor: EmpireColors.champagneGold,
            valueSize: 18,
          ),
          const Divider(color: EmpireColors.agedBronzeDark, height: 18),
          _buildSummaryRow('Recibido', '\$${received.toStringAsFixed(2)}'),
          _buildSummaryRow(
            'Cambio',
            '\$${cashChange.toStringAsFixed(2)}',
            valueColor: EmpireColors.successGreen,
            valueSize: 16,
          ),
        ],
      ),
    );
  }

  Widget _buildRightCheckoutPanel(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header
        Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: EmpireColors.agedBronzeDark,
                width: 1.5,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Pagar Cuenta',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Mesa: ${widget.table.label} • Total Original: \$${widget.table.total.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: EmpireColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    onPressed: _handlePrintPreCuenta,
                    tooltip: 'Imprimir pre-cuenta',
                    icon: const Icon(
                      Icons.receipt_long,
                      color: EmpireColors.champagneGold,
                    ),
                  ),
                  IconButton(
                    onPressed: widget.onCancel,
                    icon: const Icon(
                      Icons.close,
                      color: EmpireColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Split methods and calculations
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // Split method tabs
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Text(
                        'DIVISIÓN EQUITATIVA',
                        textAlign: TextAlign.center,
                      ),
                      selected: isEqualSplit,
                      onSelected: (val) => setState(() {
                        isEqualSplit = true;
                        _originalSplitCount = null;
                      }),
                      selectedColor: EmpireColors.champagneGold,
                      backgroundColor: EmpireColors.charcoalSurface,
                      labelStyle: TextStyle(
                        color: isEqualSplit
                            ? EmpireColors.obsidian
                            : EmpireColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ChoiceChip(
                      label: const Text(
                        'POR ARTÍCULOS',
                        textAlign: TextAlign.center,
                      ),
                      selected: !isEqualSplit,
                      onSelected: (val) => setState(() {
                        isEqualSplit = false;
                        _originalSplitCount = null;
                      }),
                      selectedColor: EmpireColors.champagneGold,
                      backgroundColor: EmpireColors.charcoalSurface,
                      labelStyle: TextStyle(
                        color: !isEqualSplit
                            ? EmpireColors.obsidian
                            : EmpireColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Dynamic Split Controls
              if (isEqualSplit) ...[
                const Text(
                  'Dividir Cuenta (Número de Personas):',
                  style: TextStyle(
                    color: EmpireColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    IconButton(
                      onPressed: () {
                        if (splitCount > 2 && _paymentsMade == 0) {
                          setState(() {
                            splitCount--;
                            _originalSplitCount = null;
                          });
                        }
                      },
                      icon: Icon(
                        Icons.remove_circle_outline,
                        color: (splitCount > 2 && _paymentsMade == 0)
                            ? EmpireColors.champagneGold
                            : EmpireColors.textSecondary,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        '$splitCount',
                        style: const TextStyle(
                          color: EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _paymentsMade == 0
                          ? () {
                              setState(() {
                                splitCount++;
                                _originalSplitCount = null;
                              });
                            }
                          : null,
                      icon: Icon(
                        Icons.add_circle_outline,
                        color: _paymentsMade == 0
                            ? EmpireColors.champagneGold
                            : EmpireColors.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Text(
                        'Total original dividido en $splitCount partes.',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                _buildOrderReviewPanel(),
              ] else ...[
                const Text(
                  'Selecciona los artículos a cobrar en esta sub-cuenta:',
                  style: TextStyle(
                    color: EmpireColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 10),

                // Seat-based fast select bar
                if (widget.table.guestGenders.isNotEmpty) ...[
                  const Text(
                    'Seleccionar por Comensal:',
                    style: TextStyle(
                      color: EmpireColors.textGold,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 36,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: widget.table.guestGenders.length,
                      itemBuilder: (context, index) {
                        final guestLabel = 'P${index + 1}';
                        final gender = widget.table.guestGenders[index];
                        final emoji = gender == 'F'
                            ? '👩'
                            : (gender == 'K' ? '🧒' : '👨');

                        final guestItemsIndices = <int>[];
                        for (int i = 0; i < widget.table.items.length; i++) {
                          if (widget.table.items[i].assignedGuest ==
                              guestLabel) {
                            guestItemsIndices.add(i);
                          }
                        }
                        final hasItems = guestItemsIndices.isNotEmpty;
                        final allSelected = hasItems &&
                            guestItemsIndices.every(
                              (idx) => selectedItemIndexes.contains(idx),
                            );

                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text('$guestLabel $emoji'),
                            selected: allSelected,
                            onSelected: (val) {
                              setState(() {
                                if (allSelected) {
                                  for (var idx in guestItemsIndices) {
                                    selectedItemIndexes.remove(idx);
                                  }
                                } else {
                                  for (var idx in guestItemsIndices) {
                                    if (!selectedItemIndexes.contains(idx)) {
                                      selectedItemIndexes.add(idx);
                                    }
                                  }
                                }
                              });
                            },
                            selectedColor: EmpireColors.champagneGold,
                            backgroundColor: EmpireColors.charcoalSurface,
                            labelStyle: TextStyle(
                              color: allSelected
                                  ? EmpireColors.obsidian
                                  : EmpireColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                            side: BorderSide(
                              color: allSelected
                                  ? EmpireColors.champagneGold
                                  : EmpireColors.agedBronzeDark,
                              width: 1,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                Container(
                  constraints: const BoxConstraints(maxHeight: 180),
                  decoration: BoxDecoration(
                    color: EmpireColors.charcoalSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: EmpireColors.agedBronzeDark,
                      width: 1,
                    ),
                  ),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: widget.table.items.length,
                    itemBuilder: (context, index) {
                      final item = widget.table.items[index];
                      final isChecked = selectedItemIndexes.contains(index);

                      final assignedGuest = item.assignedGuest;

                      return Material(
                        color: EmpireColors.charcoalSurface,
                        child: CheckboxListTile(
                          value: isChecked,
                          title: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item.item.name,
                                  style: const TextStyle(
                                    color: EmpireColors.textPrimary,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              if (assignedGuest != null) ...[
                                const SizedBox(width: 8),
                                _buildGuestBadge(assignedGuest),
                              ],
                            ],
                          ),
                          subtitle: Text(
                            'Cantidad: ${item.quantity}',
                            style: const TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                          secondary: Text(
                            '\$${item.netTotalPrice.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: EmpireColors.textGold,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          onChanged: (val) {
                            setState(() {
                              if (val == true) {
                                selectedItemIndexes.add(index);
                              } else {
                                selectedItemIndexes.remove(index);
                              }
                            });
                          },
                          activeColor: EmpireColors.champagneGold,
                          checkColor: EmpireColors.obsidian,
                        ),
                      );
                    },
                  ),
                ),
              ],

              const SizedBox(height: 16),
              _buildDiscountSelector(),

              const SizedBox(height: 16),

              // Payment Method
              const Text(
                'Método de Pago:',
                style: TextStyle(
                  color: EmpireColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      avatar: const Icon(
                        Icons.money,
                        size: 16,
                        color: EmpireColors.textPrimary,
                      ),
                      label: const Text('EFECTIVO'),
                      selected: selectedPaymentMethod == 'Efectivo',
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => selectedPaymentMethod = 'Efectivo');
                        }
                      },
                      selectedColor: EmpireColors.champagneGold.withOpacity(
                        0.3,
                      ),
                      backgroundColor: EmpireColors.charcoalSurface,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ChoiceChip(
                      avatar: const Icon(
                        Icons.credit_card,
                        size: 16,
                        color: EmpireColors.textPrimary,
                      ),
                      label: const Text('TARJETA'),
                      selected: selectedPaymentMethod == 'Tarjeta',
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => selectedPaymentMethod = 'Tarjeta');
                        }
                      },
                      selectedColor: EmpireColors.champagneGold.withOpacity(
                        0.3,
                      ),
                      backgroundColor: EmpireColors.charcoalSurface,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Payment inputs
              if (selectedPaymentMethod == 'Efectivo') ...[
                _buildCashPaymentInputs(),
              ] else ...[
                TextField(
                  controller: _cardRefController,
                  decoration: const InputDecoration(
                    labelText: 'Referencia de Terminal Bancaria',
                    hintText: 'Escriba el folio / hash del terminal',
                  ),
                  style: const TextStyle(color: EmpireColors.textPrimary),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Para cobros offline, verifique la aprobación en la terminal e inserte el número de transacción.',
                  style: TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 11,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCheckoutHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: EmpireColors.agedBronzeDark,
            width: 1.5,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Pagar Cuenta',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'Mesa: ${widget.table.label} • Total Original: \$${widget.table.total.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: EmpireColors.textSecondary,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                onPressed: _handlePrintPreCuenta,
                tooltip: 'Imprimir pre-cuenta',
                icon: const Icon(
                  Icons.receipt_long,
                  color: EmpireColors.champagneGold,
                ),
              ),
              IconButton(
                onPressed: widget.onCancel,
                icon:
                    const Icon(Icons.close, color: EmpireColors.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentTypeSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Seleccione tipo de pago:',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _PaymentTypeButton(
                label: 'COBRO\nSIMPLE',
                icon: Icons.receipt_long,
                selected: _selectedPaymentType == PaymentType.simple,
                onTap: () {
                  setState(() {
                    _selectedPaymentType = PaymentType.simple;
                    widget.table.activePaymentType = 'simple';
                  });
                },
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: _PaymentTypeButton(
                label: 'DIVISIÓN\nEQUITATIVA',
                icon: Icons.people,
                selected: _selectedPaymentType == PaymentType.equalSplit,
                onTap: () {
                  // Navigate to dedicated equal split screen
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => EqualSplitPaymentScreen(
                        table: widget.table,
                        state: widget.state,
                        onCancel: () {
                          Navigator.of(context).pop();
                        },
                        onComplete: () {
                          Navigator.of(context).pop();
                          widget.onSuccess();
                        },
                      ),
                    ),
                  );
                },
              ),
            ),
            if (widget.table.items.length > 1) ...[
              const SizedBox(width: 6),
              Expanded(
                child: _PaymentTypeButton(
                  label: 'POR\nARTÍCULOS',
                  icon: Icons.shopping_cart,
                  selected: _selectedPaymentType == PaymentType.byItems,
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => ByItemsPaymentScreen(
                          table: widget.table,
                          state: widget.state,
                          onCancel: () {
                            Navigator.of(context).pop();
                          },
                          onComplete: () {
                            Navigator.of(context).pop();
                            widget.onSuccess();
                          },
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }

  Widget _buildEqualSplitControls() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Dividir Cuenta (Número de Personas):',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            IconButton(
              onPressed: () {
                if (splitCount > 2) {
                  setState(() {
                    splitCount--;
                    _originalSplitCount = null;
                  });
                }
              },
              icon: Icon(
                Icons.remove_circle_outline,
                color: splitCount > 2
                    ? EmpireColors.champagneGold
                    : EmpireColors.textSecondary,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                '$splitCount',
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 20,
                ),
              ),
            ),
            IconButton(
              onPressed: () {
                setState(() {
                  splitCount++;
                  _originalSplitCount = null;
                });
              },
              icon: const Icon(
                Icons.add_circle_outline,
                color: EmpireColors.champagneGold,
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Text(
                'Total original dividido en $splitCount partes.',
                style: const TextStyle(
                  color: EmpireColors.textSecondary,
                  fontSize: 11,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _buildOrderReviewPanel(),
      ],
    );
  }

  Widget _buildItemSplitControls() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Selecciona los artículos a cobrar en esta sub-cuenta:',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 10),
        if (widget.table.guestGenders.isNotEmpty) ...[
          const Text(
            'Seleccionar por Comensal:',
            style: TextStyle(
              color: EmpireColors.textGold,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 36,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: widget.table.guestGenders.length,
              itemBuilder: (context, index) {
                final guestLabel = 'P${index + 1}';
                final gender = widget.table.guestGenders[index];
                final emoji =
                    gender == 'F' ? '👩' : (gender == 'K' ? '🧒' : '👨');
                final guestItemsIndices = <int>[];
                for (int i = 0; i < widget.table.items.length; i++) {
                  if (widget.table.items[i].assignedGuest == guestLabel) {
                    guestItemsIndices.add(i);
                  }
                }
                final hasItems = guestItemsIndices.isNotEmpty;
                final allSelected = hasItems &&
                    guestItemsIndices.every(
                      (idx) => selectedItemIndexes.contains(idx),
                    );

                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text('$guestLabel $emoji'),
                    selected: allSelected,
                    onSelected: (val) {
                      setState(() {
                        if (allSelected) {
                          for (var idx in guestItemsIndices) {
                            selectedItemIndexes.remove(idx);
                          }
                        } else {
                          for (var idx in guestItemsIndices) {
                            if (!selectedItemIndexes.contains(idx)) {
                              selectedItemIndexes.add(idx);
                            }
                          }
                        }
                      });
                    },
                    selectedColor: EmpireColors.champagneGold,
                    backgroundColor: EmpireColors.charcoalSurface,
                    labelStyle: TextStyle(
                      color: allSelected
                          ? EmpireColors.obsidian
                          : EmpireColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                    side: BorderSide(
                      color: allSelected
                          ? EmpireColors.champagneGold
                          : EmpireColors.agedBronzeDark,
                      width: 1,
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
        ],
        Container(
          constraints: const BoxConstraints(maxHeight: 320),
          decoration: BoxDecoration(
            color: EmpireColors.charcoalSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
          ),
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: widget.table.items.length,
            itemBuilder: (context, index) {
              final item = widget.table.items[index];
              final isChecked = selectedItemIndexes.contains(index);
              final assignedGuest = item.assignedGuest;

              return Material(
                color: EmpireColors.charcoalSurface,
                child: CheckboxListTile(
                  value: isChecked,
                  title: Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.item.name,
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      if (assignedGuest != null) ...[
                        const SizedBox(width: 8),
                        _buildGuestBadge(assignedGuest),
                      ],
                    ],
                  ),
                  subtitle: Text(
                    'Cantidad: ${item.quantity}',
                    style: const TextStyle(
                      color: EmpireColors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                  secondary: Text(
                    '\$${item.netTotalPrice.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: EmpireColors.textGold,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  onChanged: (val) {
                    setState(() {
                      if (val == true) {
                        selectedItemIndexes.add(index);
                      } else {
                        selectedItemIndexes.remove(index);
                      }
                    });
                  },
                  activeColor: EmpireColors.champagneGold,
                  checkColor: EmpireColors.obsidian,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDiscountSelector() {
    return Row(
      children: [
        const Icon(Icons.discount, color: EmpireColors.textGold, size: 16),
        const SizedBox(width: 6),
        const Text(
          'Descuento:',
          style: TextStyle(
            color: EmpireColors.textGold,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: EmpireColors.charcoalSurface,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: EmpireColors.agedBronzeDark),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<double>(
                value: selectedDiscount,
                isExpanded: true,
                isDense: true,
                dropdownColor: EmpireColors.charcoalSurface,
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
                items: discounts.map((disc) {
                  return DropdownMenuItem(
                    value: disc,
                    child: Text(
                      disc == 0.0 ? 'Sin Descuento' : '${disc.toInt()}%',
                      style: TextStyle(
                        color: selectedDiscount == disc
                            ? EmpireColors.champagneGold
                            : EmpireColors.textPrimary,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => selectedDiscount = val);
                  }
                },
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOrderDetailsColumn() {
    return Container(
      color: EmpireColors.onyxSurface,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _buildPaymentTypeSelector(),
          const SizedBox(height: 16),
          _buildDiscountSelector(),
          const SizedBox(height: 16),
          if (_selectedPaymentType == PaymentType.equalSplit)
            _buildEqualSplitControls()
          else if (_selectedPaymentType == PaymentType.byItems)
            _buildItemSplitControls()
          else if (_selectedPaymentType == PaymentType.simple)
            _buildOrderReviewPanel(),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Método de Pago:',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: ChoiceChip(
                avatar: const Icon(
                  Icons.money,
                  size: 16,
                  color: EmpireColors.textPrimary,
                ),
                label: const Text('EFECTIVO'),
                selected: selectedPaymentMethod == 'Efectivo',
                onSelected: (selected) {
                  if (selected) {
                    setState(() => selectedPaymentMethod = 'Efectivo');
                  }
                },
                selectedColor: EmpireColors.champagneGold.withOpacity(0.3),
                backgroundColor: EmpireColors.charcoalSurface,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ChoiceChip(
                avatar: const Icon(
                  Icons.credit_card,
                  size: 16,
                  color: EmpireColors.textPrimary,
                ),
                label: const Text('TARJETA'),
                selected: selectedPaymentMethod == 'Tarjeta',
                onSelected: (selected) {
                  if (selected) {
                    setState(() => selectedPaymentMethod = 'Tarjeta');
                  }
                },
                selectedColor: EmpireColors.champagneGold.withOpacity(0.3),
                backgroundColor: EmpireColors.charcoalSurface,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPaymentInputs() {
    if (selectedPaymentMethod == 'Efectivo') {
      return _buildCashPaymentInputs();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _cardRefController,
          decoration: const InputDecoration(
            labelText: 'Referencia de Terminal Bancaria',
            hintText: 'Escriba el folio / hash del terminal',
          ),
          style: const TextStyle(color: EmpireColors.textPrimary),
          onChanged: (value) => setState(() {}),
        ),
        const SizedBox(height: 8),
        const Text(
          'Para cobros offline, verifique la aprobación en la terminal e inserte el número de transacción.',
          style: TextStyle(
            color: EmpireColors.textSecondary,
            fontSize: 11,
            fontStyle: FontStyle.italic,
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentColumn() {
    // Payment type is always selected (defaults to simple)
    final bool hasZeroAmount = (currentTotal <= 0 ||
        (_selectedPaymentType == PaymentType.equalSplit &&
            (_originalSplitCount ?? splitCount) < 2) ||
        (_selectedPaymentType == PaymentType.byItems &&
            selectedItemIndexes.isEmpty));

    final bool cannotProceed = hasZeroAmount;

    return Container(
      width: 380,
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(
          left: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (hasZeroAmount) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: EmpireColors.charcoalSurface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: EmpireColors.errorRed.withValues(alpha: 0.3),
                          width: 1,
                        ),
                      ),
                      child: Column(
                        children: [
                          const Icon(
                            Icons.info_outline,
                            color: EmpireColors.errorRed,
                            size: 28,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            _selectedPaymentType == PaymentType.equalSplit
                                ? 'Por favor, ajuste el número de personas para dividir la cuenta.'
                                : 'Por favor, seleccione artículos a la izquierda para poder registrar el pago parcial.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: EmpireColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                  ] else ...[
                    _buildPaymentMethodSelector(),
                    const SizedBox(height: 18),
                    _buildPaymentInputs(),
                    const SizedBox(height: 18),
                  ],
                  _buildPaymentSummaryCard(),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: cannotProceed ? null : _processPayment,
            style: ElevatedButton.styleFrom(
              backgroundColor: cannotProceed
                  ? EmpireColors.charcoalSurface
                  : (isLastPayment
                      ? EmpireColors.successGreen
                      : EmpireColors.champagneGold),
              disabledBackgroundColor: EmpireColors.charcoalSurface,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                isLastPayment ? 'PROCESAR PAGO FINAL' : 'PROCESAR COBRO',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: cannotProceed
                      ? EmpireColors.textSecondary
                      : (isLastPayment ? Colors.white : EmpireColors.obsidian),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildCheckoutHeader(context),
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _buildOrderDetailsColumn()),
              _buildPaymentColumn(),
            ],
          ),
        ),
      ],
    );
  }
}

// Helper widget for payment type selection buttons
class _PaymentTypeButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _PaymentTypeButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: selected
              ? EmpireColors.champagneGold
              : EmpireColors.charcoalSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected
                ? EmpireColors.champagneGold
                : EmpireColors.agedBronzeDark,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color:
                  selected ? EmpireColors.obsidian : EmpireColors.textPrimary,
              size: 22,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                color:
                    selected ? EmpireColors.obsidian : EmpireColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 11,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
