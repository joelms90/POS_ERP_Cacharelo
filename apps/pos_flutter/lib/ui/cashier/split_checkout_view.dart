import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

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

class _SplitCheckoutViewState extends State<SplitCheckoutView> {
  // Split settings
  bool isEqualSplit = true;
  int splitCount = 1;
  List<int> selectedItemIndexes = [];

  // Discounts
  double selectedDiscount = 0.0;
  final List<double> discounts = [0.0, 5.0, 10.0, 15.0, 20.0];

  // Payment
  String selectedPaymentMethod = 'Efectivo'; // 'Efectivo', 'Tarjeta'
  final TextEditingController _cashReceivedController = TextEditingController();
  final TextEditingController _cardRefController = TextEditingController();

  double get currentGrossSubtotal {
    if (isEqualSplit) {
      return widget.table.subtotal / splitCount;
    } else {
      double selectedSum = 0.0;
      for (var i in selectedItemIndexes) {
        selectedSum += widget.table.items[i].totalPrice;
      }
      return selectedSum;
    }
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

    // Capture whether this checkout is a partial split check
    final bool isPartialEqual = isEqualSplit && splitCount > 1;
    final bool isPartialItems = !isEqualSplit &&
        selectedItemIndexes.isNotEmpty &&
        selectedItemIndexes.length < widget.table.items.length;

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
      isEqualSplit: isEqualSplit,
      splitCount: splitCount,
      itemIndicesToPay: isEqualSplit ? null : List.from(selectedItemIndexes),
    );

    // Clear controllers
    _cashReceivedController.clear();
    _cardRefController.clear();

    if (isPartialEqual) {
      setState(() {
        splitCount -= 1;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: EmpireColors.successGreen,
          content: Text(
              'Pago parcial registrado con éxito. Quedan $splitCount partes por cobrar.'),
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
      // Full payment complete (either equal split final part, or last items, or full single ticket payment)
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      textStyle: const TextStyle(
        fontWeight: FontWeight.bold,
        fontSize: 14,
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
      height: 52,
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
                horizontal: 18,
                vertical: 20,
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
              fontSize: 26,
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
            spacing: 10,
            runSpacing: 10,
            children: [20, 50, 100, 200, 500]
                .map(
                  (amount) => SizedBox(
                    width: 108,
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
                const Text(
                  'Cambio a devolver',
                  style: TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
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
      constraints: const BoxConstraints(maxHeight: 140),
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

  Widget _buildLeftSummaryPanel(BuildContext context) {
    return Container(
      color: EmpireColors.onyxSurface,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Scrollable upper content
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Resumen de Pago',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 20),

                  // Amount Summary Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: EmpireColors.charcoalSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: EmpireColors.agedBronzeDark,
                        width: 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Subtotal
                        const Text(
                          'SUBTOTAL SUBCUENTA',
                          style: TextStyle(
                            color: EmpireColors.textSecondary,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '\$${currentSubtotal.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),

                        if (selectedDiscount > 0) ...[
                          const SizedBox(height: 12),
                          Text(
                            'DESCUENTO (${selectedDiscount.toInt()}%)',
                            style: const TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '-\$${discountAmount.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: EmpireColors.errorRed,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],

                        const SizedBox(height: 12),
                        const Text(
                          'IVA (16%)',
                          style: TextStyle(
                            color: EmpireColors.textSecondary,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '\$${currentTax.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),

                        const Divider(
                          color: EmpireColors.agedBronzeDark,
                          height: 24,
                        ),

                        const Text(
                          'TOTAL A COBRAR',
                          style: TextStyle(
                            color: EmpireColors.textGold,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                            letterSpacing: 0.8,
                          ),
                        ),
                        const SizedBox(height: 4),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            '\$${currentTotal.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: EmpireColors.champagneGold,
                              fontWeight: FontWeight.bold,
                              fontSize: 20,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Payment method details summary
                  if (selectedPaymentMethod == 'Efectivo') ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: EmpireColors.charcoalSurface.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: EmpireColors.agedBronzeDark.withOpacity(0.5),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'PAGO EN EFECTIVO',
                            style: TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Recibido',
                            style: TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 9,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '\$${(double.tryParse(_cashReceivedController.text) ?? 0.0).toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: EmpireColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Cambio',
                            style: TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 9,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '\$${cashChange.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: EmpireColors.successGreen,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ] else if (selectedPaymentMethod == 'Tarjeta' &&
                      _cardRefController.text.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: EmpireColors.charcoalSurface.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: EmpireColors.agedBronzeDark.withOpacity(0.5),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'PAGO CON TARJETA',
                            style: TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Referencia',
                            style: TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 9,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _cardRefController.text,
                            style: const TextStyle(
                              color: EmpireColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _processPayment,
            style: ElevatedButton.styleFrom(
              backgroundColor: EmpireColors.champagneGold,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                'PROCESAR COBRO',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
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
              IconButton(
                onPressed: widget.onCancel,
                icon: const Icon(
                  Icons.close,
                  color: EmpireColors.textSecondary,
                ),
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
                      onSelected: (val) => setState(() => isEqualSplit = true),
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
                      onSelected: (val) => setState(() => isEqualSplit = false),
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
                        if (splitCount > 1) {
                          setState(() => splitCount--);
                        }
                      },
                      icon: const Icon(
                        Icons.remove_circle_outline,
                        color: EmpireColors.champagneGold,
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
                        setState(() => splitCount++);
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

              const SizedBox(height: 24),

              // Discounts Segment
              const Text(
                'Aplicar Descuento Especial:',
                style: TextStyle(
                  color: EmpireColors.textGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                children: discounts.map((disc) {
                  final isSelected = selectedDiscount == disc;
                  return ChoiceChip(
                    label: Text(
                      disc == 0.0 ? 'Sin Descuento' : '${disc.toInt()}%',
                    ),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => selectedDiscount = disc);
                      }
                    },
                    selectedColor: EmpireColors.champagneGold.withOpacity(0.2),
                    backgroundColor: EmpireColors.charcoalSurface,
                    labelStyle: TextStyle(
                      color: isSelected
                          ? EmpireColors.champagneGold
                          : EmpireColors.textPrimary,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 12,
                    ),
                    side: BorderSide(
                      color: isSelected
                          ? EmpireColors.champagneGold
                          : EmpireColors.agedBronzeDark,
                      width: 1,
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 24),

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

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left Summary Panel (flex: 6) - replaces ShiftControlPanel (Turno de caja)
        Expanded(
          flex: 6,
          child: Container(
            decoration: const BoxDecoration(
              color: EmpireColors.onyxSurface,
              border: Border(
                right: BorderSide(
                  color: EmpireColors.agedBronzeDark,
                  width: 1.5,
                ),
              ),
            ),
            child: _buildLeftSummaryPanel(context),
          ),
        ),

        // Right Checkout Panel (flex: 18) - the main content of Pagar Cuenta
        Expanded(
          flex: 18,
          child: Container(
            color: EmpireColors.onyxSurface,
            child: _buildRightCheckoutPanel(context),
          ),
        ),
      ],
    );
  }
}
