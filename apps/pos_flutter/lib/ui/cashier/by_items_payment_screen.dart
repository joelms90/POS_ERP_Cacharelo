import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

/// Data model for a single payment in by-items flow
class ItemsPaymentData {
  List<int> itemIndexes; // Indexes of items being paid
  String paymentMethod;
  double? cashReceived;
  String? cardRefCode;

  ItemsPaymentData({
    required this.itemIndexes,
    this.paymentMethod = 'Efectivo',
    this.cashReceived,
    this.cardRefCode,
  });

  bool get isValid {
    if (itemIndexes.isEmpty) return false;
    if (paymentMethod == 'Efectivo') {
      return cashReceived != null && cashReceived! > 0;
    } else {
      return cardRefCode != null && cardRefCode!.isNotEmpty;
    }
  }
}

/// Screen for handling by-items payments
class ByItemsPaymentScreen extends StatefulWidget {
  final TableModel table;
  final AppState state;
  final VoidCallback onCancel;
  final VoidCallback onComplete;

  const ByItemsPaymentScreen({
    super.key,
    required this.table,
    required this.state,
    required this.onCancel,
    required this.onComplete,
  });

  @override
  State<ByItemsPaymentScreen> createState() => _ByItemsPaymentScreenState();
}

class _ByItemsPaymentScreenState extends State<ByItemsPaymentScreen> {
  List<ItemsPaymentData> _payments = []; // Collected payments
  List<int> _remainingItemIndexes = []; // Items not yet paid
  List<int> _selectedItemIndexes = []; // Currently selected items for payment
  String _currentPaymentMethod = 'Efectivo';
  bool _isProcessing = false;

