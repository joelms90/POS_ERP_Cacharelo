import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

/// Data model for a single payment step in equal split flow
class PaymentStepData {
  String paymentMethod; // 'Efectivo' or 'Tarjeta'
  double? cashReceived;
  String? cardRefCode;

  PaymentStepData({
    this.paymentMethod = 'Efectivo',
    this.cashReceived,
    this.cardRefCode,
  });

  bool get isValid {
    if (paymentMethod == 'Efectivo') {
      return cashReceived != null && cashReceived! > 0;
    } else {
      return cardRefCode != null && cardRefCode!.isNotEmpty;
    }
  }

  double get cashChange {
    if (paymentMethod != 'Efectivo' || cashReceived == null) return 0.0;
    return 0.0; // Will be calculated based on amount per person
  }
}

/// Screen for handling equal split payments with a stepper interface
class EqualSplitPaymentScreen extends StatefulWidget {
  final TableModel table;
  final AppState state;
  final VoidCallback onCancel;
  final VoidCallback onComplete;

  const EqualSplitPaymentScreen({
    super.key,
    required this.table,
    required this.state,
    required this.onCancel,
    required this.onComplete,
  });

  @override
  State<EqualSplitPaymentScreen> createState() => _EqualSplitPaymentScreenState();
}

class _EqualSplitPaymentScreenState extends State<EqualSplitPaymentScreen> {
  int _splitCount = 2; // Number of people to split between
  int _currentStep = 0; // Current payment step (0-indexed)
  List<PaymentStepData> _payments = []; // Collected payments
  double _selectedDiscount = 0.0;
  final Map<int, double> _customPersonAmounts = {}; // Per-person custom override amounts

