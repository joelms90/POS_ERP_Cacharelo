import 'package:flutter/material.dart';
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

  double get currentSubtotal {
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

  double get discountAmount => currentSubtotal * (selectedDiscount / 100.0);
  double get currentTax => (currentSubtotal - discountAmount) * 0.16; // 16% VAT
  double get currentTotal => (currentSubtotal - discountAmount) + currentTax;

  double get cashChange {
    final double cash = double.tryParse(_cashReceivedController.text) ?? 0.0;
    return cash > currentTotal ? cash - currentTotal : 0.0;
  }

  @override
  void dispose() {
    _cashReceivedController.dispose();
    _cardRefController.dispose();
    super.dispose();
  }

  void _processPayment() {
    final refCode = selectedPaymentMethod == 'Tarjeta' ? _cardRefController.text : 'Efectivo';
    
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
            content: Text('Efectivo recibido es menor que el total de la cuenta.'),
          ),
        );
        return;
      }
    }

    // Process the payment
    widget.state.checkoutTable(
      widget.table.id,
      discount: selectedDiscount,
      paymentMethod: selectedPaymentMethod,
      refCode: refCode,
    );

    widget.onSuccess();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: EmpireColors.onyxSurface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5)),
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
                      'Mesa: ${widget.table.label} • Total Original: \$${(widget.table.subtotal * 1.16).toStringAsFixed(2)}',
                      style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: widget.onCancel,
                  icon: const Icon(Icons.close, color: EmpireColors.textSecondary),
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
                        label: const Text('DIVISIÓN EQUITATIVA', textAlign: TextAlign.center),
                        selected: isEqualSplit,
                        onSelected: (val) => setState(() => isEqualSplit = true),
                        selectedColor: EmpireColors.champagneGold,
                        backgroundColor: EmpireColors.charcoalSurface,
                        labelStyle: TextStyle(
                          color: isEqualSplit ? EmpireColors.obsidian : EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('POR ARTÍCULOS', textAlign: TextAlign.center),
                        selected: !isEqualSplit,
                        onSelected: (val) => setState(() => isEqualSplit = false),
                        selectedColor: EmpireColors.champagneGold,
                        backgroundColor: EmpireColors.charcoalSurface,
                        labelStyle: TextStyle(
                          color: !isEqualSplit ? EmpireColors.obsidian : EmpireColors.textPrimary,
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
                    style: TextStyle(color: EmpireColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
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
                        icon: const Icon(Icons.remove_circle_outline, color: EmpireColors.champagneGold),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          '$splitCount',
                          style: const TextStyle(color: EmpireColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 20),
                        ),
                      ),
                      IconButton(
                        onPressed: () {
                          setState(() => splitCount++);
                        },
                        icon: const Icon(Icons.add_circle_outline, color: EmpireColors.champagneGold),
                      ),
                      const SizedBox(width: 20),
                      Text(
                        'Total original dividido en $splitCount partes.',
                        style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ] else ...[
                  const Text(
                    'Selecciona los artículos a cobrar en esta sub-cuenta:',
                    style: TextStyle(color: EmpireColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 180),
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
                        return CheckboxListTile(
                          value: isChecked,
                          title: Text(item.item.name, style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13)),
                          subtitle: Text('Cantidad: ${item.quantity}', style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 11)),
                          secondary: Text('\$${item.totalPrice.toStringAsFixed(2)}', style: const TextStyle(color: EmpireColors.textGold, fontSize: 13, fontWeight: FontWeight.bold)),
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
                        );
                      },
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                // Discounts Segment
                const Text(
                  'Aplicar Descuento Especial:',
                  style: TextStyle(color: EmpireColors.textGold, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  children: discounts.map((disc) {
                    final isSelected = selectedDiscount == disc;
                    return ChoiceChip(
                      label: Text(disc == 0.0 ? 'Sin Descuento' : '${disc.toInt()}%'),
                      selected: isSelected,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => selectedDiscount = disc);
                        }
                      },
                      selectedColor: EmpireColors.champagneGold.withOpacity(0.2),
                      backgroundColor: EmpireColors.charcoalSurface,
                      labelStyle: TextStyle(
                        color: isSelected ? EmpireColors.champagneGold : EmpireColors.textPrimary,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12,
                      ),
                      side: BorderSide(
                        color: isSelected ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
                        width: 1,
                      ),
                    );
                  }).toList(),
                ),

                const SizedBox(height: 24),

                // Payment Method
                const Text(
                  'Método de Pago:',
                  style: TextStyle(color: EmpireColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        avatar: const Icon(Icons.money, size: 16, color: EmpireColors.textPrimary),
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
                        avatar: const Icon(Icons.credit_card, size: 16, color: EmpireColors.textPrimary),
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

                const SizedBox(height: 20),

                // Payment inputs
                if (selectedPaymentMethod == 'Efectivo') ...[
                  TextField(
                    controller: _cashReceivedController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Monto Recibido',
                      prefixText: '\$ ',
                      hintText: '0.00',
                    ),
                    style: const TextStyle(color: EmpireColors.textPrimary),
                    onChanged: (val) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Cambio a devolver:', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
                      Text(
                        '\$${cashChange.toStringAsFixed(2)}',
                        style: const TextStyle(color: EmpireColors.successGreen, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  ),
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
                    style: TextStyle(color: EmpireColors.textSecondary, fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ],
              ],
            ),
          ),

          // Total & Checkout commit trigger
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: EmpireColors.charcoalSurface,
              border: Border(top: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Subtotal Subcuenta', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
                    Text('\$${currentSubtotal.toStringAsFixed(2)}', style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13)),
                  ],
                ),
                if (selectedDiscount > 0) ...[
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Descuento (${selectedDiscount.toInt()}%)', style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
                      Text('-\$${discountAmount.toStringAsFixed(2)}', style: const TextStyle(color: EmpireColors.errorRed, fontSize: 13)),
                    ],
                  ),
                ],
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('IVA (16%)', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
                    Text('\$${currentTax.toStringAsFixed(2)}', style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13)),
                  ],
                ),
                const Divider(color: EmpireColors.agedBronzeDark, height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'TOTAL A COBRAR',
                      style: TextStyle(color: EmpireColors.textGold, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    Text(
                      '\$${currentTotal.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _processPayment,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.champagneGold,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: Text('PROCESAR COBRO (\$${currentTotal.toStringAsFixed(2)})'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
