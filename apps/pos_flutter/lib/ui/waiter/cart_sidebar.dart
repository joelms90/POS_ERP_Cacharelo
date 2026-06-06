import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class CartSidebar extends StatefulWidget {
  final TableModel table;
  final List<OrderItem> initialItems;
  final Function(List<OrderItem> finalItems, int guests) onConfirm;
  final VoidCallback onCancel;

  const CartSidebar({
    super.key,
    required this.table,
    required this.initialItems,
    required this.onConfirm,
    required this.onCancel,
  });

  @override
  State<CartSidebar> createState() => _CartSidebarState();
}

class _CartSidebarState extends State<CartSidebar> {
  late List<OrderItem> _cartItems;
  int _guests = 1;

  @override
  void initState() {
    super.initState();
    _cartItems = List.from(widget.initialItems);
    _guests = widget.table.guests > 0 ? widget.table.guests : 1;
  }

  @override
  void didUpdateWidget(covariant CartSidebar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialItems != oldWidget.initialItems) {
      setState(() {
        _cartItems = List.from(widget.initialItems);
      });
    }
  }

  double get subtotal => _cartItems.fold(0.0, (sum, i) => sum + i.totalPrice);
  double get tax => subtotal * 0.16; // 16% VAT
  double get total => subtotal + tax;

  void _incrementQuantity(int index) {
    setState(() {
      _cartItems[index].quantity++;
    });
  }

  void _decrementQuantity(int index) {
    setState(() {
      if (_cartItems[index].quantity > 1) {
        _cartItems[index].quantity--;
      } else {
        _cartItems.removeAt(index);
      }
    });
  }

  void _removeItem(int index) {
    setState(() {
      _cartItems.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: EmpireColors.onyxSurface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Cart Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Detalle de Comanda',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: EmpireColors.champagneGold.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: EmpireColors.champagneGold, width: 0.5),
                      ),
                      child: Text(
                        widget.table.label,
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Guests Stepper (Pax)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Número de Comensales (Pax):',
                      style: TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
                    ),
                    Row(
                      children: [
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () {
                            if (_guests > 1) {
                              setState(() => _guests--);
                            }
                          },
                          icon: const Icon(Icons.remove_circle_outline, color: EmpireColors.champagneGold, size: 22),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Text(
                            '$_guests',
                            style: const TextStyle(
                              color: EmpireColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () {
                            setState(() => _guests++);
                          },
                          icon: const Icon(Icons.add_circle_outline, color: EmpireColors.champagneGold, size: 22),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Cart List
          Expanded(
            child: _cartItems.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_basket_outlined, color: EmpireColors.textSecondary, size: 40),
                        SizedBox(height: 12),
                        Text(
                          'Comanda vacía\nSelecciona ítems del menú',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _cartItems.length,
                    itemBuilder: (context, index) {
                      final item = _cartItems[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: EmpireColors.charcoalSurface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                // Item details
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.item.name,
                                        style: const TextStyle(
                                          color: EmpireColors.textPrimary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      if (item.modifiers.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          'Agregados: ' + item.modifiers.join(', '),
                                          style: const TextStyle(
                                            color: EmpireColors.textGold,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                      if (item.notes.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          'Nota: ${item.notes}',
                                          style: const TextStyle(
                                            color: EmpireColors.textSecondary,
                                            fontSize: 11,
                                            fontStyle: FontStyle.italic,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),

                                // Subtotal per item
                                Text(
                                  '\$${item.totalPrice.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: EmpireColors.textPrimary,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                            const Divider(color: EmpireColors.agedBronzeDark, height: 16),
                            
                            // Bottom row: control steppers and remove button
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    IconButton(
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                      onPressed: () => _decrementQuantity(index),
                                      icon: const Icon(Icons.remove_circle_outlined, color: EmpireColors.textSecondary, size: 20),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 12),
                                      child: Text(
                                        '${item.quantity}',
                                        style: const TextStyle(
                                          color: EmpireColors.textPrimary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                      onPressed: () => _incrementQuantity(index),
                                      icon: const Icon(Icons.add_circle_outlined, color: EmpireColors.champagneGold, size: 20),
                                    ),
                                  ],
                                ),
                                IconButton(
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  onPressed: () => _removeItem(index),
                                  icon: const Icon(Icons.delete_outline, color: EmpireColors.errorRed, size: 20),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Total Panel
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
                    const Text('Subtotal', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
                    Text('\$${subtotal.toStringAsFixed(2)}', style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('IVA (16%)', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
                    Text('\$${tax.toStringAsFixed(2)}', style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13)),
                  ],
                ),
                const Divider(color: EmpireColors.agedBronzeDark, height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'TOTAL',
                      style: TextStyle(color: EmpireColors.textGold, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    Text(
                      '\$${total.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Confirmation Actions
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: widget.onCancel,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(color: EmpireColors.errorRed, width: 1.2),
                          foregroundColor: EmpireColors.errorRed,
                        ),
                        child: const Text('CANCELAR'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _cartItems.isEmpty
                            ? null
                            : () => widget.onConfirm(_cartItems, _guests),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          backgroundColor: EmpireColors.champagneGold,
                        ),
                        child: const Text('CONFIRMAR'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
