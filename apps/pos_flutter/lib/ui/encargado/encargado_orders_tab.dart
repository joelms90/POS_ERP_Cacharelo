import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class EncargadoOrdersTab extends StatefulWidget {
  final AppState state;

  const EncargadoOrdersTab({super.key, required this.state});

  @override
  State<EncargadoOrdersTab> createState() => _EncargadoOrdersTabState();
}

class _EncargadoOrdersTabState extends State<EncargadoOrdersTab> {
  @override
  void initState() {
    super.initState();
    widget.state.addListener(_onStateChanged);
  }

  @override
  void dispose() {
    widget.state.removeListener(_onStateChanged);
    super.dispose();
  }

  void _onStateChanged() {
    if (mounted) setState(() {});
  }

  List<TableModel> get _activeOrders {
    return widget.state.tables
        .where((t) =>
            t.zone == 'Para Llevar' &&
            (t.state == TableState.occupied || t.state == TableState.billing))
        .toList()
      ..sort((a, b) => b.id.compareTo(a.id));
  }

  String _elapsedTime(TableModel table) {
    // TableModel doesn't store creation time, so we use a simple indicator
    // based on the table label as a stable reference
    return '';
  }

  Future<void> _handlePayOrder(TableModel table) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (context) => _EncargadoOrderPaymentScreen(
          table: table,
          state: widget.state,
        ),
      ),
    );
    if (result == true && mounted) {
      setState(() {});
    }
  }

  Future<void> _handleCancelOrder(TableModel table) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EmpireColors.onyxSurface,
        title: const Text('Cancelar Orden', style: TextStyle(color: EmpireColors.textGold)),
        content: Text(
          '¿Cancelar ${table.label}?',
          style: const TextStyle(color: EmpireColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No', style: TextStyle(color: EmpireColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sí, Cancelar', style: TextStyle(color: EmpireColors.errorRed)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      table.state = TableState.free;
      table.items = [];
      table.guests = 0;
      table.partialPayments = [];
      widget.state.notifyListeners();
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = _activeOrders;

    return Container(
      color: EmpireColors.obsidian,
      child: orders.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.receipt_long, color: EmpireColors.textSecondary, size: 48),
                  const SizedBox(height: 16),
                  const Text(
                    'No hay órdenes activas',
                    style: TextStyle(color: EmpireColors.textSecondary, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Usa la pestaña POS para crear nuevas órdenes',
                    style: TextStyle(color: EmpireColors.textSecondary.withValues(alpha: 0.7), fontSize: 13),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              itemBuilder: (context, index) {
                return _buildOrderCard(orders[index]);
              },
            ),
    );
  }

  Widget _buildOrderCard(TableModel table) {
    final totalItems = table.items.fold<int>(0, (s, i) => s + i.quantity);
    final isBilling = table.state == TableState.billing;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isBilling ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
          width: isBilling ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isBilling
                  ? EmpireColors.champagneGold.withValues(alpha: 0.1)
                  : EmpireColors.charcoalSurface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(9)),
              border: const Border(
                bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isBilling ? EmpireColors.champagneGold : EmpireColors.obsidian,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isBilling ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
                    ),
                  ),
                  child: Text(
                    table.label.replaceAll('Llevar #', '#'),
                    style: TextStyle(
                      color: isBilling ? EmpireColors.obsidian : EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        table.label,
                        style: const TextStyle(
                          color: EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$totalItems artículos · \$${table.total.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isBilling
                        ? EmpireColors.champagneGold.withValues(alpha: 0.2)
                        : EmpireColors.charcoalSurface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isBilling ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
                    ),
                  ),
                  child: Text(
                    isBilling ? 'POR COBRAR' : 'EN PREPARACIÓN',
                    style: TextStyle(
                      color: isBilling ? EmpireColors.champagneGold : EmpireColors.textSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (table.items.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final item in table.items.take(5))
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          Text(
                            '${item.quantity}x',
                            style: const TextStyle(
                              color: EmpireColors.champagneGold,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              item.item.name,
                              style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 12),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '\$${item.totalPrice.toStringAsFixed(2)}',
                            style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  if (table.items.length > 5)
                    Text(
                      '... y ${table.items.length - 5} más',
                      style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 11, fontStyle: FontStyle.italic),
                    ),
                ],
              ),
            ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: EmpireColors.agedBronzeDark, width: 0.5),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () => _handleCancelOrder(table),
                  icon: const Icon(Icons.close, size: 14),
                  label: const Text('Cancelar', style: TextStyle(fontSize: 11)),
                  style: TextButton.styleFrom(
                    foregroundColor: EmpireColors.errorRed,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  ),
                ),
                const SizedBox(width: 4),
                if (!isBilling)
                  TextButton.icon(
                    onPressed: () {
                      table.state = TableState.billing;
                      widget.state.notifyListeners();
                      if (mounted) setState(() {});
                    },
                    icon: const Icon(Icons.check, size: 14),
                    label: const Text('Listo', style: TextStyle(fontSize: 11)),
                    style: TextButton.styleFrom(
                      foregroundColor: EmpireColors.successGreen,
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    ),
                  ),
                const SizedBox(width: 4),
                ElevatedButton.icon(
                  onPressed: () => _handlePayOrder(table),
                  icon: const Icon(Icons.payment, size: 14),
                  label: const Text('Cobrar', style: TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.champagneGold,
                    foregroundColor: EmpireColors.obsidian,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EncargadoOrderPaymentScreen extends StatefulWidget {
  final TableModel table;
  final AppState state;

  const _EncargadoOrderPaymentScreen({
    required this.table,
    required this.state,
  });

  @override
  State<_EncargadoOrderPaymentScreen> createState() =>
      _EncargadoOrderPaymentScreenState();
}

class _EncargadoOrderPaymentScreenState
    extends State<_EncargadoOrderPaymentScreen> {
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

  double get _total => widget.table.total;

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

    final cashReceived =
        _paymentMethod == 'Efectivo' ? double.tryParse(_cashController.text) : null;
    final cashChange = cashReceived != null ? cashReceived - _total : null;
    final refCode =
        _paymentMethod == 'Tarjeta' ? _cardRefController.text.trim() : 'Efectivo';

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
        title: Text(
          'Cobrar ${widget.table.label}',
          style: const TextStyle(color: EmpireColors.champagneGold),
        ),
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
            _buildDiscountRow(),
            const SizedBox(height: 20),
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
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text(
                        'COBRAR',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
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
      style: const TextStyle(
        color: EmpireColors.textPrimary,
        fontSize: 20,
        fontWeight: FontWeight.bold,
      ),
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
        Text(label,
            style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 13)),
        Text(value,
            style: const TextStyle(
                color: EmpireColors.textGold,
                fontWeight: FontWeight.bold,
                fontSize: 13)),
      ],
    );
  }
}
