import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class CartSidebar extends StatefulWidget {
  final TableModel table;
  final List<OrderItem> initialItems;
  final List<String> activeGenders;
  final Future<bool> Function() onRemoveGuest;
  final VoidCallback? onBillingRequested;
  final VoidCallback onBackToMenu;
  final Function(List<OrderItem> finalItems, int guests) onConfirm;
  final VoidCallback onCancel;

  const CartSidebar({
    super.key,
    required this.table,
    required this.initialItems,
    required this.activeGenders,
    required this.onRemoveGuest,
    this.onBillingRequested,
    required this.onBackToMenu,
    required this.onConfirm,
    required this.onCancel,
  });

  @override
  State<CartSidebar> createState() => _CartSidebarState();
}

class _CartSidebarState extends State<CartSidebar> {
  late List<OrderItem> _cartItems;
  int _guests = 1;

  Widget _buildGuestBadge(String guestLabel) {
    final match = RegExp(r'P(\d+)').firstMatch(guestLabel);
    String emoji = '👨';
    if (match != null) {
      final index = int.parse(match.group(1)!) - 1;
      if (index >= 0 && index < widget.activeGenders.length) {
        final gender = widget.activeGenders[index];
        emoji = gender == 'F' ? '👩' : (gender == 'K' ? '🧒' : '👨');
      }
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: EmpireColors.champagneGold.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: EmpireColors.champagneGold.withOpacity(0.4),
          width: 1,
        ),
      ),
      child: Text(
        '$guestLabel $emoji',
        style: const TextStyle(
          color: EmpireColors.champagneGold,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _cartItems = List.from(widget.initialItems);
    _guests = widget.activeGenders.length;
  }

  @override
  void didUpdateWidget(covariant CartSidebar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialItems != oldWidget.initialItems) {
      setState(() {
        _cartItems = List.from(widget.initialItems);
      });
    }
    if (widget.activeGenders.length != oldWidget.activeGenders.length) {
      setState(() {
        _guests = widget.activeGenders.length;
      });
    }
  }

  double get subtotal => _cartItems.fold(0.0, (sum, i) => sum + i.totalPrice);
  double get tax => subtotal * 0.16; // 16% VAT
  double get total => subtotal + tax;