  final TextEditingController _cashController = TextEditingController();
  final TextEditingController _cardRefController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Initialize with all items as remaining
    _remainingItemIndexes = List.generate(widget.table.items.length, (index) => index);
  }

  @override
  void dispose() {
    _cashController.dispose();
    _cardRefController.dispose();
    super.dispose();
  }

  double get _selectedItemsTotal {
    double sum = 0.0;
    for (final index in _selectedItemIndexes) {
      if (index < widget.table.items.length) {
        sum += widget.table.items[index].totalPrice;
      }
    }
    return sum;
  }

  double get _totalPaid {
    double sum = 0.0;
    for (final payment in _payments) {
      for (final index in payment.itemIndexes) {
        if (index < widget.table.items.length) {
          sum += widget.table.items[index].totalPrice;
        }
      }
    }
    return sum;
  }

  bool get _allItemsPaid => _remainingItemIndexes.isEmpty;

  void _toggleItemSelection(int index) {
    setState(() {
      if (_selectedItemIndexes.contains(index)) {
        _selectedItemIndexes.remove(index);
      } else {
        _selectedItemIndexes.add(index);
      }
    });
  }

  void _selectAllRemaining() {
    setState(() {
      _selectedItemIndexes = List.from(_remainingItemIndexes);
    });
  }

  void _clearSelection() {
    setState(() {
      _selectedItemIndexes.clear();
    });
  }

  bool _validateCurrentPayment() {
    if (_selectedItemIndexes.isEmpty) {
      _showError('Por favor, seleccione al menos un artículo');
      return false;
    }

    if (_currentPaymentMethod == 'Efectivo') {
      final cash = double.tryParse(_cashController.text) ?? 0.0;
      if (cash < _selectedItemsTotal) {
        _showError('El efectivo recibido es menor que el total de artículos (\$${_selectedItemsTotal.toStringAsFixed(2)})');
        return false;
      }
    } else {
      if (_cardRefController.text.isEmpty) {
        _showError('Por favor, ingresa el código de referencia bancaria');
        return false;
      }
    }

    return true;
  }

  void _processCurrentPayment() {
    if (_isProcessing) return;
    if (!_validateCurrentPayment()) return;

    final payment = ItemsPaymentData(
      itemIndexes: List.from(_selectedItemIndexes),
      paymentMethod: _currentPaymentMethod,
      cashReceived: _currentPaymentMethod == 'Efectivo'
          ? double.tryParse(_cashController.text)
          : null,
      cardRefCode: _currentPaymentMethod == 'Tarjeta'
          ? _cardRefController.text
          : null,
    );

    setState(() {
      _payments.add(payment);
      for (final index in _selectedItemIndexes) {
        _remainingItemIndexes.remove(index);
      }
      _selectedItemIndexes.clear();
      _cashController.clear();
      _cardRefController.clear();
    });

    if (_allItemsPaid) {
      setState(() => _isProcessing = true);
      _processAllPayments();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: EmpireColors.successGreen,
          content: Text('Pago ${_payments.length} registrado. Quedan ${_remainingItemIndexes.length} artículo(s).'),
        ),
      );
    }
  }

  Future<void> _processAllPayments() async {
    try {
      final table = widget.table;
      final removedOriginalIndices = <int>[];

      for (final payment in _payments) {
        final sortedIndices = List<int>.from(payment.itemIndexes)..sort();
        final currentIndices = sortedIndices.map((origIdx) {
          final shift = removedOriginalIndices.where((r) => r < origIdx).length;
          return origIdx - shift;
        }).toList();

        final method = payment.paymentMethod;
        final refCode = method == 'Tarjeta'
            ? (payment.cardRefCode ?? 'Tarjeta')
            : 'Efectivo';
        final cashReceived = method == 'Efectivo' ? payment.cashReceived : null;
        final cashChange = cashReceived != null
            ? cashReceived - _itemsTotalForCurrent(currentIndices)
            : null;

        widget.state.checkoutTable(
          table.id,
          discount: 0.0,
          paymentMethod: method,
          refCode: refCode,
          cashReceived: cashReceived,
          cashChange: cashChange,
          isEqualSplit: false,
          itemIndicesToPay: currentIndices,
        );

        removedOriginalIndices.addAll(sortedIndices);
      }

      widget.table.activePaymentType = null;
      widget.table.paymentsMadeInSession = 0;
      widget.table.originalSplitCountInSession = null;

      widget.onComplete();
    } catch (e) {
      debugPrint('_processAllPayments error: $e');
      if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: EmpireColors.errorRed,
            content: Text('Error al procesar pagos: $e'),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  double _itemsTotalForCurrent(List<int> indices) {
    double sum = 0.0;
    for (final index in indices) {
      if (index < widget.table.items.length) {
        sum += widget.table.items[index].totalPrice;
      }
    }
    return sum;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: EmpireColors.errorRed,
        content: Text(message),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: Row(
                children: [
                  // Left: Item selection
                  Expanded(
                    flex: 2,
                    child: _buildLeftPanel(),
                  ),
                  // Right: Payment collection
                  Expanded(
                    flex: 3,
                    child: _buildRightPanel(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
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
              const Text(
                'Cobro Por Artículos',
                style: TextStyle(
                  color: EmpireColors.champagneGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 20,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Mesa: ${widget.table.label} • Total: \$${widget.table.total.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: EmpireColors.textSecondary,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          IconButton(
            onPressed: widget.onCancel,
            icon: const Icon(Icons.close, color: EmpireColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildLeftPanel() {
    return Container(
      color: EmpireColors.onyxSurface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Seleccionar Artículos',
                        style: TextStyle(
                          color: EmpireColors.textGold,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Row(
                      children: [
                        TextButton(
                          onPressed: _remainingItemIndexes.isEmpty ? null : _selectAllRemaining,
                          child: const Text('Todos'),
                        ),
                        TextButton(
                          onPressed: _selectedItemIndexes.isEmpty ? null : _clearSelection,
                          child: const Text('Limpiar'),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${_remainingItemIndexes.length} artículo(s) pendiente(s)',
                  style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: widget.table.items.length,
              itemBuilder: (context, index) {
                final item = widget.table.items[index];
                final isPaid = !_remainingItemIndexes.contains(index);
                final isSelected = _selectedItemIndexes.contains(index);

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: isPaid
                        ? EmpireColors.charcoalSurface.withValues(alpha: 0.5)
                        : (isSelected ? EmpireColors.champagneGold.withValues(alpha: 0.2) : EmpireColors.charcoalSurface),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected
                          ? EmpireColors.champagneGold
                          : (isPaid ? EmpireColors.successGreen : EmpireColors.agedBronzeDark),
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: CheckboxListTile(
                    value: isPaid ? true : isSelected,
                    onChanged: isPaid ? null : (_) => _toggleItemSelection(index),
                    enabled: !isPaid,
                    title: Text(
                      item.item.name,
                      style: TextStyle(
                        color: isPaid ? EmpireColors.textSecondary : EmpireColors.textPrimary,
                        decoration: isPaid ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    subtitle: Text(
                      'Cantidad: ${item.quantity} • \$${item.totalPrice.toStringAsFixed(2)}',
                      style: TextStyle(
                        color: EmpireColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                    secondary: isPaid
                        ? const Icon(Icons.check_circle, color: EmpireColors.successGreen)
                        : null,
                    activeColor: EmpireColors.champagneGold,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRightPanel() {
    return Container(
      color: EmpireColors.onyxSurface,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Pago ${_payments.length + 1}',
                style: const TextStyle(
                  color: EmpireColors.champagneGold,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (_payments.isNotEmpty)
                Text(
                  '${_payments.length} pago(s) registrado(s)',
                  style: const TextStyle(
                    color: EmpireColors.successGreen,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildSelectedItemsSummary(),
                  const SizedBox(height: 20),
                  _buildPaymentMethodSelector(),
                  const SizedBox(height: 20),
                  _buildPaymentInputs(),
                  const SizedBox(height: 20),
                  _buildPaymentSummary(),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildSelectedItemsSummary() {
    if (_selectedItemIndexes.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: EmpireColors.charcoalSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: EmpireColors.agedBronzeDark),
        ),
        child: const Row(
          children: [
            Icon(Icons.touch_app, color: EmpireColors.textSecondary),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Seleccione artículos de la izquierda',
                style: TextStyle(
                  color: EmpireColors.textSecondary,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.champagneGold.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_selectedItemIndexes.length} Artículo(s) Seleccionado(s):',
            style: const TextStyle(
              color: EmpireColors.champagneGold,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          ..._selectedItemIndexes.map((index) {
            final item = widget.table.items[index];
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      '${item.item.name} x${item.quantity}',
                      style: const TextStyle(
                        color: EmpireColors.textPrimary,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  Text(
                    '\$${item.totalPrice.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: EmpireColors.textGold,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Método de Pago:',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.bold,
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
                    Text('EFECTIVO'),
                  ],
                ),
                selected: _currentPaymentMethod == 'Efectivo',
                onSelected: (selected) {
                  if (selected) {
                    setState(() => _currentPaymentMethod = 'Efectivo');
                  }
                },
                selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
                backgroundColor: EmpireColors.charcoalSurface,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ChoiceChip(
                label: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.credit_card, size: 16),
                    SizedBox(width: 8),
                    Text('TARJETA'),
                  ],
                ),
                selected: _currentPaymentMethod == 'Tarjeta',
                onSelected: (selected) {
                  if (selected) {
                    setState(() => _currentPaymentMethod = 'Tarjeta');
                  }
                },
                selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
                backgroundColor: EmpireColors.charcoalSurface,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPaymentInputs() {
    if (_currentPaymentMethod == 'Efectivo') {
      return _buildCashInput();
    } else {
      return _buildCardInput();
    }
  }

  Widget _buildCashInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Efectivo Recibido:',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _cashController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 16),
          decoration: InputDecoration(
            prefixText: '\$ ',
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
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [20, 50, 100, 200, 500, 1000].map((amount) {
            return ElevatedButton(
              onPressed: () {
                _cashController.text = amount.toString();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.charcoalSurface,
                foregroundColor: EmpireColors.champagneGold,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
              child: Text('\$$amount'),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildCardInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Código de Referencia:',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _cardRefController,
          keyboardType: TextInputType.text,
          style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 16),
          decoration: InputDecoration(
            hintText: 'Últimos 4 dígitos o código de autorización',
            hintStyle: const TextStyle(color: EmpireColors.textSecondary),
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
        ),
      ],
    );
  }

  Widget _buildPaymentSummary() {
    final cashReceived = double.tryParse(_cashController.text) ?? 0.0;
    final cashChange = cashReceived > _selectedItemsTotal ? cashReceived - _selectedItemsTotal : 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Column(
        children: [
          _buildSummaryRow('Total artículos:', '\$${_selectedItemsTotal.toStringAsFixed(2)}', isTotal: true),
          if (_currentPaymentMethod == 'Efectivo' && cashReceived > 0) ...[
            const Divider(color: EmpireColors.agedBronzeDark, height: 24),
            _buildSummaryRow('Efectivo recibido:', '\$${cashReceived.toStringAsFixed(2)}'),
            if (cashChange > 0)
              _buildSummaryRow('Cambio:', '\$${cashChange.toStringAsFixed(2)}', isHighlighted: true),
          ],
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isTotal = false, bool isHighlighted = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isHighlighted ? EmpireColors.successGreen : EmpireColors.textSecondary,
              fontSize: isTotal ? 15 : 13,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: isHighlighted ? EmpireColors.successGreen : (isTotal ? EmpireColors.champagneGold : EmpireColors.textPrimary),
              fontSize: isTotal ? 16 : 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return ElevatedButton.icon(
      onPressed: (_selectedItemIndexes.isEmpty || _isProcessing) ? null : _processCurrentPayment,
      icon: _isProcessing
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: EmpireColors.textSecondary),
            )
          : Icon(_allItemsPaid ? Icons.check : Icons.arrow_forward),
      label: Text(
        _isProcessing
            ? 'PROCESANDO...'
            : (_selectedItemIndexes.isEmpty
                ? 'SELECCIONE ARTÍCULOS'
                : (_allItemsPaid ? 'FINALIZAR TODO' : 'REGISTRAR PAGO')),
        style: const TextStyle(fontWeight: FontWeight.bold),
      ),
      style: ElevatedButton.styleFrom(
        backgroundColor: _selectedItemIndexes.isEmpty
            ? EmpireColors.charcoalSurface
            : (_allItemsPaid ? EmpireColors.successGreen : EmpireColors.champagneGold),
        foregroundColor: _selectedItemIndexes.isEmpty
            ? EmpireColors.textSecondary
            : EmpireColors.obsidian,
        padding: const EdgeInsets.symmetric(vertical: 16),
        disabledBackgroundColor: EmpireColors.charcoalSurface,
        disabledForegroundColor: EmpireColors.textSecondary,
      ),
    );
  }
}