  final TextEditingController _cashController = TextEditingController();
  final TextEditingController _cardRefController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _payments = List.generate(
      _splitCount,
      (_) => PaymentStepData(),
    );
  }

  @override
  void dispose() {
    _cashController.dispose();
    _cardRefController.dispose();
    super.dispose();
  }

  double getPersonAmount(int index) {
    if (_customPersonAmounts.containsKey(index)) {
      return _customPersonAmounts[index]!;
    }
    double overriddenSum = 0.0;
    int unoverriddenCount = 0;
    for (int i = 0; i < _splitCount; i++) {
      if (_customPersonAmounts.containsKey(i)) {
        overriddenSum += _customPersonAmounts[i]!;
      } else {
        unoverriddenCount++;
      }
    }
    final remaining = widget.table.total - overriddenSum;
    if (unoverriddenCount > 0) {
      final calculated = remaining / unoverriddenCount;
      return calculated > 0 ? calculated : 0.0;
    }
    return 0.0;
  }

  double get _currentAmountToPay => getPersonAmount(_currentStep);

  double get _totalCollected {
    double sum = 0.0;
    for (int i = 0; i < _currentStep; i++) {
      sum += getPersonAmount(i);
    }
    return sum;
  }

  bool get _isConfigStep => _currentStep == -1;
  bool get _isLastPayment => _currentStep == _splitCount - 1;

  void _updateSplitCount(int newCount) {
    if (newCount < 2) return;
    setState(() {
      _splitCount = newCount;
      _customPersonAmounts.removeWhere((key, value) => key >= _splitCount);
      _payments = List.generate(
        _splitCount,
        (index) => index < _payments.length ? _payments[index] : PaymentStepData(),
      );
    });
  }

  void _resetEqualDivision() {
    setState(() {
      _customPersonAmounts.clear();
    });
  }

  void _showOverrideAmountDialog(int personIndex) {
    final currentAmount = getPersonAmount(personIndex);
    final controller = TextEditingController(
      text: currentAmount.toStringAsFixed(2),
    );

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: EmpireColors.onyxSurface,
          title: Row(
            children: [
              const Icon(Icons.edit, color: EmpireColors.champagneGold, size: 20),
              const SizedBox(width: 8),
              Text(
                'Monto Persona ${personIndex + 1}',
                style: const TextStyle(color: EmpireColors.textGold, fontSize: 16),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Total Mesa (${widget.table.label}): \$${widget.table.total.toStringAsFixed(2)}',
                style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
                decoration: InputDecoration(
                  prefixText: '\$ ',
                  prefixStyle: const TextStyle(color: EmpireColors.champagneGold, fontSize: 20, fontWeight: FontWeight.bold),
                  filled: true,
                  fillColor: EmpireColors.charcoalSurface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
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
                children: [50, 100, 150, 200, 300, 500].map((preset) {
                  return ActionChip(
                    backgroundColor: EmpireColors.charcoalSurface,
                    label: Text('\$$preset', style: const TextStyle(color: EmpireColors.champagneGold, fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      controller.text = preset.toDouble().toStringAsFixed(2);
                    },
                  );
                }).toList(),
              ),
            ],
          ),
          actions: [
            if (_customPersonAmounts.containsKey(personIndex))
              TextButton(
                onPressed: () {
                  setState(() {
                    _customPersonAmounts.remove(personIndex);
                  });
                  Navigator.of(context).pop();
                },
                child: const Text('Restablecer Equitativo', style: TextStyle(color: EmpireColors.warningOrange)),
              ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar', style: TextStyle(color: EmpireColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () {
                final val = double.tryParse(controller.text);
                if (val != null && val >= 0) {
                  setState(() {
                    _customPersonAmounts[personIndex] = val;
                  });
                }
                Navigator.of(context).pop();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.champagneGold,
                foregroundColor: EmpireColors.obsidian,
              ),
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    );
  }

  void _nextStep() {
    if (_currentStep < _splitCount - 1) {
      setState(() {
        _currentStep++;
        _cashController.clear();
        _cardRefController.clear();
      });
    } else {
      _processAllPayments();
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() {
        _currentStep--;
        final prevPayment = _payments[_currentStep];
        if (prevPayment.paymentMethod == 'Efectivo' && prevPayment.cashReceived != null) {
          _cashController.text = prevPayment.cashReceived!.toStringAsFixed(2);
        }
        if (prevPayment.cardRefCode != null) {
          _cardRefController.text = prevPayment.cardRefCode!;
        }
      });
    }
  }

  bool _validateCurrentPayment() {
    final currentPayment = _payments[_currentStep];
    final targetAmount = _currentAmountToPay;

    if (currentPayment.paymentMethod == 'Efectivo') {
      final cash = double.tryParse(_cashController.text) ?? 0.0;
      if (cash < targetAmount) {
        _showError('El efectivo recibido es menor que el monto a pagar (\$${targetAmount.toStringAsFixed(2)})');
        return false;
      }
      currentPayment.cashReceived = cash;
    } else {
      if (_cardRefController.text.isEmpty) {
        _showError('Por favor, ingresa el código de referencia bancaria');
        return false;
      }
      currentPayment.cardRefCode = _cardRefController.text;
    }

    return true;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: EmpireColors.errorRed,
        content: Text(message),
      ),
    );
  }

  Future<void> _processAllPayments() async {
    // Call backend with equal split payment
    // The backend will handle creating multiple partial payment records
    // and printing individual tickets for each person
    widget.state.checkoutTable(
      widget.table.id,
      discount: _selectedDiscount,
      paymentMethod: 'Multiple', // Special flag for equal split
      refCode: 'EqualSplit',
      isEqualSplit: true,
      splitCount: 1, // We're done, final payment
      originalSplitCount: _splitCount,
      // Pass all payment data as metadata (backend will need to handle this)
      // For now, we process the last payment method used
      // TODO: Backend should be updated to accept array of payments
    );

    // Clear payment session state
    widget.table.activePaymentType = null;
    widget.table.paymentsMadeInSession = 0;
    widget.table.originalSplitCountInSession = null;

    // Close screen and show success
    widget.onComplete();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: EmpireColors.successGreen,
          content: Text(
            'División completada: $_splitCount pagos registrados para la Mesa ${widget.table.label}',
          ),
        ),
      );
    }
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
                  // Left: Configuration and progress
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
                'División Equitativa',
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
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Configuración',
            style: TextStyle(
              color: EmpireColors.textGold,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          _buildSplitCountSelector(),
          const SizedBox(height: 30),
          const Text(
            'Progreso de Pagos',
            style: TextStyle(
              color: EmpireColors.textGold,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          Expanded(child: _buildPaymentProgress()),
        ],
      ),
    );
  }

  Widget _buildSplitCountSelector() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Número de Personas:',
            style: TextStyle(
              color: EmpireColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: _currentStep > 0 ? null : () => _updateSplitCount(_splitCount - 1),
                icon: const Icon(Icons.remove_circle_outline),
                color: _currentStep > 0 ? EmpireColors.textSecondary : EmpireColors.champagneGold,
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(
                  color: EmpireColors.onyxSurface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$_splitCount',
                  style: const TextStyle(
                    color: EmpireColors.champagneGold,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton(
                onPressed: _currentStep > 0 ? null : () => _updateSplitCount(_splitCount + 1),
                icon: const Icon(Icons.add_circle_outline),
                color: _currentStep > 0 ? EmpireColors.textSecondary : EmpireColors.champagneGold,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _customPersonAmounts.isNotEmpty
                    ? 'División ajustada manualmente'
                    : 'Monto equitativo: \$${getPersonAmount(0).toStringAsFixed(2)} c/u',
                style: const TextStyle(
                  color: EmpireColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              if (_customPersonAmounts.isNotEmpty && _currentStep == 0)
                GestureDetector(
                  onTap: _resetEqualDivision,
                  child: const Text(
                    'Restablecer',
                    style: TextStyle(
                      color: EmpireColors.warningOrange,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentProgress() {
    return ListView.builder(
      itemCount: _splitCount,
      itemBuilder: (context, index) {
        final isCompleted = index < _currentStep;
        final isCurrent = index == _currentStep;
        final payment = _payments[index];
        final personAmount = getPersonAmount(index);
        final isCustom = _customPersonAmounts.containsKey(index);

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isCurrent
                ? EmpireColors.champagneGold.withValues(alpha: 0.2)
                : EmpireColors.charcoalSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isCurrent
                  ? EmpireColors.champagneGold
                  : (isCompleted ? EmpireColors.successGreen : EmpireColors.agedBronzeDark),
              width: isCurrent ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                isCompleted ? Icons.check_circle : (isCurrent ? Icons.radio_button_checked : Icons.radio_button_unchecked),
                color: isCompleted
                    ? EmpireColors.successGreen
                    : (isCurrent ? EmpireColors.champagneGold : EmpireColors.textSecondary),
                size: 24,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Persona ${index + 1}',
                          style: TextStyle(
                            color: isCurrent ? EmpireColors.champagneGold : EmpireColors.textPrimary,
                            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                            fontSize: 13,
                          ),
                        ),
                        if (isCustom) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: EmpireColors.champagneGold.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'AJUSTADO',
                              style: TextStyle(
                                color: EmpireColors.champagneGold,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (isCompleted) ...[
                      const SizedBox(height: 4),
                      Text(
                        payment.paymentMethod == 'Efectivo'
                            ? 'Efectivo: \$${payment.cashReceived!.toStringAsFixed(2)}'
                            : 'Tarjeta: ${payment.cardRefCode}',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              // Amount display & edit chip
              InkWell(
                onTap: isCompleted ? null : () => _showOverrideAmountDialog(index),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isCustom
                        ? EmpireColors.champagneGold.withOpacity(0.2)
                        : EmpireColors.onyxSurface,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isCustom
                          ? EmpireColors.champagneGold
                          : EmpireColors.agedBronzeDark,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '\$${personAmount.toStringAsFixed(2)}',
                        style: TextStyle(
                          color: isCustom
                              ? EmpireColors.champagneGold
                              : EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.edit,
                        size: 12,
                        color: isCustom
                            ? EmpireColors.champagneGold
                            : EmpireColors.textSecondary,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRightPanel() {
    return Container(
      color: EmpireColors.onyxSurface,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Pago ${_currentStep + 1} de $_splitCount',
            style: const TextStyle(
              color: EmpireColors.champagneGold,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
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
          _buildNavigationButtons(),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelector() {
    final currentPayment = _payments[_currentStep];

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
                selected: currentPayment.paymentMethod == 'Efectivo',
                onSelected: (selected) {
                  if (selected) {
                    setState(() {
                      currentPayment.paymentMethod = 'Efectivo';
                    });
                  }
                },
                selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
                backgroundColor: EmpireColors.charcoalSurface,
                labelStyle: TextStyle(
                  color: currentPayment.paymentMethod == 'Efectivo'
                      ? EmpireColors.champagneGold
                      : EmpireColors.textPrimary,
                ),
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
                selected: currentPayment.paymentMethod == 'Tarjeta',
                onSelected: (selected) {
                  if (selected) {
                    setState(() {
                      currentPayment.paymentMethod = 'Tarjeta';
                    });
                  }
                },
                selectedColor: EmpireColors.champagneGold.withValues(alpha: 0.3),
                backgroundColor: EmpireColors.charcoalSurface,
                labelStyle: TextStyle(
                  color: currentPayment.paymentMethod == 'Tarjeta'
                      ? EmpireColors.champagneGold
                      : EmpireColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPaymentInputs() {
    final currentPayment = _payments[_currentStep];

    if (currentPayment.paymentMethod == 'Efectivo') {
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
    final target = _currentAmountToPay;
    final cashReceived = double.tryParse(_cashController.text) ?? 0.0;
    final cashChange = cashReceived > target ? cashReceived - target : 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Column(
        children: [
          _buildSummaryRow('Monto a pagar:', '\$${target.toStringAsFixed(2)}', isTotal: true),
          if (_payments[_currentStep].paymentMethod == 'Efectivo' && cashReceived > 0) ...[
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

  Widget _buildNavigationButtons() {
    return Row(
      children: [
        if (_currentStep > 0)
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _previousStep,
              icon: const Icon(Icons.arrow_back),
              label: const Text('Anterior'),
              style: OutlinedButton.styleFrom(
                foregroundColor: EmpireColors.textGold,
                side: const BorderSide(color: EmpireColors.agedBronzeDark),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        if (_currentStep > 0) const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: ElevatedButton.icon(
            onPressed: () {
              if (_validateCurrentPayment()) {
                _nextStep();
              }
            },
            icon: Icon(_isLastPayment ? Icons.check : Icons.arrow_forward),
            label: Text(
              _isLastPayment ? 'FINALIZAR PAGO' : 'SIGUIENTE',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _isLastPayment ? EmpireColors.successGreen : EmpireColors.champagneGold,
              foregroundColor: EmpireColors.obsidian,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
      ],
    );
  }
}
