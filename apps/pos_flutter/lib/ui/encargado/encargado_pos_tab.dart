import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../widgets/menu_card.dart';

class EncargadoPosTab extends StatefulWidget {
  final AppState state;
  final bool showPrepararButton;

  const EncargadoPosTab({
    super.key,
    required this.state,
    this.showPrepararButton = true,
  });

  @override
  State<EncargadoPosTab> createState() => _EncargadoPosTabState();
}

class _EncargadoPosTabState extends State<EncargadoPosTab> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  String _selectedCategory = '';
  String _searchQuery = '';
  List<CartEntry> _cart = [];
  int? _editingTableId;

  @override
  void initState() {
    super.initState();
    widget.state.addListener(_onStateChanged);
    final editingId = widget.state.editingOrderTableId;
    if (editingId != null) {
      _loadOrderIntoCart(editingId);
    }
  }

  @override
  void dispose() {
    widget.state.removeListener(_onStateChanged);
    _searchController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _onStateChanged() {
    final editingId = widget.state.editingOrderTableId;
    if (editingId == _editingTableId) return;
    if (editingId == null) {
      if (mounted) setState(() => _editingTableId = null);
      return;
    }
    _loadOrderIntoCart(editingId);
  }

  void _loadOrderIntoCart(int tableId) {
    final index = widget.state.tables.indexWhere((t) => t.id == tableId);
    if (index == -1) return;
    final table = widget.state.tables[index];
    final entries = table.items
        .map((orderItem) => CartEntry(
              item: orderItem.item,
              quantity: orderItem.quantity,
              isSent: true,
              notes: orderItem.notes,
              clientUuid: orderItem.clientUuid,
              remoteId: orderItem.remoteId,
            ))
        .toList();
    if (!mounted) return;
    setState(() {
      _editingTableId = tableId;
      _cart = entries;
      _notesController.clear();
    });
  }

  List<OrderItem> _buildOrderItems() {
    final defaultNotes = _notesController.text.trim();
    return _cart
        .map((entry) => OrderItem(
              item: entry.item,
              quantity: entry.quantity,
              notes: entry.notes.isNotEmpty ? entry.notes : defaultNotes,
              isSent: entry.isSent,
              clientUuid: entry.clientUuid,
              remoteId: entry.remoteId,
            ))
        .toList();
  }

  List<String> get _categories {
    final cats = AppState.menu.map((m) => m.category).toSet().toList();
    cats.sort();
    return cats;
  }

  List<MenuItem> get _filteredMenu {
    var items = AppState.menu.toList();
    if (_searchQuery.isNotEmpty) {
      items = items
          .where((i) =>
              i.name.toLowerCase().contains(_searchQuery.toLowerCase()))
          .toList();
    } else if (_selectedCategory.isNotEmpty) {
      items = items.where((i) => i.category == _selectedCategory).toList();
    }
    items.sort((a, b) => a.name.compareTo(b.name));
    return items;
  }

  double get _cartTotal {
    return _cart.fold<double>(
      0,
      (sum, entry) => sum + entry.item.price * entry.quantity,
    );
  }

  void _addToCart(MenuItem item) {
    setState(() {
      final existing = _cart.indexWhere((e) => e.item.id == item.id);
      if (existing != -1) {
        _cart[existing].quantity++;
      } else {
        _cart.add(CartEntry(item: item, quantity: 1));
      }
    });
  }

  void _incrementItem(int index) {
    setState(() => _cart[index].quantity++);
  }

  void _decrementItem(int index) {
    setState(() {
      if (_cart[index].quantity > 1) {
        _cart[index].quantity--;
      } else {
        _cart.removeAt(index);
      }
    });
  }

  void _setItemQuantity(int index, int quantity) {
    if (quantity <= 0) {
      setState(() => _cart.removeAt(index));
    } else {
      setState(() => _cart[index].quantity = quantity);
    }
  }

  Future<void> _showQuantityDialog(int index) async {
    final entry = _cart[index];
    final controller = TextEditingController(text: entry.quantity.toString());
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: EmpireColors.onyxSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
        ),
        title: Text(
          entry.item.name,
          style: const TextStyle(color: EmpireColors.textGold, fontSize: 16),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Cantidad:', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 24, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                filled: true,
                fillColor: EmpireColors.charcoalSurface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: EmpireColors.champagneGold),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: EmpireColors.champagneGold, width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              onSubmitted: (val) => Navigator.pop(ctx, val),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: EmpireColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            style: ElevatedButton.styleFrom(
              backgroundColor: EmpireColors.champagneGold,
              foregroundColor: EmpireColors.obsidian,
            ),
            child: const Text('Aceptar'),
          ),
        ],
      ),
    );

    controller.dispose();
    if (result != null && mounted) {
      final qty = int.tryParse(result);
      if (qty != null) {
        _setItemQuantity(index, qty);
      }
    }
  }

  void _clearCart() {
    widget.state.clearEditingOrder();
    setState(() {
      _cart = [];
      _editingTableId = null;
      _notesController.clear();
    });
  }

  Future<void> _handleCharging() async {
    if (_cart.isEmpty) return;

    final editingId = _editingTableId;
    TableModel? table;

    if (editingId != null) {
      final index = widget.state.tables.indexWhere((t) => t.id == editingId);
      if (index == -1) return;
      table = widget.state.tables[index];
      // Persist any newly added items before charging the parked order.
      await widget.state.submitOrder(
        table.id,
        _buildOrderItems(),
        1,
        ['M'],
        printComanda: true,
      );
    } else {
      table = await widget.state.startToGoOrder();
      if (table == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: EmpireColors.errorRed,
              content: Text('No se pudo crear la orden'),
            ),
          );
        }
        return;
      }
      final orderItems = _buildOrderItems()
          .map((item) => item.copyWith(isSent: true))
          .toList();
      await widget.state.submitOrder(
        table.id,
        orderItems,
        1,
        ['M'],
        printComanda: false,
      );
    }

    if (mounted) {
      await _showPaymentFlow(table);
    }
  }

  Future<void> _showPaymentFlow(TableModel table) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (context) => _EncargadoPaymentScreen(
          table: table,
          state: widget.state,
        ),
      ),
    );

    if (result == true && mounted) {
      _clearCart();
    }
  }

  /// Parks the current cart as an active to-go order without charging it,
  /// so the operator can take more orders and charge them later from the
  /// Órdenes tab. A kitchen comanda is sent at this point.
  Future<void> _handleSaveOrder() async {
    if (_cart.isEmpty) return;

    final editingId = _editingTableId;
    int tableId;
    String label;

    if (editingId != null) {
      final index = widget.state.tables.indexWhere((t) => t.id == editingId);
      if (index == -1) return;
      tableId = editingId;
      label = widget.state.tables[index].label;
    } else {
      final table = await widget.state.startToGoOrder();
      if (table == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: EmpireColors.errorRed,
              content: Text('No se pudo crear la orden'),
            ),
          );
        }
        return;
      }
      tableId = table.id;
      label = table.label;
    }

    final hasNewItems = _cart.any((entry) => !entry.isSent);
    final saved = await widget.state.submitOrder(
      tableId,
      _buildOrderItems(),
      1,
      ['M'],
      printComanda: true,
    );

    if (!mounted) return;
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: EmpireColors.errorRed,
          content: Text('No se pudo guardar la orden. Intenta de nuevo.'),
        ),
      );
      return;
    }

    _clearCart();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: EmpireColors.successGreen,
        content: Text(hasNewItems
            ? 'Orden $label guardada y enviada a cocina'
            : 'Orden $label actualizada'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(flex: 6, child: _buildCatalogPanel()),
        Container(width: 2, color: EmpireColors.agedBronzeDark),
        Expanded(flex: 4, child: _buildCartPanel()),
      ],
    );
  }

  Widget _buildCatalogPanel() {
    return Column(
      children: [
        _buildSearchBar(),
        _buildCategoryChips(),
        Expanded(child: _buildProductGrid()),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
      color: EmpireColors.onyxSurface,
      child: TextField(
        controller: _searchController,
        onChanged: (val) => setState(() => _searchQuery = val),
        style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Buscar producto...',
          hintStyle: const TextStyle(color: EmpireColors.textSecondary, fontSize: 14),
          prefixIcon: const Icon(Icons.search, color: EmpireColors.textSecondary, size: 20),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, color: EmpireColors.textSecondary, size: 18),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          filled: true,
          fillColor: EmpireColors.charcoalSurface,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: EmpireColors.agedBronzeDark),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: EmpireColors.agedBronzeDark),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: EmpireColors.champagneGold, width: 2),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    final categories = _categories;
    if (categories.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      color: EmpireColors.onyxSurface,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildCategoryChip('Todo', _selectedCategory.isEmpty),
            ...categories.map((cat) => _buildCategoryChip(cat, _selectedCategory == cat)),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryChip(String label, bool isSelected) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) {
          setState(() {
            _selectedCategory = label == 'Todo' ? '' : label;
          });
        },
        selectedColor: EmpireColors.champagneGold,
        backgroundColor: EmpireColors.charcoalSurface,
        labelStyle: TextStyle(
          color: isSelected ? EmpireColors.obsidian : EmpireColors.textPrimary,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
        side: BorderSide(
          color: isSelected ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  Widget _buildProductGrid() {
    final items = _filteredMenu;

    return Container(
      color: EmpireColors.obsidian,
      child: items.isEmpty
          ? const Center(
              child: Text(
                'No se encontraron productos',
                style: TextStyle(color: EmpireColors.textSecondary),
              ),
            )
          : GridView.builder(
              padding: const EdgeInsets.all(10),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 8,
                childAspectRatio: 2.2,
              ),
              itemCount: items.length,
              itemBuilder: (context, index) {
                return MenuCard(
                  item: items[index],
                  onTap: () => _addToCart(items[index]),
                );
              },
            ),
    );
  }

  Widget _buildCartPanel() {
    return Container(
      color: EmpireColors.onyxSurface,
      child: Column(
        children: [
          _buildCartHeader(),
          _buildEditingBanner(),
          Expanded(child: _buildCartItemList()),
          if (_cart.isNotEmpty) _buildCartFooter(),
        ],
      ),
    );
  }

  Widget _buildCartHeader() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.shopping_cart, color: EmpireColors.champagneGold, size: 20),
          const SizedBox(width: 8),
          Text(
            'Pedido Actual (${_cart.fold<int>(0, (s, e) => s + e.quantity)} items)',
            style: const TextStyle(
              color: EmpireColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          const Spacer(),
          if (_cart.isNotEmpty)
            TextButton.icon(
              onPressed: _clearCart,
              icon: const Icon(Icons.delete_outline, size: 16),
              label: const Text('Vaciar', style: TextStyle(fontSize: 12)),
              style: TextButton.styleFrom(
                foregroundColor: EmpireColors.errorRed,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                visualDensity: VisualDensity.compact,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEditingBanner() {
    if (_editingTableId == null) return const SizedBox.shrink();
    final table = widget.state.editingOrder;
    final label = table?.label ?? 'orden';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: EmpireColors.champagneGold.withValues(alpha: 0.12),
        border: const Border(
          bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.edit, color: EmpireColors.champagneGold, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Editando $label · agrega productos y guarda o cobra',
              style: const TextStyle(
                color: EmpireColors.champagneGold,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
          TextButton(
            onPressed: _clearCart,
            style: TextButton.styleFrom(
              foregroundColor: EmpireColors.textSecondary,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              visualDensity: VisualDensity.compact,
            ),
            child: const Text('Salir', style: TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _buildCartItemList() {
    if (_cart.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.touch_app, color: EmpireColors.textSecondary, size: 40),
            SizedBox(height: 12),
            Text(
              'Toca los productos para\nagregarlos al pedido',
              textAlign: TextAlign.center,
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      itemCount: _cart.length,
      separatorBuilder: (_, __) => const Divider(height: 1, color: EmpireColors.agedBronzeDark),
      itemBuilder: (context, index) {
        final entry = _cart[index];
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Row(
            children: [
              GestureDetector(
                onTap: () => _showQuantityDialog(index),
                child: Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: EmpireColors.charcoalSurface,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: EmpireColors.agedBronzeDark),
                  ),
                  child: Text(
                    '${entry.quantity}x',
                    style: const TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  entry.item.name,
                  style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '\$${(entry.item.price * entry.quantity).toStringAsFixed(2)}',
                style: const TextStyle(
                  color: EmpireColors.textGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 6),
              _buildQuantityControl(index),
            ],
          ),
        );
      },
    );
  }

  Widget _buildQuantityControl(int index) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildSmallButton(Icons.remove, () => _decrementItem(index)),
        const SizedBox(width: 4),
        _buildSmallButton(Icons.add, () => _incrementItem(index)),
      ],
    );
  }

  Widget _buildSmallButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: EmpireColors.charcoalSurface,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: EmpireColors.agedBronzeDark),
        ),
        child: Icon(icon, size: 14, color: EmpireColors.textPrimary),
      ),
    );
  }

  Widget _buildCartFooter() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: EmpireColors.champagneGold, width: 1.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('TOTAL:', style: TextStyle(
                color: EmpireColors.textSecondary,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              )),
              Text(
                '\$${_cartTotal.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: EmpireColors.champagneGold,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _notesController,
            style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Notas de preparación...',
              hintStyle: const TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
              filled: true,
              fillColor: EmpireColors.charcoalSurface,
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: EmpireColors.agedBronzeDark),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: EmpireColors.agedBronzeDark),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: EmpireColors.champagneGold, width: 1.5),
              ),
            ),
            maxLines: 1,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _handleCharging,
                  icon: const Icon(Icons.payment, size: 18),
                  label: const Text('Cobrar', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.successGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              if (widget.showPrepararButton) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _handleSaveOrder,
                    icon: const Icon(Icons.save, size: 18),
                    label: const Text('GUARDAR ORDEN',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: EmpireColors.champagneGold,
                      foregroundColor: EmpireColors.obsidian,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class CartEntry {
  final MenuItem item;
  int quantity;
  bool isSent;
  String notes;
  String? clientUuid;
  String? remoteId;

  CartEntry({
    required this.item,
    this.quantity = 1,
    this.isSent = false,
    this.notes = '',
    this.clientUuid,
    this.remoteId,
  });
}

class _EncargadoPaymentScreen extends StatefulWidget {
  final TableModel table;
  final AppState state;

  const _EncargadoPaymentScreen({
    required this.table,
    required this.state,
  });

  @override
  State<_EncargadoPaymentScreen> createState() => _EncargadoPaymentScreenState();
}

class _EncargadoPaymentScreenState extends State<_EncargadoPaymentScreen> {
  String _paymentMethod = 'Efectivo';
  final _cashController = TextEditingController();
  final _cardRefController = TextEditingController();
  double _discount = 0;
  bool _processing = false;

  @override
  void dispose() {
    _cashController.dispose();
    _cardRefController.dispose();
    super.dispose();
  }

  double get _discountAmount => double.parse(
      (widget.table.subtotal * (_discount / 100.0)).toStringAsFixed(2));

  double get _total =>
      double.parse((widget.table.subtotal - _discountAmount).toStringAsFixed(2));

  void _processPayment() {
    if (_processing) return;

    if (_paymentMethod == 'Efectivo') {
      final cash = double.tryParse(_cashController.text) ?? 0;
      if (cash < _total) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: EmpireColors.errorRed,
            content: Text('El efectivo recibido es menor que el total'),
          ),
        );
        return;
      }
    } else {
      if (_cardRefController.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: EmpireColors.errorRed,
            content: Text('Ingresa la referencia bancaria'),
          ),
        );
        return;
      }
    }

    setState(() => _processing = true);

    final cashReceived = _paymentMethod == 'Efectivo'
        ? double.tryParse(_cashController.text)
        : null;
    final cashChange = cashReceived != null ? cashReceived - _total : null;
    final refCode = _paymentMethod == 'Tarjeta'
        ? _cardRefController.text.trim()
        : 'Efectivo';

    widget.state.checkoutTable(
      widget.table.id,
      discount: _discount,
      paymentMethod: _paymentMethod,
      refCode: refCode,
      cashReceived: cashReceived,
      cashChange: cashChange,
    );

    if (mounted) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      appBar: AppBar(
        backgroundColor: EmpireColors.obsidian,
        title: const Text('Cobrar', style: TextStyle(color: EmpireColors.champagneGold)),
        leading: IconButton(
          icon: const Icon(Icons.close, color: EmpireColors.textSecondary),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: EmpireColors.onyxSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: EmpireColors.agedBronzeDark),
              ),
              child: Column(
                children: [
                  _buildInfoRow('Orden', widget.table.label),
                  const SizedBox(height: 8),
                  _buildInfoRow('Total', '\$${_total.toStringAsFixed(2)}'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildItemsSummary(),
            const SizedBox(height: 16),
            _buildDiscountRow(),
            const SizedBox(height: 20),
            const Text(
              'Método de Pago:',
              style: TextStyle(color: EmpireColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.money, size: 16),
                        SizedBox(width: 8),
                        Text('EFECTIVO', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                    selected: _paymentMethod == 'Efectivo',
                    onSelected: (_) => setState(() => _paymentMethod = 'Efectivo'),
                    selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
                    backgroundColor: EmpireColors.charcoalSurface,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ChoiceChip(
                    label: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.credit_card, size: 16),
                        SizedBox(width: 8),
                        Text('TARJETA', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                    selected: _paymentMethod == 'Tarjeta',
                    onSelected: (_) => setState(() => _paymentMethod = 'Tarjeta'),
                    selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
                    backgroundColor: EmpireColors.charcoalSurface,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_paymentMethod == 'Efectivo')
              _buildCashInput()
            else
              _buildCardInput(),
            if (_paymentMethod == 'Efectivo') ...[
              Builder(builder: (context) {
                final cashReceived = double.tryParse(_cashController.text) ?? 0;
                final change = cashReceived - _total;
                if (change > 0) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: EmpireColors.successGreen.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: EmpireColors.successGreen.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Cambio:', style: TextStyle(
                            color: EmpireColors.successGreen,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          )),
                          Text(
                            '\$${change.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: EmpireColors.successGreen,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return const SizedBox.shrink();
              }),
              const SizedBox(height: 12),
              Row(
                children: [20, 50, 100, 200, 500].map((amount) {
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: OutlinedButton(
                        onPressed: () => _addCashReceived(amount.toDouble()),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: EmpireColors.champagneGold,
                          side: const BorderSide(color: EmpireColors.agedBronzeDark),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        child: Text('+\$$amount', style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _processing ? null : _processPayment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: EmpireColors.champagneGold,
                  foregroundColor: EmpireColors.obsidian,
                ),
                child: _processing
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('COBRAR', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _addCashReceived(double amount) {
    final current = double.tryParse(_cashController.text) ?? 0;
    _cashController.text = (current + amount).toStringAsFixed(2);
    FocusScope.of(context).unfocus();
    setState(() {});
  }

  Widget _buildItemsSummary() {
    final items = widget.table.items;
    final totalUnits = items.fold<int>(0, (sum, i) => sum + i.quantity);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.receipt_long,
                  color: EmpireColors.champagneGold, size: 16),
              const SizedBox(width: 8),
              Text(
                'Productos ($totalUnits)',
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (items.isEmpty)
            const Text(
              'Sin productos en la orden',
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
            )
          else
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 30,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 4, vertical: 2),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: EmpireColors.charcoalSurface,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: EmpireColors.agedBronzeDark),
                      ),
                      child: Text(
                        '${item.quantity}x',
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.item.name,
                            style: const TextStyle(
                                color: EmpireColors.textPrimary, fontSize: 13),
                          ),
                          if (item.modifiers.isNotEmpty)
                            Text(
                              item.modifiers.join(', '),
                              style: const TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 11),
                            ),
                          if (item.notes.isNotEmpty)
                            Text(
                              item.notes,
                              style: const TextStyle(
                                color: EmpireColors.textSecondary,
                                fontSize: 11,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '\$${item.totalPrice.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.textGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const Divider(height: 18, color: EmpireColors.agedBronzeDark),
          _buildInfoRow(
              'Subtotal', '\$${widget.table.subtotal.toStringAsFixed(2)}'),
          if (_discount > 0) ...[
            const SizedBox(height: 6),
            _buildInfoRow(
              'Descuento (${_discount.toStringAsFixed(0)}%)',
              '-\$${_discountAmount.toStringAsFixed(2)}',
            ),
          ],
          const SizedBox(height: 6),
          _buildInfoRow('Total a pagar', '\$${_total.toStringAsFixed(2)}'),
        ],
      ),
    );
  }

  Widget _buildDiscountRow() {
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
                value: _discount,
                isExpanded: true,
                isDense: true,
                dropdownColor: EmpireColors.charcoalSurface,
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
                items: const [
                  DropdownMenuItem(value: 0.0, child: Text('Sin Descuento')),
                  DropdownMenuItem(value: 5.0, child: Text('5%')),
                  DropdownMenuItem(value: 10.0, child: Text('10%')),
                  DropdownMenuItem(value: 15.0, child: Text('15%')),
                  DropdownMenuItem(value: 20.0, child: Text('20%')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _discount = val);
                },
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCashInput() {
    return TextField(
      controller: _cashController,
      autofocus: true,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 20, fontWeight: FontWeight.bold),
      decoration: InputDecoration(
        prefixText: '\$ ',
        labelText: 'Efectivo Recibido',
        filled: true,
        fillColor: EmpireColors.charcoalSurface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EmpireColors.champagneGold),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EmpireColors.champagneGold),
        ),
      ),
      onChanged: (_) => setState(() {}),
    );
  }

  Widget _buildCardInput() {
    return TextField(
      controller: _cardRefController,
      autofocus: true,
      keyboardType: TextInputType.text,
      style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 16),
      decoration: InputDecoration(
        labelText: 'Referencia Bancaria',
        hintText: 'Últimos 4 dígitos o código de autorización',
        filled: true,
        fillColor: EmpireColors.charcoalSurface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EmpireColors.agedBronzeDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EmpireColors.agedBronzeDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: EmpireColors.champagneGold, width: 2),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
        Text(value, style: const TextStyle(color: EmpireColors.textGold, fontWeight: FontWeight.bold, fontSize: 13)),
      ],
    );
  }
}