  void _incrementQuantity(int index) {
    setState(() {
      if (_cartItems[index].isSent) {
        final targetGuest = _cartItems[index].assignedGuest;
        final targetItemId = _cartItems[index].item.id;
        final unsentIdx = _cartItems.indexWhere(
          (i) =>
              i.item.id == targetItemId &&
              i.assignedGuest == targetGuest &&
              !i.isSent,
        );
        if (unsentIdx != -1) {
          _cartItems[unsentIdx].quantity++;
        } else {
          _cartItems.add(
            _cartItems[index].copyWith(quantity: 1, isSent: false),
          );
        }
      } else {
        _cartItems[index].quantity++;
      }
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

  void _showConfirmOrderDialog() async {
    final newDishesCount = _cartItems
        .where((i) => !i.isSent)
        .fold<int>(0, (sum, i) => sum + i.quantity);

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: EmpireColors.obsidian,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
        ),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.send_rounded,
                    color: EmpireColors.champagneGold,
                    size: 24,
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Confirmar Envío',
                      style: TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                'Vas a enviar $newDishesCount ${newDishesCount == 1 ? 'platillo' : 'platillos'} a cocina/barra.\n¿Deseas confirmar el envío?',
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(
                          color: EmpireColors.textSecondary,
                        ),
                        foregroundColor: EmpireColors.textPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('CANCELAR'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: EmpireColors.champagneGold,
                        foregroundColor: EmpireColors.obsidian,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('ENVIAR COMANDA'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm == true) {
      widget.onConfirm(_cartItems, _guests);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: EmpireColors.obsidian,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Left Pane: Items List
          Expanded(flex: 3, child: _buildItemsPane()),

          // Right Pane: Summary & Actions
          Expanded(
            flex: 2,
            child: Container(
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: EmpireColors.agedBronzeDark,
                    width: 1.5,
                  ),
                ),
              ),
              child: _buildSummaryPane(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemsPane() {
    if (_cartItems.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.shopping_basket_outlined,
              color: EmpireColors.textSecondary,
              size: 48,
            ),
            SizedBox(height: 16),
            Text(
              'Comanda vacía\nAgrega platillos desde el menú',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: EmpireColors.textSecondary,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(24),
      itemCount: _cartItems.length,
      itemBuilder: (context, index) {
        final item = _cartItems[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: EmpireColors.charcoalSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: EmpireColors.agedBronzeDark, width: 1.2),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Quantity controls & display
              Row(
                children: [
                  IconButton(
                    onPressed: item.isSent
                        ? null
                        : () => _decrementQuantity(index),
                    icon: Icon(
                      Icons.remove_circle_outlined,
                      color: item.isSent
                          ? EmpireColors.textSecondary.withOpacity(0.3)
                          : EmpireColors.textSecondary,
                      size: 24,
                    ),
                  ),
                  Container(
                    constraints: const BoxConstraints(minWidth: 32),
                    alignment: Alignment.center,
                    child: Text(
                      '${item.quantity}',
                      style: const TextStyle(
                        color: EmpireColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => _incrementQuantity(index),
                    icon: const Icon(
                      Icons.add_circle_outlined,
                      color: EmpireColors.champagneGold,
                      size: 24,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 16),

              // Details
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
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        if (item.assignedGuest != null) ...[
                          const SizedBox(width: 8),
                          _buildGuestBadge(item.assignedGuest!),
                        ],
                      ],
                    ),
                    if (item.modifiers.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Agregados: ' + item.modifiers.join(', '),
                        style: const TextStyle(
                          color: EmpireColors.textGold,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    if (item.notes.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Nota: ${item.notes}',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 12,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 16),

              // Price & Delete
              Row(
                children: [
                  Text(
                    '\$${item.totalPrice.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: EmpireColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(width: 16),
                  IconButton(
                    onPressed: () => _removeItem(index),
                    icon: const Icon(
                      Icons.delete_outline,
                      color: EmpireColors.errorRed,
                      size: 22,
                    ),
                    tooltip: 'Eliminar artículo',
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSummaryPane() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Guests (Pax) selector
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: EmpireColors.charcoalSurface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Número de Comensales (Pax)',
                  style: TextStyle(
                    color: EmpireColors.textSecondary,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          Icons.people_outline,
                          color: EmpireColors.champagneGold,
                          size: 20,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Comensales:',
                          style: TextStyle(
                            color: EmpireColors.textPrimary,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: () async {
                            if (_guests > 1) {
                              final success = await widget.onRemoveGuest();
                              if (success) {
                                setState(() {
                                  _guests = widget.activeGenders.length;
                                  _cartItems = List.from(widget.initialItems);
                                });
                              }
                            }
                          },
                          icon: const Icon(
                            Icons.remove_circle_outline,
                            color: EmpireColors.champagneGold,
                            size: 24,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            '$_guests',
                            style: const TextStyle(
                              color: EmpireColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () {
                            setState(() {
                              _guests++;
                              widget.activeGenders.add('M');
                            });
                          },
                          icon: const Icon(
                            Icons.add_circle_outline,
                            color: EmpireColors.champagneGold,
                            size: 24,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Spacer(),

          // Totals Box
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: EmpireColors.charcoalSurface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Subtotal',
                      style: TextStyle(
                        color: EmpireColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      '\$${subtotal.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.textPrimary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'IVA (16%)',
                      style: TextStyle(
                        color: EmpireColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      '\$${tax.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.textPrimary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const Divider(color: EmpireColors.agedBronzeDark, height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'TOTAL DE COMANDA',
                      style: TextStyle(
                        color: EmpireColors.textGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      '\$${total.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          if (widget.table.state == TableState.occupied &&
              widget.onBillingRequested != null) ...[
            ElevatedButton.icon(
              onPressed: widget.onBillingRequested,
              icon: const Icon(
                Icons.receipt_long,
                color: EmpireColors.obsidian,
              ),
              label: const Text(
                'COBRAR CUENTA',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: EmpireColors.textGold,
                foregroundColor: EmpireColors.obsidian,
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Actions
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.onCancel,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(
                      color: EmpireColors.errorRed,
                      width: 1.2,
                    ),
                    foregroundColor: EmpireColors.errorRed,
                  ),
                  child: const Text(
                    'CANCELAR',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton(
                  onPressed:
                      (_cartItems.isEmpty || !_cartItems.any((i) => !i.isSent))
                      ? null
                      : _showConfirmOrderDialog,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: EmpireColors.champagneGold,
                    foregroundColor: EmpireColors.obsidian,
                  ),
                  child: const Text(
                    'CONFIRMAR PEDIDO',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
