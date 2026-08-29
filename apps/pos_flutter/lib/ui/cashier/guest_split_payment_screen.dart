import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class _GuestPaymentPlan {
  final String label;
  final List<OrderItem> items;
  final double amount;
  bool paid = false;
  String? paymentMethod;
  double? cashReceived;
  double? cashChange;
  String? refCode;

  _GuestPaymentPlan({
    required this.label,
    required this.items,
    required this.amount,
  });
}

class GuestSplitPaymentScreen extends StatefulWidget {
  final TableModel table;
  final AppState state;
  final VoidCallback onCancel;
  final VoidCallback onComplete;

  const GuestSplitPaymentScreen({
    super.key,
    required this.table,
    required this.state,
    required this.onCancel,
    required this.onComplete,
  });

  @override
  State<GuestSplitPaymentScreen> createState() =>
      _GuestSplitPaymentScreenState();
}

class _GuestSplitPaymentScreenState extends State<GuestSplitPaymentScreen> {
  late int _guestCount;
  bool _paymentStarted = false;
  int _currentGuestIndex = 0;
  final List<_GuestPaymentPlan> _paymentPlan = [];
  String _paymentMethod = 'Efectivo';
  bool _isProcessing = false;

  final TextEditingController _cashController = TextEditingController();
  final TextEditingController _cardRefController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _guestCount = _initialGuestCount();
    _normalizeAssignedGuests();
    _syncTableGuestMetadata();
  }

  @override
  void dispose() {
    _cashController.dispose();
    _cardRefController.dispose();
    super.dispose();
  }

  int _initialGuestCount() {
    var highestAssigned = 0;
    for (final item in widget.table.items) {
      final match = RegExp(r'^P(\d+)$').firstMatch(item.assignedGuest ?? '');
      if (match != null) {
        final value = int.tryParse(match.group(1) ?? '') ?? 0;
        if (value > highestAssigned) highestAssigned = value;
      }
    }
    return [widget.table.guests, highestAssigned, 2].reduce(
      (value, element) => value > element ? value : element,
    );
  }

  void _normalizeAssignedGuests() {
    for (var i = 0; i < widget.table.items.length; i++) {
      final assignedGuest = widget.table.items[i].assignedGuest;
      if (!_isValidGuestLabel(assignedGuest)) {
        widget.table.items[i] = widget.table.items[i].copyWith(
          assignedGuest: null,
        );
      }
    }
  }

  bool _isValidGuestLabel(String? label) {
    if (label == null) return false;
    final match = RegExp(r'^P(\d+)$').firstMatch(label);
    if (match == null) return false;
    final value = int.tryParse(match.group(1) ?? '') ?? 0;
    return value >= 1 && value <= _guestCount;
  }

  void _syncTableGuestMetadata() {
    widget.table.guests = _guestCount;
    final genders = List<String>.from(widget.table.guestGenders);
    while (genders.length < _guestCount) {
      genders.add('M');
    }
    widget.table.guestGenders = genders.take(_guestCount).toList();
  }

  String _guestLabel(int index) => 'P${index + 1}';

  double _guestTotal(String guestLabel) {
    return widget.table.items
        .where((item) => item.assignedGuest == guestLabel)
        .fold<double>(0.0, (sum, item) => sum + item.totalPrice);
  }

  List<int> _currentIndicesForPlan(_GuestPaymentPlan plan) {
    final used = <int>{};
    final indices = <int>[];

    for (final plannedItem in plan.items) {
      var foundIndex = -1;
      for (var i = 0; i < widget.table.items.length; i++) {
        if (used.contains(i)) continue;
        final currentItem = widget.table.items[i];
        if (_sameOrderItem(currentItem, plannedItem)) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex != -1) {
        used.add(foundIndex);
        indices.add(foundIndex);
      }
    }

    return indices;
  }

  bool _sameOrderItem(OrderItem a, OrderItem b) {
    if (a.remoteId != null && b.remoteId != null) {
      return a.remoteId == b.remoteId;
    }
    if (a.clientUuid != null && b.clientUuid != null) {
      return a.clientUuid == b.clientUuid;
    }
    return a.item.id == b.item.id &&
        a.item.name == b.item.name &&
        a.quantity == b.quantity &&
        a.totalPrice == b.totalPrice &&
        a.notes == b.notes &&
        _sameStringList(a.modifiers, b.modifiers);
  }

  bool _sameStringList(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  List<int> get _unassignedItemIndices {
    final indices = <int>[];
    for (var i = 0; i < widget.table.items.length; i++) {
      if (!_isValidGuestLabel(widget.table.items[i].assignedGuest)) {
        indices.add(i);
      }
    }
    return indices;
  }

  List<String> get _emptyGuests {
    return List.generate(_guestCount, _guestLabel)
        .where((label) => _guestTotal(label) <= 0)
        .toList();
  }

  bool get _canStartPayments =>
      _guestCount >= 2 &&
      _unassignedItemIndices.isEmpty &&
      _emptyGuests.isEmpty &&
      widget.table.items.isNotEmpty;

  String get _currentGuestLabel => _paymentStarted && _paymentPlan.isNotEmpty
      ? _paymentPlan[_currentGuestIndex].label
      : _guestLabel(_currentGuestIndex);

  double get _currentAmount => _paymentStarted && _paymentPlan.isNotEmpty
      ? _paymentPlan[_currentGuestIndex].amount
      : _guestTotal(_currentGuestLabel);

  bool get _isLastGuest =>
      _paymentPlan.isNotEmpty && _currentGuestIndex >= _paymentPlan.length - 1;

  double get _totalPlanned => _paymentPlan.fold<double>(
        0.0,
        (sum, plan) => sum + plan.amount,
      );

  double get _totalPaid => _paymentPlan
      .where((plan) => plan.paid)
      .fold<double>(0.0, (sum, plan) => sum + plan.amount);

  double get _totalMissing =>
      (_totalPlanned - _totalPaid).clamp(0.0, double.infinity);

  double get _currentCashReceived =>
      double.tryParse(_cashController.text) ?? 0.0;

  double get _currentCashChange {
    if (_paymentMethod != 'Efectivo') return 0.0;
    return _currentCashReceived > _currentAmount
        ? _currentCashReceived - _currentAmount
        : 0.0;
  }

  void _setCashReceived(double amount) {
    final text =
        amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2);
    _cashController.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
    setState(() {});
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: EmpireColors.errorRed,
        content: Text(message),
      ),
    );
  }

  void _changeGuestCount(int newCount) {
    if (_paymentStarted) return;
    if (newCount < 2) return;

    if (newCount < _guestCount) {
      final removedLabel = _guestLabel(_guestCount - 1);
      if (_guestTotal(removedLabel) > 0) {
        _showError(
          'Reasigna los productos de $removedLabel antes de quitarlo.',
        );
        return;
      }
    }

    setState(() {
      _guestCount = newCount;
      _normalizeAssignedGuests();
      _syncTableGuestMetadata();
    });
  }

  void _assignItemToGuest(int itemIndex, String guestLabel) {
    if (_paymentStarted) return;
    setState(() {
      widget.table.items[itemIndex] = widget.table.items[itemIndex].copyWith(
        assignedGuest: guestLabel,
      );
      _syncTableGuestMetadata();
    });
  }

  void _startPayments() {
    if (!_canStartPayments) {
      if (_unassignedItemIndices.isNotEmpty) {
        _showError('Asigna todos los productos a un comensal.');
      } else if (_emptyGuests.isNotEmpty) {
        _showError(
          'Todos los comensales deben tener productos: ${_emptyGuests.join(', ')}.',
        );
      } else {
        _showError('Se requieren al menos 2 comensales con productos.');
      }
      return;
    }

    setState(() {
      _paymentPlan
        ..clear()
        ..addAll(_buildPaymentPlan());
      _paymentStarted = true;
      _currentGuestIndex = 0;
      _paymentMethod = 'Efectivo';
      _cashController.clear();
      _cardRefController.clear();
      _syncTableGuestMetadata();
    });
  }

  List<_GuestPaymentPlan> _buildPaymentPlan() {
    return List.generate(_guestCount, (index) {
      final label = _guestLabel(index);
      final items = widget.table.items
          .where((item) => item.assignedGuest == label)
          .map((item) => item.copyWith())
          .toList();
      return _GuestPaymentPlan(
        label: label,
        items: items,
        amount: items.fold<double>(
          0.0,
          (sum, item) => sum + item.totalPrice,
        ),
      );
    });
  }

  Future<void> _processCurrentPayment() async {
    if (_isProcessing) return;
    final plan = _paymentPlan[_currentGuestIndex];
    final amount = plan.amount;
    if (amount <= 0) {
      _showError('El comensal ${plan.label} no tiene productos.');
      return;
    }

    final refCode = _paymentMethod == 'Tarjeta'
        ? _cardRefController.text.trim()
        : 'Efectivo';
    final cashReceived = _currentCashReceived;
    if (_paymentMethod == 'Tarjeta' && refCode.isEmpty) {
      _showError('Ingresa la referencia de tarjeta.');
      return;
    }
    if (_paymentMethod == 'Efectivo' && cashReceived < amount) {
      _showError(
        'El efectivo recibido es menor que \$${amount.toStringAsFixed(2)}.',
      );
      return;
    }

    final guestLabel = plan.label;
    final wasLastGuest = _currentGuestIndex >= _paymentPlan.length - 1;
    final itemIndices = _currentIndicesForPlan(plan);
    if (itemIndices.isEmpty) {
      _showError('No hay productos para cobrar a $guestLabel.');
      return;
    }

    setState(() => _isProcessing = true);
    widget.state.checkoutTable(
      widget.table.id,
      discount: 0.0,
      paymentMethod: _paymentMethod,
      refCode: refCode,
      cashReceived: _paymentMethod == 'Efectivo' ? cashReceived : null,
      cashChange: _paymentMethod == 'Efectivo' ? _currentCashChange : null,
      isEqualSplit: false,
      itemIndicesToPay: itemIndices,
      printCustomerTicket: false,
    );

    if (!mounted) return;

    plan
      ..paid = true
      ..paymentMethod = _paymentMethod
      ..cashReceived = _paymentMethod == 'Efectivo' ? cashReceived : null
      ..cashChange = _paymentMethod == 'Efectivo' ? _currentCashChange : null
      ..refCode = refCode;

    if (wasLastGuest || widget.table.items.isEmpty) {
      widget.table.activePaymentType = null;
      widget.table.paymentsMadeInSession = 0;
      widget.table.originalSplitCountInSession = null;
      widget.state.finalizeCompletedSplitCheckout(widget.table.id);
      widget.onComplete();
      return;
    }

    setState(() {
      _isProcessing = false;
      _currentGuestIndex++;
      _paymentMethod = 'Efectivo';
      _cashController.clear();
      _cardRefController.clear();
    });
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
              child: _paymentStarted ? _buildPaymentStep() : _buildSetupStep(),
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
        children: [
          const Icon(Icons.groups, color: EmpireColors.champagneGold),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'División por Comensal',
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
          ),
          IconButton(
            onPressed: widget.onCancel,
            icon: const Icon(Icons.close, color: EmpireColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildSetupStep() {
    return Row(
      children: [
        SizedBox(
          width: 300,
          child: Container(
            color: EmpireColors.onyxSurface,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Comensales',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                _buildGuestCounter(),
                const SizedBox(height: 16),
                _buildValidationSummary(),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _canStartPayments ? _startPayments : null,
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('INICIAR COBROS'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.successGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: _buildAssignmentList(),
          ),
        ),
      ],
    );
  }

  Widget _buildGuestCounter() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            onPressed: _guestCount > 2
                ? () => _changeGuestCount(_guestCount - 1)
                : null,
            icon: const Icon(Icons.remove_circle_outline),
            color: _guestCount > 2
                ? EmpireColors.champagneGold
                : EmpireColors.textSecondary,
          ),
          Container(
            width: 76,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: EmpireColors.onyxSurface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$_guestCount',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: EmpireColors.champagneGold,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          IconButton(
            onPressed: () => _changeGuestCount(_guestCount + 1),
            icon: const Icon(Icons.add_circle_outline),
            color: EmpireColors.champagneGold,
          ),
        ],
      ),
    );
  }

  Widget _buildValidationSummary() {
    final unassigned = _unassignedItemIndices.length;
    final emptyGuests = _emptyGuests;
    final valid = _canStartPayments;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: valid
            ? EmpireColors.successGreen.withValues(alpha: 0.12)
            : EmpireColors.warningOrange.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: valid ? EmpireColors.successGreen : EmpireColors.warningOrange,
        ),
      ),
      child: Text(
        valid
            ? 'Listo para cobrar por comensal.'
            : [
                if (unassigned > 0) '$unassigned producto(s) sin asignar',
                if (emptyGuests.isNotEmpty)
                  'Sin productos: ${emptyGuests.join(', ')}',
              ].join('\n'),
        style: TextStyle(
          color: valid ? EmpireColors.successGreen : EmpireColors.warningOrange,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildAssignmentList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Asignación de productos',
          style: TextStyle(
            color: EmpireColors.textGold,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: ListView.builder(
            itemCount: widget.table.items.length,
            itemBuilder: (context, index) {
              final item = widget.table.items[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: EmpireColors.charcoalSurface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: EmpireColors.agedBronzeDark),
                ),
                child: Row(
                  children: [
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
                          const SizedBox(height: 4),
                          Text(
                            '${item.quantity}x • \$${item.totalPrice.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    DropdownButton<String>(
                      value: _isValidGuestLabel(item.assignedGuest)
                          ? item.assignedGuest
                          : null,
                      hint: const Text(
                        'Sin asignar',
                        style: TextStyle(color: EmpireColors.warningOrange),
                      ),
                      dropdownColor: EmpireColors.onyxSurface,
                      style: const TextStyle(color: EmpireColors.textPrimary),
                      items: List.generate(_guestCount, (guestIndex) {
                        final label = _guestLabel(guestIndex);
                        return DropdownMenuItem(
                          value: label,
                          child: Text(label),
                        );
                      }),
                      onChanged: _paymentStarted
                          ? null
                          : (value) {
                              if (value != null) {
                                _assignItemToGuest(index, value);
                              }
                            },
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        _buildGuestTotals(),
      ],
    );
  }

  Widget _buildGuestTotals() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: List.generate(_guestCount, (index) {
        final label = _guestLabel(index);
        final total = _guestTotal(label);
        final isEmpty = total <= 0;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: isEmpty
                ? EmpireColors.errorRed.withValues(alpha: 0.12)
                : EmpireColors.onyxSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isEmpty ? EmpireColors.errorRed : EmpireColors.agedBronze,
            ),
          ),
          child: Text(
            '$label  \$${total.toStringAsFixed(2)}',
            style: TextStyle(
              color: isEmpty ? EmpireColors.errorRed : EmpireColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        );
      }),
    );
  }

  Widget _buildPaymentStep() {
    final plan = _paymentPlan[_currentGuestIndex];
    final amount = _currentAmount;
    final itemCount = plan.items.length;
    return Row(
      children: [
        SizedBox(
          width: 300,
          child: Container(
            color: EmpireColors.onyxSurface,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Progreso',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: ListView.builder(
                    itemCount: _paymentPlan.length,
                    itemBuilder: (context, index) {
                      final plan = _paymentPlan[index];
                      final label = plan.label;
                      final isPaid = plan.paid;
                      final isCurrent = index == _currentGuestIndex;
                      return ListTile(
                        leading: Icon(
                          isPaid
                              ? Icons.check_circle
                              : isCurrent
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                          color: isPaid
                              ? EmpireColors.successGreen
                              : isCurrent
                                  ? EmpireColors.champagneGold
                                  : EmpireColors.textSecondary,
                        ),
                        title: Text(
                          label,
                          style: TextStyle(
                            color: isCurrent
                                ? EmpireColors.champagneGold
                                : EmpireColors.textPrimary,
                            fontWeight:
                                isCurrent ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        subtitle: Text(
                          isPaid
                              ? 'Pagado • \$${plan.amount.toStringAsFixed(2)}'
                              : 'Pendiente • \$${plan.amount.toStringAsFixed(2)}',
                          style: TextStyle(
                            color: isPaid
                                ? EmpireColors.successGreen
                                : EmpireColors.textSecondary,
                            fontSize: 11,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Cobrar $_currentGuestLabel',
                  style: const TextStyle(
                    color: EmpireColors.champagneGold,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '$itemCount producto(s) • \$${amount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 24),
                _buildCollectionSummary(),
                const SizedBox(height: 20),
                _buildPaymentMethodSelector(),
                const SizedBox(height: 20),
                _buildPaymentInput(amount),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _isProcessing ? null : _processCurrentPayment,
                  icon: const Icon(Icons.payments),
                  label: Text(_isLastGuest ? 'COBRAR Y CERRAR' : 'COBRAR'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.successGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCollectionSummary() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Column(
        children: [
          _summaryRow('Total mesa', _totalPlanned),
          _summaryRow('Pagado', _totalPaid, color: EmpireColors.successGreen),
          _summaryRow(
            'Falta',
            _totalMissing,
            color: _totalMissing > 0
                ? EmpireColors.warningOrange
                : EmpireColors.successGreen,
          ),
          const Divider(color: EmpireColors.agedBronzeDark, height: 18),
          _summaryRow('Cobra $_currentGuestLabel', _currentAmount),
          if (_paymentMethod == 'Efectivo') ...[
            _summaryRow('Recibido', _currentCashReceived),
            _summaryRow(
              'Cambio',
              _currentCashChange,
              color: EmpireColors.champagneGold,
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryRow(String label, double amount, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: EmpireColors.textSecondary,
              fontSize: 12,
            ),
          ),
          Text(
            '\$${amount.toStringAsFixed(2)}',
            style: TextStyle(
              color: color ?? EmpireColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelector() {
    return Row(
      children: [
        Expanded(
          child: ChoiceChip(
            label: const Text('EFECTIVO'),
            selected: _paymentMethod == 'Efectivo',
            onSelected: (selected) {
              if (selected) setState(() => _paymentMethod = 'Efectivo');
            },
            selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
            backgroundColor: EmpireColors.charcoalSurface,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ChoiceChip(
            label: const Text('TARJETA'),
            selected: _paymentMethod == 'Tarjeta',
            onSelected: (selected) {
              if (selected) setState(() => _paymentMethod = 'Tarjeta');
            },
            selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
            backgroundColor: EmpireColors.charcoalSurface,
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentInput(double amount) {
    if (_paymentMethod == 'Tarjeta') {
      return TextField(
        controller: _cardRefController,
        style: const TextStyle(color: EmpireColors.textPrimary),
        decoration: InputDecoration(
          labelText: 'Referencia de tarjeta',
          labelStyle: const TextStyle(color: EmpireColors.textSecondary),
          filled: true,
          fillColor: EmpireColors.charcoalSurface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _cashController,
          onChanged: (_) => setState(() {}),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
          ],
          style: const TextStyle(
            color: EmpireColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
          decoration: InputDecoration(
            labelText: 'Monto recibido',
            helperText: 'Debe ser al menos \$${amount.toStringAsFixed(2)}',
            labelStyle: const TextStyle(color: EmpireColors.textSecondary),
            helperStyle: const TextStyle(color: EmpireColors.textSecondary),
            prefixText: '\$ ',
            prefixStyle: const TextStyle(color: EmpireColors.champagneGold),
            filled: true,
            fillColor: EmpireColors.charcoalSurface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [20, 50, 100, 200, 500, 1000].map((cashAmount) {
            return ElevatedButton(
              onPressed: () => _setCashReceived(cashAmount.toDouble()),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.charcoalSurface,
                foregroundColor: EmpireColors.champagneGold,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
              ),
              child: Text('\$$cashAmount'),
            );
          }).toList(),
        ),
        if (_currentCashReceived > 0) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: EmpireColors.charcoalSurface,
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
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '\$${_currentCashChange.toStringAsFixed(2)}',
                  style: TextStyle(
                    color: _currentCashReceived >= amount
                        ? EmpireColors.champagneGold
                        : EmpireColors.warningOrange,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
