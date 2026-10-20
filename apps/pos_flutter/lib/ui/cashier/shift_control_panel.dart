import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class ShiftControlPanel extends StatefulWidget {
  final AppState state;

  const ShiftControlPanel({super.key, required this.state});

  @override
  State<ShiftControlPanel> createState() => _ShiftControlPanelState();
}

class _ShiftControlPanelState extends State<ShiftControlPanel> {
  final TextEditingController _floatController = TextEditingController();
  final TextEditingController _dropController = TextEditingController();
  final TextEditingController _dropNoteController = TextEditingController();
  final TextEditingController _closeNotesController = TextEditingController();
  final Map<double, TextEditingController> _denominationControllers = {
    for (final value in _denominations) value: TextEditingController(),
  };

  static const List<double> _denominations = [
    1000,
    500,
    200,
    100,
    50,
    20,
    10,
    5,
    2,
    1,
    0.5,
  ];

  @override
  void dispose() {
    _floatController.dispose();
    _dropController.dispose();
    _dropNoteController.dispose();
    _closeNotesController.dispose();
    for (final controller in _denominationControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  double _money(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  Map<String, dynamic> _summary(Map<String, dynamic> report) {
    final raw = report['summary'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return report;
  }

  double _countedCashFromDenominations() {
    return _denominationControllers.entries.fold<double>(0.0, (sum, entry) {
      final count = int.tryParse(entry.value.text.trim()) ?? 0;
      return sum + (entry.key * count);
    });
  }

  Map<String, num> _denominationCounts() {
    final counts = <String, num>{};
    for (final entry in _denominationControllers.entries) {
      final count = int.tryParse(entry.value.text.trim()) ?? 0;
      if (count > 0) {
        final key = entry.key == entry.key.roundToDouble()
            ? entry.key.toInt().toString()
            : entry.key.toString();
        counts[key] = count;
      }
    }
    return counts;
  }

  void _clearCloseInputs() {
    for (final controller in _denominationControllers.values) {
      controller.clear();
    }
    _closeNotesController.clear();
  }

  String _formatCorteReport(
    String title,
    Map<String, dynamic> report, {
    bool includeCounted = false,
  }) {
    final summary = _summary(report);
    final shiftInfo = report['shiftInfo'] is Map
        ? Map<String, dynamic>.from(report['shiftInfo'])
        : <String, dynamic>{};
    final movements = report['cashMovements'] is List
        ? List<dynamic>.from(report['cashMovements'])
        : report['transactions'] is List
            ? List<dynamic>.from(report['transactions'])
            : const <dynamic>[];
    final denominations = report['denominationCounts'] is Map
        ? Map<String, dynamic>.from(report['denominationCounts'])
        : _denominationCounts();
    final notes =
        (report['closeNotes'] ?? _closeNotesController.text).toString().trim();

    final buffer = StringBuffer();
    buffer.writeln(title);
    buffer.writeln('Fecha: ${DateTime.now().toLocal()}');
    buffer.writeln('Operador: ${widget.state.currentUserName}');
    if (shiftInfo['branchName'] != null) {
      buffer.writeln('Sucursal: ${shiftInfo['branchName']}');
    }
    if (shiftInfo['openedAt'] != null) {
      buffer.writeln('Apertura: ${shiftInfo['openedAt']}');
    }
    if (shiftInfo['closedAt'] != null) {
      buffer.writeln('Cierre: ${shiftInfo['closedAt']}');
    }
    buffer.writeln('');
    buffer.writeln('VENTAS');
    buffer.writeln(
        'Efectivo: \$${_money(summary['cashSales']).toStringAsFixed(2)}');
    buffer.writeln(
        'Tarjeta: \$${_money(summary['cardSales']).toStringAsFixed(2)}');
    buffer.writeln(
        'Otros: \$${_money(summary['otherSales']).toStringAsFixed(2)}');
    buffer.writeln(
        'Total ventas: \$${_money(summary['totalSales']).toStringAsFixed(2)}');
    buffer.writeln('');
    buffer.writeln('EFECTIVO EN CAJA');
    buffer.writeln(
        'Fondo inicial: \$${_money(summary['initialFloat']).toStringAsFixed(2)}');
    buffer.writeln(
        'Ventas efectivo: \$${_money(summary['cashSales']).toStringAsFixed(2)}');
    buffer.writeln(
        'Ingresos: \$${_money(summary['manualCashIn']).toStringAsFixed(2)}');
    buffer.writeln(
        'Retiros: \$${_money(summary['manualCashOut']).toStringAsFixed(2)}');
    buffer.writeln(
        'Esperado sistema: \$${_money(summary['expectedCash']).toStringAsFixed(2)}');
    if (includeCounted) {
      buffer.writeln(
          'Contado fisico: \$${_money(summary['actualCash']).toStringAsFixed(2)}');
      buffer.writeln(
          'Diferencia: \$${_money(summary['cashDifference']).toStringAsFixed(2)}');
    }
    if (denominations.isNotEmpty) {
      buffer.writeln('');
      buffer.writeln('DENOMINACIONES');
      denominations.forEach((value, count) {
        final subtotal = _money(value) * _money(count);
        buffer.writeln('\$$value x $count = \$${subtotal.toStringAsFixed(2)}');
      });
    }
    if (movements.isNotEmpty) {
      buffer.writeln('');
      buffer.writeln('MOVIMIENTOS');
      for (final raw in movements) {
        if (raw is! Map) continue;
        final movement = Map<String, dynamic>.from(raw);
        final type = movement['type']?.toString() ?? '';
        final reason = movement['reason']?.toString() ?? '';
        buffer.writeln(
            '$type \$${_money(movement['amount']).toStringAsFixed(2)} - $reason');
      }
    }
    if (notes.isNotEmpty) {
      buffer.writeln('');
      buffer.writeln('NOTAS');
      buffer.writeln(notes);
    }
    return buffer.toString();
  }

  void _openShift() async {
    final double? amount = double.tryParse(_floatController.text);
    if (amount != null && amount >= 0) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(color: EmpireColors.champagneGold),
        ),
      );

      final success = await widget.state.openShift(amount);

      if (mounted) {
        Navigator.of(context).pop();
      }

      if (success) {
        _floatController.clear();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: EmpireColors.successGreen,
              content: Text('¡Turno de caja abierto con éxito!'),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: EmpireColors.errorRed,
              content: Text(
                widget.state.lastShiftError ??
                    'Error al abrir el turno de caja. Valida tu conexión.',
              ),
            ),
          );
        }
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: EmpireColors.errorRed,
          content: Text('Por favor, ingresa un monto válido.'),
        ),
      );
    }
  }

  void _performCashDrop(bool isAdd) async {
    final double? amount = double.tryParse(_dropController.text);
    if (amount != null && amount > 0) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(color: EmpireColors.champagneGold),
        ),
      );

      final String userNote = _dropNoteController.text.trim();
      final String reasonBase =
          isAdd ? 'Ingreso de caja manual' : 'Retiro de caja manual';
      final String reason =
          userNote.isEmpty ? reasonBase : '$reasonBase: $userNote';
      final bool success = isAdd
          ? await widget.state.addCashDrop(amount, reason: reason)
          : await widget.state.removeCashDrop(amount, reason: reason);

      if (mounted) {
        Navigator.of(context).pop();
      }

      if (success) {
        _dropController.clear();
        _dropNoteController.clear();
        if (mounted) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: EmpireColors.successGreen,
              content: Text(
                'Transacción de caja realizada: \$${amount.toStringAsFixed(2)}',
              ),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: EmpireColors.errorRed,
              content: Text(
                widget.state.lastShiftError ??
                    'Error al registrar transacción. Valida tu conexión.',
              ),
            ),
          );
        }
      }
    }
  }

  void _showDropDialog(bool isAdd) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EmpireColors.obsidian,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
        ),
        title: Text(
          isAdd
              ? 'Ingreso de Efectivo (Cash-in)'
              : 'Retiro de Efectivo (Cash-out)',
          style: const TextStyle(
            color: EmpireColors.champagneGold,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _dropController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Monto en \$',
                hintText: '0.00',
              ),
              style: const TextStyle(color: EmpireColors.textPrimary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _dropNoteController,
              decoration: InputDecoration(
                labelText: 'Nota (opcional)',
                hintText: isAdd ? 'Ej: Cambio de billetes' : 'Ej: Pago a proveedor',
              ),
              style: const TextStyle(color: EmpireColors.textPrimary),
              maxLength: 200,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text(
              'CANCELAR',
              style: TextStyle(color: EmpireColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () => _performCashDrop(isAdd),
            child: const Text('CONFIRMAR'),
          ),
        ],
      ),
    );
  }

  void _showCierreDialog() async {
    final shiftId = widget.state.activeShiftId;
    Map<String, dynamic>? auditData;
    if (shiftId != null) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(color: EmpireColors.champagneGold),
        ),
      );
      auditData = await widget.state.getCashShiftAuditReport(shiftId);
      if (mounted) Navigator.of(context).pop();
    }
    if (!mounted) return;

    final expectedCash = _money(_summary(auditData ?? {})['expectedCash']);

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final countedCash = _countedCashFromDenominations();
          final difference = countedCash - expectedCash;
          return AlertDialog(
            backgroundColor: EmpireColors.obsidian,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: EmpireColors.errorRed, width: 1.5),
            ),
            title: const Text(
              'Cierre de Caja (Corte Z)',
              style: TextStyle(
                color: EmpireColors.champagneGold,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            content: SizedBox(
              width: 460,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Efectivo esperado por sistema: \$${expectedCash.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Efectivo contado: \$${countedCash.toStringAsFixed(2)}',
                      style: const TextStyle(color: EmpireColors.textPrimary),
                    ),
                    Text(
                      'Diferencia: \$${difference.toStringAsFixed(2)}',
                      style: TextStyle(
                        color: difference.abs() < 0.01
                            ? EmpireColors.successGreen
                            : EmpireColors.errorRed,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Denominaciones',
                      style: TextStyle(
                        color: EmpireColors.textSecondary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ..._denominations.map(
                      (value) {
                        final controller = _denominationControllers[value]!;
                        final count = int.tryParse(controller.text.trim()) ?? 0;
                        final subtotal = value * count;
                        final label = value == value.roundToDouble()
                            ? '\$${value.toInt()}'
                            : '\$${value.toStringAsFixed(1)}';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            children: [
                              // Denomination label
                              SizedBox(
                                width: 48,
                                child: Text(
                                  label,
                                  style: const TextStyle(
                                    color: EmpireColors.champagneGold,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                              // Minus button
                              _DenomButton(
                                icon: Icons.remove,
                                onTap: () {
                                  if (count > 0) {
                                    controller.text = (count - 1).toString();
                                    setDialogState(() {});
                                  }
                                },
                              ),
                              const SizedBox(width: 4),
                              // Count input
                              SizedBox(
                                width: 64,
                                child: TextField(
                                  controller: controller,
                                  textAlign: TextAlign.center,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [
                                    FilteringTextInputFormatter.digitsOnly,
                                  ],
                                  onChanged: (_) => setDialogState(() {}),
                                  decoration: const InputDecoration(
                                    hintText: '0',
                                    isDense: true,
                                    contentPadding: EdgeInsets.symmetric(
                                      vertical: 10,
                                      horizontal: 6,
                                    ),
                                  ),
                                  style: TextStyle(
                                    color: count > 0
                                        ? EmpireColors.textPrimary
                                        : EmpireColors.textSecondary,
                                    fontWeight: count > 0
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              // Plus button
                              _DenomButton(
                                icon: Icons.add,
                                onTap: () {
                                  controller.text = (count + 1).toString();
                                  setDialogState(() {});
                                },
                              ),
                              const SizedBox(width: 8),
                              // Subtotal for this denomination
                              Expanded(
                                child: Text(
                                  '= \$${subtotal.toStringAsFixed(2)}',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                    color: count > 0
                                        ? EmpireColors.textPrimary
                                        : EmpireColors.textSecondary
                                            .withValues(alpha: 0.4),
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _closeNotesController,
                      maxLines: 3,
                      maxLength: 500,
                      decoration: const InputDecoration(
                        labelText: 'Notas de cierre',
                        hintText: 'Observaciones, faltantes, sobrantes...',
                      ),
                      style: const TextStyle(color: EmpireColors.textPrimary),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text(
                  'CANCELAR',
                  style: TextStyle(color: EmpireColors.textSecondary),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  _performCierre(
                    countedCash,
                    denominationCounts: _denominationCounts(),
                    closeNotes: _closeNotesController.text,
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: EmpireColors.errorRed,
                ),
                child: const Text('CERRAR CAJA'),
              ),
            ],
          );
        },
      ),
    );
  }

  void _performCierre(
    double actualAmount, {
    Map<String, num>? denominationCounts,
    String? closeNotes,
  }) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: EmpireColors.champagneGold),
      ),
    );

    final Map<String, dynamic>? report = await widget.state.closeShift(
      actualAmount,
      denominationCounts: denominationCounts,
      closeNotes: closeNotes,
    );

    if (mounted) {
      Navigator.of(context).pop();
    }

    if (report != null) {
      final reportDetails = _formatCorteReport(
        'Corte Z - Cierre de Caja',
        report,
        includeCounted: true,
      );
      _clearCloseInputs();

      unawaited(widget.state.enqueueCajaPrintJob(
        PrintJob(
          id: 'report_z_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Corte Z - Cierre de Caja',
          details: reportDetails,
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      ));

      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: EmpireColors.obsidian,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(
                color: EmpireColors.champagneGold,
                width: 1.5,
              ),
            ),
            title: const Text(
              'Resumen de Cierre de Caja (Corte Z)',
              style: TextStyle(
                color: EmpireColors.champagneGold,
                fontWeight: FontWeight.bold,
              ),
            ),
            content: SingleChildScrollView(
              child: Text(
                reportDetails,
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  height: 1.6,
                ),
              ),
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('ENTENDIDO'),
              ),
            ],
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: EmpireColors.errorRed,
            content: Text(
              widget.state.lastShiftError ?? 'Error al cerrar el turno de caja.',
            ),
          ),
        );
      }
    }
  }

  void _printCorteX() async {
    final shiftId = widget.state.activeShiftId;
    if (shiftId == null) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: EmpireColors.champagneGold),
      ),
    );

    final Map<String, dynamic>? auditData =
        await widget.state.getCashShiftAuditReport(shiftId);

    if (mounted) {
      Navigator.of(context).pop();
    }

    if (auditData != null) {
      final reportDetails = _formatCorteReport(
        'Corte X - Arqueo Parcial',
        auditData,
      );

      unawaited(widget.state.enqueueCajaPrintJob(
        PrintJob(
          id: 'report_x_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Corte X - Resumen Parcial',
          details: reportDetails,
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      ));

      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: EmpireColors.obsidian,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(
                  color: EmpireColors.champagneGold, width: 1.5),
            ),
            title: const Text(
              'Resumen de Turno Parcial (Corte X)',
              style: TextStyle(
                color: EmpireColors.champagneGold,
                fontWeight: FontWeight.bold,
              ),
            ),
            content: SingleChildScrollView(
              child: Text(
                reportDetails,
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  height: 1.6,
                ),
              ),
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('ENTENDIDO'),
              ),
            ],
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: EmpireColors.errorRed,
            content: Text('Error al obtener reporte de caja parcial.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.state.isShiftOpen) {
      return Container(
        padding: const EdgeInsets.all(24),
        color: EmpireColors.onyxSurface,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.lock_outline,
              color: EmpireColors.champagneGold,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(
              'Caja Cerrada'.toUpperCase(),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: EmpireColors.champagneGold,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Debes registrar el fondo fijo inicial para abrir turno e iniciar facturaciones.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: EmpireColors.textSecondary,
                fontSize: 12,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _floatController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Monto Inicial',
                hintText: 'e.g. 1000.00',
                prefixText: '\$ ',
              ),
              style: const TextStyle(color: EmpireColors.textPrimary),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _openShift,
              child: const Text('ABRIR TURNO / CAJA'),
            ),
          ],
        ),
      );
    }

    return Container(
      color: EmpireColors.onyxSurface,
      padding: const EdgeInsets.all(20),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Shift details
            Text(
              'Turno de Caja',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: EmpireColors.champagneGold,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 20),

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
                  const Text(
                    'SALDO EN CAJA',
                    style: TextStyle(
                      color: EmpireColors.textSecondary,
                      fontSize: 10,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '\$${widget.state.cashDrawerAmount.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: EmpireColors.champagneGold,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Cajero: ${widget.state.currentUserName}',
                    style: const TextStyle(
                      color: EmpireColors.textPrimary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Cash Flow Actions
            const Text(
              'MOVIMIENTOS DE CAJA',
              style: TextStyle(
                color: EmpireColors.textGold,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () => _showDropDialog(true),
              icon: const Icon(Icons.arrow_downward, size: 16),
              label: const Text('INGRESO (CASH-IN)'),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.successGreen.withOpacity(0.8),
                foregroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () => _showDropDialog(false),
              icon: const Icon(Icons.arrow_upward, size: 16),
              label: const Text('RETIRO (CASH-OUT)'),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.errorRed.withOpacity(0.8),
                foregroundColor: Colors.white,
              ),
            ),

            const SizedBox(height: 24),

            // Z / X Reports
            const Text(
              'CORTES PARCIALES / FINALES',
              style: TextStyle(
                color: EmpireColors.textSecondary,
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _printCorteX,
              child: const Text('CORTEX (PARCIAL)'),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _showCierreDialog,
              style: OutlinedButton.styleFrom(
                foregroundColor: EmpireColors.errorRed,
                side: const BorderSide(
                  color: EmpireColors.errorRed,
                  width: 1.2,
                ),
              ),
              child: const Text('CORTE Z (CIERRE DE CAJA)'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DenomButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _DenomButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: EmpireColors.agedBronze.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: EmpireColors.agedBronze.withValues(alpha: 0.4),
          ),
        ),
        child: Icon(
          icon,
          size: 18,
          color: EmpireColors.champagneGold,
        ),
      ),
    );
  }
}
