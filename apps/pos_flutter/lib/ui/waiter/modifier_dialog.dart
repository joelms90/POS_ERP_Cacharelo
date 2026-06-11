import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class ModifierDialog extends StatefulWidget {
  final MenuItem item;
  final OrderItem? existingOrderItem;
  final List<String> guestGenders;
  final int initialSelectedGuestIndex;

  const ModifierDialog({
    super.key,
    required this.item,
    this.existingOrderItem,
    required this.guestGenders,
    required this.initialSelectedGuestIndex,
  });

  @override
  State<ModifierDialog> createState() => _ModifierDialogState();
}

class _ModifierDialogState extends State<ModifierDialog> {
  int quantity = 1;
  List<String> selectedModifiers = [];
  final TextEditingController _notesController = TextEditingController();
  int selectedGuestIndex = 0;

  // Predefined modifiers list based on category
  final Map<String, List<String>> _availableModifiers = {
    'Pastas': [
      'Queso Extra',
      'Salsa de Ajo',
      'Pan con Ajo Adicional',
      'Champiñones Extra',
    ],
    'Hamburguesas': [
      'Papas Fritas',
      'Tocino Extra',
      'Queso Cheddar',
      'Término Medio',
      'Bien Cocido',
      'Sin Cebolla',
    ],
    'Postres': [
      'Helado de Vainilla',
      'Fresa Adicional',
      'Crema Batida',
      'Salsa de Chocolate',
    ],
    'Bebidas': ['Hielo', 'Sin Azúcar', 'Limón Extra', 'Endulzante'],
  };

  @override
  void initState() {
    super.initState();
    if (widget.existingOrderItem != null) {
      quantity = widget.existingOrderItem!.quantity;
      selectedModifiers = List.from(widget.existingOrderItem!.modifiers);
      _notesController.text = widget.existingOrderItem!.notes;
      if (widget.existingOrderItem!.assignedGuest != null) {
        final label = widget.existingOrderItem!.assignedGuest!;
        final match = RegExp(r'P(\d+)').firstMatch(label);
        if (match != null) {
          selectedGuestIndex = int.parse(match.group(1)!) - 1;
        }
      }
    } else {
      selectedGuestIndex = widget.initialSelectedGuestIndex;
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final modifiers =
        _availableModifiers[widget.item.category] ??
        ['Extra Queso', 'Picante', 'Sin Sal'];
    final basePrice = widget.item.price;
    final totalPrice =
        (basePrice + (selectedModifiers.length * 1.5)) * quantity;

    return Dialog(
      backgroundColor: EmpireColors.obsidian,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
      ),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480, maxHeight: 600),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.item.name,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Precio base: \$${basePrice.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(
                    Icons.close,
                    color: EmpireColors.textSecondary,
                  ),
                ),
              ],
            ),
            const Divider(color: EmpireColors.agedBronzeDark, height: 24),

            // Modifier options scroll list
            Expanded(
              child: ListView(
                shrinkWrap: true,
                children: [
                  // Quantity Selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Cantidad',
                        style: TextStyle(
                          color: EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Row(
                        children: [
                          IconButton(
                            onPressed: () {
                              if (quantity > 1) {
                                setState(() => quantity--);
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
                              '$quantity',
                              style: const TextStyle(
                                color: EmpireColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: () {
                              setState(() => quantity++);
                            },
                            icon: const Icon(
                              Icons.add_circle_outline,
                              color: EmpireColors.champagneGold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Modifiers List Title
                  const Text(
                    'Modificadores (+\$1.50 c/u)',
                    style: TextStyle(
                      color: EmpireColors.textGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Modifiers Checkbox list
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: modifiers.map((mod) {
                      final isSelected = selectedModifiers.contains(mod);
                      return ChoiceChip(
                        label: Text(mod),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              selectedModifiers.add(mod);
                            } else {
                              selectedModifiers.remove(mod);
                            }
                          });
                        },
                        selectedColor: EmpireColors.champagneGold.withOpacity(
                          0.2,
                        ),
                        backgroundColor: EmpireColors.charcoalSurface,
                        labelStyle: TextStyle(
                          color: isSelected
                              ? EmpireColors.champagneGold
                              : EmpireColors.textPrimary,
                          fontWeight: isSelected
                              ? FontWeight.bold
                              : FontWeight.normal,
                          fontSize: 12,
                        ),
                        side: BorderSide(
                          color: isSelected
                              ? EmpireColors.champagneGold
                              : EmpireColors.agedBronzeDark,
                          width: 1,
                        ),
                        checkmarkColor: EmpireColors.champagneGold,
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 20),

                  // Assigned Guest Selector
                  const Text(
                    'Asignar a Comensal',
                    style: TextStyle(
                      color: EmpireColors.textGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: List.generate(widget.guestGenders.length, (
                      index,
                    ) {
                      final gender = widget.guestGenders[index];
                      final isSelected = selectedGuestIndex == index;
                      final emoji = gender == 'F'
                          ? '👩'
                          : (gender == 'K' ? '🧒' : '👨');
                      return ChoiceChip(
                        label: Text('P${index + 1} $emoji'),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() => selectedGuestIndex = index);
                          }
                        },
                        selectedColor: EmpireColors.champagneGold.withOpacity(
                          0.2,
                        ),
                        backgroundColor: EmpireColors.charcoalSurface,
                        labelStyle: TextStyle(
                          color: isSelected
                              ? EmpireColors.champagneGold
                              : EmpireColors.textPrimary,
                          fontWeight: isSelected
                              ? FontWeight.bold
                              : FontWeight.normal,
                          fontSize: 12,
                        ),
                        side: BorderSide(
                          color: isSelected
                              ? EmpireColors.champagneGold
                              : EmpireColors.agedBronzeDark,
                          width: 1,
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 20),

                  // Kitchen Notes
                  const Text(
                    'Instrucciones de Cocina',
                    style: TextStyle(
                      color: EmpireColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notesController,
                    decoration: const InputDecoration(
                      hintText: 'Ej. Término medio, sin salsa...',
                      hintStyle: TextStyle(fontSize: 12),
                    ),
                    maxLines: 2,
                    style: const TextStyle(
                      fontSize: 13,
                      color: EmpireColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),

            const Divider(color: EmpireColors.agedBronzeDark, height: 24),

            // Footer / Totals and Confirmation
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'TOTAL DETALLADO',
                      style: TextStyle(
                        color: EmpireColors.textSecondary,
                        fontSize: 10,
                        letterSpacing: 0.8,
                      ),
                    ),
                    Text(
                      '\$${totalPrice.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                  ],
                ),
                ElevatedButton(
                  onPressed: () {
                    final orderItem = OrderItem(
                      item: widget.item,
                      quantity: quantity,
                      modifiers: List.from(selectedModifiers),
                      notes: _notesController.text,
                      assignedGuest: 'P${selectedGuestIndex + 1}',
                    );
                    Navigator.of(context).pop(orderItem);
                  },
                  child: const Text('AGREGAR ÍTEM'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
