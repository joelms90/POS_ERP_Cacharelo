import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../common/app_state.dart';
import '../common/colors.dart';

class EncargadoCajaTab extends StatefulWidget {
  final AppState state;

  const EncargadoCajaTab({super.key, required this.state});

  @override
  State<EncargadoCajaTab> createState() => _EncargadoCajaTabState();
}

class _EncargadoCajaTabState extends State<EncargadoCajaTab> {
  int _activeSubView = 0; // 0: Control de Caja, 1: Órdenes Cobradas
  bool _loadingTickets = false;
  List<Map<String, dynamic>> _tickets = [];
  String _selectedPaymentFilter = 'TODOS'; // 'TODOS', 'cash', 'card'

  // Controllers for shift opening & drop
  final TextEditingController _floatController = TextEditingController();
  final TextEditingController _dropController = TextEditingController();
  final TextEditingController _dropNoteController = TextEditingController();
  final TextEditingController _closeNotesController = TextEditingController();

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

  final Map<double, TextEditingController> _denominationControllers = {
    for (final value in _denominations) value: TextEditingController(),
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.state.checkActiveShift();
      _loadTickets();
    });
  }

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

  Future<void> _loadTickets() async {
    if (!mounted) return;
    setState(() => _loadingTickets = true);
    final remoteTickets = await widget.state.fetchTodayTickets();
    if (mounted) {
      setState(() {
        _tickets = remoteTickets;
        _loadingTickets = false;
      });
    }
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

  String _formatDateTime(dynamic dateVal) {
    if (dateVal == null) return 'N/A';
    DateTime? dt;
    if (dateVal is DateTime) {
      dt = dateVal.toLocal();
    } else if (dateVal is String) {
      dt = DateTime.tryParse(dateVal)?.toLocal();
    }
    if (dt == null) return dateVal.toString();

    final months = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun',
      'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
    ];
    final day = dt.day.toString().padLeft(2, '0');
    final month = months[dt.month - 1];
    final year = dt.year;
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$day $month $year · $hour:$minute';
  }

  String _formatCorteReport(
    String title,
    Map<String, dynamic> report, {
    bool includeCounted = false,
    bool isCorteX = false,
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
    const divider = '----------------------------------------';
    const doubleDivider = '========================================';

    final shiftId =
        (shiftInfo['id'] ?? widget.state.activeShiftId ?? '').toString();
    final folio =
        shiftId.length > 8 ? shiftId.substring(0, 8).toUpperCase() : shiftId;
    final branchName = shiftInfo['branchName'] ??
        widget.state.terminalBranchName ??
        'Sucursal';
    final cashierName = shiftInfo['cashierName'] ??
        widget.state.currentUserName ??
        'Operador';
    final stationId = widget.state.localStationId ?? 'Caja 01';

    buffer.writeln(doubleDivider);
    buffer.writeln(widget.state.formatCenter('CACHARELO POS'));
    buffer.writeln(widget.state.formatCenter(title));
    if (isCorteX) {
      buffer.writeln(
          widget.state.formatCenter('Reporte Informativo · Sin Cierre'));
    }
    buffer.writeln(doubleDivider);

    buffer.writeln(
        'Estado: ${isCorteX ? 'Turno Abierto (En Operación)' : 'Turno Cerrado'}');
    if (folio.isNotEmpty) buffer.writeln('Folio Turno: #$folio');
    buffer.writeln('Caja: $stationId');
    buffer.writeln('Sucursal: $branchName');
    buffer.writeln('Cajero de turno: $cashierName');
    buffer.writeln('Generado por: ${widget.state.currentUserName}');
    if (shiftInfo['openedAt'] != null) {
      buffer.writeln('Apertura: ${_formatDateTime(shiftInfo['openedAt'])}');
    }
    if (isCorteX) {
      buffer.writeln('Fecha consulta: ${_formatDateTime(DateTime.now())}');
    } else if (shiftInfo['closedAt'] != null) {
      buffer.writeln('Cierre: ${_formatDateTime(shiftInfo['closedAt'])}');
    } else {
      buffer.writeln('Fecha reporte: ${_formatDateTime(DateTime.now())}');
    }

    buffer.writeln('');
    buffer.writeln(divider);
    buffer.writeln('RESUMEN DE VENTAS');
    buffer.writeln(divider);
    buffer.writeln(widget.state.formatRow(
        'Efectivo:', '\$${_money(summary['cashSales']).toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatRow(
        'Tarjeta:', '\$${_money(summary['cardSales']).toStringAsFixed(2)}'));
    if (_money(summary['otherSales']) > 0) {
      buffer.writeln(widget.state.formatRow(
          'Otros:', '\$${_money(summary['otherSales']).toStringAsFixed(2)}'));
    }
    buffer.writeln(divider);
    buffer.writeln(widget.state.formatRow(
        'TOTAL VENTAS:', '\$${_money(summary['totalSales']).toStringAsFixed(2)}'));
    buffer.writeln(divider);

    buffer.writeln('');
    buffer.writeln(divider);
    buffer.writeln('CONTROL DE EFECTIVO EN CAJA');
    buffer.writeln(divider);
    buffer.writeln(widget.state.formatRow(
        'Fondo inicial:', '\$${_money(summary['initialFloat']).toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatRow('Ventas en efectivo:',
        '+\$${_money(summary['cashSales']).toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatRow('Ingresos de caja:',
        '+\$${_money(summary['manualCashIn']).toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatRow('Retiros de caja:',
        '-\$${_money(summary['manualCashOut']).toStringAsFixed(2)}'));
    buffer.writeln(divider);
    buffer.writeln(widget.state.formatRow('EFECTIVO ESPERADO:',
        '\$${_money(summary['expectedCash']).toStringAsFixed(2)}'));

    if (includeCounted) {
      buffer.writeln(widget.state.formatRow('Efectivo contado:',
          '\$${_money(summary['actualCash']).toStringAsFixed(2)}'));
      buffer.writeln(divider);
      final expected = _money(summary['expectedCash']);
      final diff = _money(summary['cashDifference']);
      final diffLabel = expected < -0.01
          ? '(+\$${diff.toStringAsFixed(2)} Requiere Conciliación)'
          : diff.abs() < 0.01
              ? '(\$0.00 Cuadrado)'
              : diff > 0
                  ? '(+\$${diff.toStringAsFixed(2)} Sobrante)'
                  : '(-\$${diff.abs().toStringAsFixed(2)} Faltante)';
      buffer.writeln(widget.state.formatRow('DIFERENCIA:', diffLabel));
      buffer.writeln(divider);
    }

    if (includeCounted && denominations.isNotEmpty) {
      buffer.writeln('');
      buffer.writeln(divider);
      buffer.writeln('CONTEO DE DENOMINACIONES');
      buffer.writeln(divider);
      denominations.forEach((value, count) {
        final c = int.tryParse(count.toString()) ?? 0;
        if (c > 0) {
          final subtotal = _money(value) * c;
          buffer.writeln(widget.state
              .formatRow('\$$value x $c', '=\$${subtotal.toStringAsFixed(2)}'));
        }
      });
    }

    if (movements.isNotEmpty) {
      buffer.writeln('');
      buffer.writeln(divider);
      buffer.writeln('MOVIMIENTOS DE CAJA');
      buffer.writeln(divider);
      for (final raw in movements) {
        if (raw is! Map) continue;
        final movement = Map<String, dynamic>.from(raw);
        final rawType = movement['type']?.toString().toLowerCase() ?? '';
        final isAdd = rawType == 'cash-in';
        final typeLabel = isAdd ? 'Ingreso' : 'Retiro';
        final sign = isAdd ? '+' : '-';
        String reason = (movement['reason']?.toString() ?? 'Manual').trim();
        reason = reason
            .replaceFirst(
                RegExp(r'^(Ingreso|Retiro) de caja manual:?\s*',
                    caseSensitive: false),
                '')
            .trim();
        if (reason.isEmpty) {
          reason = isAdd ? 'Ingreso general' : 'Retiro general';
        }
        final amt = '$sign\$${_money(movement['amount']).toStringAsFixed(2)}';
        buffer.writeln(widget.state.formatRow('$typeLabel · $reason', amt));
      }
    }

    if (notes.isNotEmpty) {
      buffer.writeln('');
      buffer.writeln(divider);
      buffer.writeln('OBSERVACIONES');
      buffer.writeln(notes);
    }

    buffer.writeln('');
    buffer.writeln(doubleDivider);
    if (isCorteX) {
      buffer.writeln(widget.state.formatCenterLines(
          '* Corte informativo de consulta.\nNo se ha realizado conteo físico\nni cierre de caja registradora.'));
    } else {
      buffer.writeln(widget.state.formatCenterLines(
          '* Cierre registrado y auditado.\nComprobante oficial de turno.'));
    }
    buffer.writeln(doubleDivider);
    return buffer.toString();
  }

  void _openShift() async {
    final double? amount = double.tryParse(_floatController.text.trim());
    if (amount != null && amount >= 0) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(color: EmpireColors.champagneGold),
        ),
      );

      final success = await widget.state.openShift(amount);

      if (mounted) Navigator.of(context).pop();

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

  void _performCashDrop(bool isAdd, String category) async {
    final double? amount = double.tryParse(_dropController.text.trim());
    if (amount != null && amount > 0) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(color: EmpireColors.champagneGold),
        ),
      );

      final String userNote = _dropNoteController.text.trim();
      final String reason =
          userNote.isEmpty ? category : '$category: $userNote';
      final bool success = isAdd
          ? await widget.state.addCashDrop(amount, reason: reason)
          : await widget.state.removeCashDrop(amount, reason: reason);

      if (mounted) Navigator.of(context).pop();

      if (success) {
        _dropController.clear();
        _dropNoteController.clear();
        if (mounted) {
          Navigator.of(context).pop(); // Close dialog
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
    String selectedCategory = isAdd ? 'Aporte de cambio' : 'Gasto operativo';
    final categories = isAdd
        ? [
            'Aporte de cambio',
            'Reposición de fondo de caja',
            'Corrección de movimiento',
            'Otro ingreso',
          ]
        : [
            'Gasto operativo',
            'Entrega a encargado / Retiro parcial',
            'Transferencia a otra caja',
            'Corrección de movimiento',
            'Otro retiro',
          ];

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: EmpireColors.obsidian,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
          ),
          title: Text(
            isAdd
                ? 'Ingreso de Efectivo a Caja'
                : 'Retiro de Efectivo de Caja',
            style: const TextStyle(
              color: EmpireColors.champagneGold,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DropdownButtonFormField<String>(
                initialValue: selectedCategory,
                dropdownColor: EmpireColors.charcoalSurface,
                decoration: const InputDecoration(
                  labelText: 'Clasificación / Concepto',
                ),
                style: const TextStyle(
                    color: EmpireColors.textPrimary, fontSize: 13),
                items: categories.map((cat) {
                  return DropdownMenuItem<String>(
                    value: cat,
                    child: Text(cat,
                        style:
                            const TextStyle(color: EmpireColors.textPrimary)),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setDialogState(() => selectedCategory = val);
                  }
                },
              ),
              const SizedBox(height: 12),
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
                  labelText: 'Detalle / Observaciones (opcional)',
                  hintText: isAdd
                      ? 'Ej: Billetes de 20 para cambio'
                      : 'Ej: Pago de recibo de luz CFE',
                ),
                style: const TextStyle(color: EmpireColors.textPrimary),
                maxLength: 200,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('CANCELAR',
                  style: TextStyle(color: EmpireColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () => _performCashDrop(isAdd, selectedCategory),
              style: ElevatedButton.styleFrom(
                backgroundColor: isAdd
                    ? EmpireColors.successGreen
                    : EmpireColors.warningOrange,
              ),
              child: const Text('CONFIRMAR'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCorteX() async {
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

    if (mounted) Navigator.of(context).pop();

    if (auditData != null) {
      final reportDetails = _formatCorteReport(
        'CORTE X (REPORTE INFORMATIVO)',
        auditData,
        isCorteX: true,
      );

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
            title: const Row(
              children: [
                Icon(Icons.assessment_outlined,
                    color: EmpireColors.champagneGold),
                SizedBox(width: 8),
                Text(
                  'Corte X (Reporte Informativo)',
                  style: TextStyle(
                    color: EmpireColors.champagneGold,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Text(
                reportDetails,
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('CERRAR',
                    style: TextStyle(color: EmpireColors.textSecondary)),
              ),
              ElevatedButton.icon(
                onPressed: () {
                  unawaited(widget.state.enqueueCajaPrintJob(
                    PrintJob(
                      id: 'report_x_${DateTime.now().millisecondsSinceEpoch}',
                      title: 'Corte X - Reporte Informativo',
                      details: reportDetails,
                      target: 'Caja',
                      timestamp: DateTime.now(),
                    ),
                  ));
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: EmpireColors.successGreen,
                      content: Text('Ticket de Corte X enviado a la impresora.'),
                    ),
                  );
                },
                icon: const Icon(Icons.print, size: 16),
                label: const Text('IMPRIMIR TICKET'),
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

  void _showArqueoDialog() async {
    final shiftId = widget.state.activeShiftId;
    if (shiftId == null) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: EmpireColors.champagneGold),
      ),
    );
    final auditData = await widget.state.getCashShiftAuditReport(shiftId);
    if (mounted) Navigator.of(context).pop();
    if (!mounted || auditData == null) return;

    final expectedCash = _money(_summary(auditData)['expectedCash']);

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
              side: const BorderSide(
                  color: EmpireColors.champagneGold, width: 1.5),
            ),
            title: const Row(
              children: [
                Icon(Icons.fact_check_outlined,
                    color: EmpireColors.champagneGold),
                SizedBox(width: 8),
                Text(
                  'Arqueo de Caja (Verificación Física)',
                  style: TextStyle(
                    color: EmpireColors.champagneGold,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            content: SizedBox(
              width: 480,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: EmpireColors.charcoalSurface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: EmpireColors.agedBronzeDark),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Efectivo Esperado (Sistema):',
                                  style: TextStyle(
                                      color: EmpireColors.textSecondary,
                                      fontSize: 12)),
                              Text(
                                '\$${expectedCash.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  color: EmpireColors.champagneGold,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Efectivo Contado (Físico):',
                                  style: TextStyle(
                                      color: EmpireColors.textSecondary,
                                      fontSize: 12)),
                              Text(
                                '\$${countedCash.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          const Divider(
                              color: EmpireColors.agedBronzeDark, height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Diferencia:',
                                  style: TextStyle(
                                      color: EmpireColors.textPrimary,
                                      fontWeight: FontWeight.bold)),
                              Text(
                                () {
                                  final isNegativeExpected = expectedCash < -0.01;
                                  final diffStr = '${difference >= 0 ? '+' : ''}\$${difference.toStringAsFixed(2)}';
                                  if (isNegativeExpected) {
                                    return '$diffStr (Requiere Conciliación)';
                                  }
                                  if (difference.abs() < 0.01) {
                                    return '\$0.00 (Cuadrado)';
                                  }
                                  return '$diffStr ${difference > 0 ? '(Sobrante)' : '(Faltante)'}';
                                }(),
                                style: TextStyle(
                                  color: expectedCash < -0.01
                                      ? Colors.amber
                                      : difference.abs() < 0.01
                                          ? EmpireColors.successGreen
                                          : difference > 0
                                              ? Colors.blueAccent
                                              : EmpireColors.errorRed,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          if (expectedCash < -0.01) ...[
                            const SizedBox(height: 6),
                            const Text(
                              '⚠️ Saldo teórico negativo. Los retiros registrados superan los fondos disponibles.',
                              style: TextStyle(
                                color: Colors.amber,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'CONTEO DE DENOMINACIONES',
                      style: TextStyle(
                        color: EmpireColors.textGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ..._denominations.map((value) {
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
                            SizedBox(
                              width: 52,
                              child: Text(
                                label,
                                style: const TextStyle(
                                  color: EmpireColors.champagneGold,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
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
                            SizedBox(
                              width: 58,
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
                                      vertical: 8, horizontal: 4),
                                ),
                                style: const TextStyle(
                                    color: EmpireColors.textPrimary,
                                    fontSize: 13),
                              ),
                            ),
                            const SizedBox(width: 4),
                            _DenomButton(
                              icon: Icons.add,
                              onTap: () {
                                controller.text = (count + 1).toString();
                                setDialogState(() {});
                              },
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '= \$${subtotal.toStringAsFixed(2)}',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                  color: count > 0
                                      ? EmpireColors.textPrimary
                                      : EmpireColors.textSecondary
                                          .withValues(alpha: 0.4),
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _closeNotesController,
                      maxLines: 2,
                      maxLength: 300,
                      decoration: const InputDecoration(
                        labelText: 'Notas de Verificación (opcional)',
                        hintText: 'Observaciones del arqueo parcial...',
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
                child: const Text('CANCELAR',
                    style: TextStyle(color: EmpireColors.textSecondary)),
              ),
              ElevatedButton.icon(
                onPressed: () {
                  final reportCopy = Map<String, dynamic>.from(auditData);
                  final summaryCopy =
                      Map<String, dynamic>.from(_summary(reportCopy));
                  summaryCopy['actualCash'] = countedCash;
                  summaryCopy['cashDifference'] = difference;
                  reportCopy['summary'] = summaryCopy;
                  reportCopy['denominationCounts'] = _denominationCounts();
                  reportCopy['closeNotes'] = _closeNotesController.text;

                  final reportDetails = _formatCorteReport(
                    'ARQUEO DE CAJA (VERIFICACIÓN PARCIAL)',
                    reportCopy,
                    includeCounted: true,
                    isCorteX: false,
                  );

                  unawaited(widget.state.enqueueCajaPrintJob(
                    PrintJob(
                      id: 'arqueo_${DateTime.now().millisecondsSinceEpoch}',
                      title: 'Arqueo de Caja - Verificación',
                      details: reportDetails,
                      target: 'Caja',
                      timestamp: DateTime.now(),
                    ),
                  ));

                  Navigator.of(context).pop();

                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      backgroundColor: EmpireColors.obsidian,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(
                            color: EmpireColors.champagneGold, width: 1.5),
                      ),
                      title: const Text('Comprobante de Arqueo Generado',
                          style: TextStyle(
                              color: EmpireColors.champagneGold,
                              fontSize: 16)),
                      content: SingleChildScrollView(
                        child: Text(
                          reportDetails,
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            height: 1.5,
                          ),
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('CERRAR',
                              style: TextStyle(
                                  color: EmpireColors.textSecondary)),
                        ),
                      ],
                    ),
                  );
                },
                icon: const Icon(Icons.print, size: 16),
                label: const Text('IMPRIMIR ARQUEO'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: EmpireColors.champagneGold,
                  foregroundColor: Colors.black,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showCorteZDialog() async {
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
            title: const Row(
              children: [
                Icon(Icons.point_of_sale, color: EmpireColors.champagneGold),
                SizedBox(width: 8),
                Text(
                  'Cierre de Caja (Corte Z)',
                  style: TextStyle(
                    color: EmpireColors.champagneGold,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            content: SizedBox(
              width: 480,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: EmpireColors.charcoalSurface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: EmpireColors.agedBronzeDark),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Efectivo Esperado (Sistema):',
                                  style: TextStyle(
                                      color: EmpireColors.textSecondary,
                                      fontSize: 12)),
                              Text(
                                '\$${expectedCash.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  color: EmpireColors.champagneGold,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Efectivo Contado (Físico):',
                                  style: TextStyle(
                                      color: EmpireColors.textSecondary,
                                      fontSize: 12)),
                              Text(
                                '\$${countedCash.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          const Divider(
                              color: EmpireColors.agedBronzeDark, height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Diferencia:',
                                  style: TextStyle(
                                      color: EmpireColors.textPrimary,
                                      fontWeight: FontWeight.bold)),
                              Text(
                                () {
                                  final isNegativeExpected = expectedCash < -0.01;
                                  final diffStr = '${difference >= 0 ? '+' : ''}\$${difference.toStringAsFixed(2)}';
                                  if (isNegativeExpected) {
                                    return '$diffStr (Requiere Conciliación)';
                                  }
                                  if (difference.abs() < 0.01) {
                                    return '\$0.00 (Cuadrado)';
                                  }
                                  return '$diffStr ${difference > 0 ? '(Sobrante)' : '(Faltante)'}';
                                }(),
                                style: TextStyle(
                                  color: expectedCash < -0.01
                                      ? Colors.amber
                                      : difference.abs() < 0.01
                                          ? EmpireColors.successGreen
                                          : difference > 0
                                              ? Colors.blueAccent
                                              : EmpireColors.errorRed,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                          if (expectedCash < -0.01) ...[
                            const SizedBox(height: 6),
                            const Text(
                              '⚠️ Saldo teórico negativo. Los retiros registrados superan los fondos disponibles.',
                              style: TextStyle(
                                color: Colors.amber,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'CONTEO DE DENOMINACIONES',
                      style: TextStyle(
                        color: EmpireColors.textGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ..._denominations.map((value) {
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
                            SizedBox(
                              width: 52,
                              child: Text(
                                label,
                                style: const TextStyle(
                                  color: EmpireColors.champagneGold,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
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
                            SizedBox(
                              width: 58,
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
                                      vertical: 8, horizontal: 4),
                                ),
                                style: const TextStyle(
                                    color: EmpireColors.textPrimary,
                                    fontSize: 13),
                              ),
                            ),
                            const SizedBox(width: 4),
                            _DenomButton(
                              icon: Icons.add,
                              onTap: () {
                                controller.text = (count + 1).toString();
                                setDialogState(() {});
                              },
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '= \$${subtotal.toStringAsFixed(2)}',
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                  color: count > 0
                                      ? EmpireColors.textPrimary
                                      : EmpireColors.textSecondary
                                          .withValues(alpha: 0.4),
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _closeNotesController,
                      maxLines: 2,
                      maxLength: 300,
                      decoration: const InputDecoration(
                        labelText: 'Notas de Cierre (opcional)',
                        hintText: 'Observaciones, justificación de diferencias...',
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
                child: const Text('CANCELAR',
                    style: TextStyle(color: EmpireColors.textSecondary)),
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
                child: const Text('CONFIRMAR CORTE Z'),
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

    if (mounted) Navigator.of(context).pop();

    if (report != null) {
      final reportDetails = _formatCorteReport(
        'CORTE Z (CIERRE DEFINITIVO)',
        report,
        includeCounted: true,
        isCorteX: false,
      );
      _clearCloseInputs();

      unawaited(widget.state.enqueueCajaPrintJob(
        PrintJob(
          id: 'report_z_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Corte Z - Cierre Definitivo',
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
              'Corte Z Realizado Exitosamente',
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
                  fontSize: 12,
                  height: 1.5,
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

  void _reprintTicket(Map<String, dynamic> ticket) {
    final buffer = StringBuffer();
    buffer.writeln(widget.state.formatCenter('=== COMPROBANTE DE PAGO ==='));
    buffer.writeln(widget.state.formatCenter(
        'Ticket #${ticket['id'].toString().substring(0, 8).toUpperCase()}'));
    buffer.writeln(
        widget.state.formatRow('Mesa/Ref:', ticket['tableLabel'] ?? 'Mostrador'));
    buffer.writeln(widget.state
        .formatRow('Atendido por:', ticket['waiterName'] ?? 'Cajero'));
    buffer.writeln(widget.state
        .formatRow('Fecha:', ticket['createdAt']?.toString().substring(0, 16) ?? ''));
    buffer.writeln(widget.state.formatDivider());

    final items = ticket['items'] as List? ?? [];
    for (final item in items) {
      final qty = item['quantity'] ?? 1;
      final name = item['productName'] ?? 'Producto';
      final price = _money(item['price']);
      buffer.writeln(widget.state
          .formatRow('${qty}x $name', '\$${(qty * price).toStringAsFixed(2)}'));
    }

    buffer.writeln(widget.state.formatDivider());
    buffer.writeln(widget.state.formatRow(
        'Subtotal:', '\$${_money(ticket['subtotal']).toStringAsFixed(2)}'));
    if (_money(ticket['discount']) > 0) {
      buffer.writeln(widget.state.formatRow(
          'Descuento:', '-\$${_money(ticket['discount']).toStringAsFixed(2)}'));
    }
    buffer.writeln(
        widget.state.formatRow('IVA:', '\$${_money(ticket['tax']).toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatRow(
        'TOTAL:', '\$${_money(ticket['total']).toStringAsFixed(2)}'));
    buffer.writeln(widget.state.formatDivider(char: '='));

    final payments = ticket['payments'] as List? ?? [];
    if (payments.isNotEmpty) {
      buffer.writeln('FORMA DE PAGO:');
      for (final p in payments) {
        final method = p['method'] == 'cash'
            ? 'Efectivo'
            : p['method'] == 'card'
                ? 'Tarjeta'
                : 'Otro';
        buffer.writeln(widget.state.formatRow(
            '  $method:', '\$${_money(p['amount']).toStringAsFixed(2)}'));
      }
      buffer.writeln('');
    }

    buffer.writeln(widget.state.formatCenterLines('Gracias por su preferencia'));
    buffer.writeln('');
    buffer.writeln('');

    unawaited(widget.state.enqueueCajaPrintJob(
      PrintJob(
        id: 'reprint_${DateTime.now().millisecondsSinceEpoch}',
        title: 'Reimpresión - ${ticket['tableLabel']}',
        details: buffer.toString(),
        target: 'Caja',
        timestamp: DateTime.now(),
      ),
    ));

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: EmpireColors.successGreen,
        content: Text('Ticket enviado a la impresora.'),
      ),
    );
  }

  void _showTicketDetail(Map<String, dynamic> ticket) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EmpireColors.obsidian,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Ticket #${ticket['id'].toString().substring(0, 8).toUpperCase()}',
              style: const TextStyle(
                color: EmpireColors.champagneGold,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: EmpireColors.champagneGold.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: EmpireColors.champagneGold),
              ),
              child: Text(
                ticket['tableLabel'] ?? 'Mesa',
                style: const TextStyle(
                  color: EmpireColors.champagneGold,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Atendido por: ${ticket['waiterName'] ?? 'Cajero'} · Fecha: ${ticket['createdAt']?.toString().substring(0, 16) ?? ''}',
                  style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
                const Divider(color: EmpireColors.agedBronzeDark, height: 20),
                const Text(
                  'ARTÍCULOS',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                ...((ticket['items'] as List? ?? []).map((item) {
                  final qty = item['quantity'] ?? 1;
                  final price = _money(item['price']);
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${qty}x ',
                            style: const TextStyle(
                                color: EmpireColors.champagneGold,
                                fontWeight: FontWeight.bold)),
                        Expanded(
                          child: Text(item['productName'] ?? 'Producto',
                              style: const TextStyle(
                                  color: EmpireColors.textPrimary)),
                        ),
                        Text(
                          '\$${(qty * price).toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  );
                })),
                const Divider(color: EmpireColors.agedBronzeDark, height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Subtotal:',
                        style: TextStyle(color: EmpireColors.textSecondary)),
                    Text('\$${_money(ticket['subtotal']).toStringAsFixed(2)}',
                        style: const TextStyle(color: EmpireColors.textPrimary)),
                  ],
                ),
                if (_money(ticket['discount']) > 0) ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Descuento:',
                          style: TextStyle(color: EmpireColors.errorRed)),
                      Text('-\$${_money(ticket['discount']).toStringAsFixed(2)}',
                          style: const TextStyle(color: EmpireColors.errorRed)),
                    ],
                  ),
                ],
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('IVA:',
                        style: TextStyle(color: EmpireColors.textSecondary)),
                    Text('\$${_money(ticket['tax']).toStringAsFixed(2)}',
                        style: const TextStyle(color: EmpireColors.textPrimary)),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('TOTAL:',
                        style: TextStyle(
                            color: EmpireColors.champagneGold,
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
                    Text(
                      '\$${_money(ticket['total']).toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
                const Divider(color: EmpireColors.agedBronzeDark, height: 20),
                const Text(
                  'PAGOS REGISTRADOS',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                ...((ticket['payments'] as List? ?? []).map((p) {
                  final method = p['method'] == 'cash'
                      ? 'Efectivo'
                      : p['method'] == 'card'
                          ? 'Tarjeta'
                          : 'Otro';
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              p['method'] == 'cash'
                                  ? Icons.payments_outlined
                                  : Icons.credit_card,
                              size: 16,
                              color: EmpireColors.champagneGold,
                            ),
                            const SizedBox(width: 6),
                            Text(method,
                                style: const TextStyle(
                                    color: EmpireColors.textPrimary,
                                    fontSize: 13)),
                          ],
                        ),
                        Text('\$${_money(p['amount']).toStringAsFixed(2)}',
                            style: const TextStyle(
                                color: EmpireColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 13)),
                      ],
                    ),
                  );
                })),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('CERRAR',
                style: TextStyle(color: EmpireColors.textSecondary)),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.of(context).pop();
              _reprintTicket(ticket);
            },
            icon: const Icon(Icons.print, size: 16),
            label: const Text('REIMPRIMIR TICKET'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: EmpireColors.obsidian,
          body: Column(
            children: [
              _buildTopBar(),
              Expanded(
                child: _activeSubView == 0
                    ? _buildControlDeCajaView()
                    : _buildOrdenesCobradasView(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTopBar() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxWidth < 850;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: const BoxDecoration(
            color: EmpireColors.onyxSurface,
            border: Border(
              bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
            ),
          ),
          child: Row(
            children: [
              // Sub-navigation selector
              Container(
                decoration: BoxDecoration(
                  color: EmpireColors.charcoalSurface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: EmpireColors.agedBronzeDark),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildSegmentButton(
                      index: 0,
                      icon: Icons.savings_outlined,
                      label: isCompact
                          ? 'Caja & Cortes'
                          : 'Control de Caja & Cortes',
                    ),
                    _buildSegmentButton(
                      index: 1,
                      icon: Icons.receipt_long,
                      label: isCompact
                          ? 'Cobradas (${_tickets.length})'
                          : 'Órdenes Cobradas (${_tickets.length})',
                    ),
                  ],
                ),
              ),
              const Spacer(),
              // Shift status indicator
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: widget.state.isShiftOpen
                      ? EmpireColors.successGreen.withValues(alpha: 0.15)
                      : EmpireColors.errorRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: widget.state.isShiftOpen
                        ? EmpireColors.successGreen
                        : EmpireColors.errorRed,
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: widget.state.isShiftOpen
                            ? EmpireColors.successGreen
                            : EmpireColors.errorRed,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      widget.state.isShiftOpen
                          ? (isCompact
                              ? 'Abierta'
                              : 'Turno Activo (Caja Abierta)')
                          : 'Caja Cerrada',
                      style: TextStyle(
                        color: widget.state.isShiftOpen
                            ? EmpireColors.successGreen
                            : EmpireColors.errorRed,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              IconButton(
                tooltip: 'Actualizar',
                icon:
                    const Icon(Icons.refresh, color: EmpireColors.champagneGold),
                onPressed: () {
                  widget.state.checkActiveShift();
                  _loadTickets();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSegmentButton({
    required int index,
    required IconData icon,
    required String label,
  }) {
    final isSelected = _activeSubView == index;
    return InkWell(
      onTap: () {
        setState(() => _activeSubView = index);
        if (index == 1) _loadTickets();
      },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? EmpireColors.champagneGold : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color:
                  isSelected ? EmpireColors.obsidian : EmpireColors.textPrimary,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? EmpireColors.obsidian
                    : EmpireColors.textPrimary,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildControlDeCajaView() {
    if (!widget.state.isShiftOpen) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: EmpireColors.onyxSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: EmpireColors.agedBronzeDark),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_clock_outlined,
                      size: 56, color: EmpireColors.champagneGold),
                  const SizedBox(height: 16),
                  const Text(
                    'APERTURA DE TURNO DE CAJA',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Para operar como cajero, registrar cobros y movimientos en efectivo, ingresa el fondo inicial de caja.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: EmpireColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _floatController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Fondo Fijo Inicial',
                      hintText: 'e.g. 500.00',
                      prefixText: '\$ ',
                    ),
                    style: const TextStyle(
                        color: EmpireColors.textPrimary, fontSize: 16),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _openShift,
                    icon: const Icon(Icons.key, size: 18),
                    label: const Text('ABRIR TURNO / CAJA'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 750;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Saldo Banner & Summary Cards
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  _buildMetricCard(
                    title: 'SALDO EN EFECTIVO (CAJA)',
                    value:
                        '\$${widget.state.cashDrawerAmount.toStringAsFixed(2)}',
                    icon: Icons.savings_outlined,
                    isGold: true,
                    subtitle: 'Cajero: ${widget.state.currentUserName}',
                    width: isWide ? (constraints.maxWidth - 56) / 2 : double.infinity,
                  ),
                  _buildMetricCard(
                    title: 'TOTAL COBRADO HOY',
                    value:
                        '\$${_tickets.fold<double>(0.0, (sum, t) => sum + _money(t['total'])).toStringAsFixed(2)}',
                    icon: Icons.point_of_sale,
                    isGold: false,
                    subtitle: '${_tickets.length} órdenes finalizadas',
                    width: isWide ? (constraints.maxWidth - 56) / 2 : double.infinity,
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Operaciones de Efectivo
              const Text(
                'MOVIMIENTOS DE CAJA (ENTRADAS / SALIDAS)',
                style: TextStyle(
                  color: EmpireColors.textGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showDropDialog(true),
                      icon: const Icon(Icons.arrow_downward, size: 18),
                      label: const Text('INGRESO (CASH-IN)'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: EmpireColors.successGreen.withValues(alpha: 0.85),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showDropDialog(false),
                      icon: const Icon(Icons.arrow_upward, size: 18),
                      label: const Text('RETIRO (CASH-OUT)'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: EmpireColors.warningOrange.withValues(alpha: 0.85),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Cortes de Caja
              const Text(
                'CORTES Y AUDITORÍA DE CAJA',
                style: TextStyle(
                  color: EmpireColors.textGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _showCorteX,
                      icon: const Icon(Icons.assessment_outlined,
                          size: 18, color: EmpireColors.champagneGold),
                      label: const Text('CORTE X (INFORMATIVO)'),
                      style: OutlinedButton.styleFrom(
                        side:
                            const BorderSide(color: EmpireColors.champagneGold),
                        foregroundColor: EmpireColors.champagneGold,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _showArqueoDialog,
                      icon: const Icon(Icons.fact_check_outlined,
                          size: 18, color: EmpireColors.champagneGold),
                      label: const Text('ARQUEO FÍSICO'),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: EmpireColors.agedBronze),
                        foregroundColor: EmpireColors.champagneGold,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _showCorteZDialog,
                      icon: const Icon(Icons.lock, size: 18),
                      label: const Text('CORTE Z (CIERRE)'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: EmpireColors.errorRed,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Recent quick summary
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: EmpireColors.onyxSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: EmpireColors.agedBronzeDark),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Últimas Órdenes Cobradas',
                          style: TextStyle(
                            color: EmpireColors.champagneGold,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _activeSubView = 1),
                          child: const Text('VER TODAS →',
                              style: TextStyle(
                                  color: EmpireColors.textGold, fontSize: 12)),
                        ),
                      ],
                    ),
                    const Divider(color: EmpireColors.agedBronzeDark, height: 16),
                    if (_tickets.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(
                          child: Text(
                            'No hay órdenes cobradas registradas hoy.',
                            style: TextStyle(color: EmpireColors.textSecondary),
                          ),
                        ),
                      )
                    else
                      ..._tickets.take(5).map((t) => _buildTicketRow(t)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required bool isGold,
    required String subtitle,
    required double width,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isGold ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
          width: isGold ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isGold
                  ? EmpireColors.champagneGold.withValues(alpha: 0.15)
                  : EmpireColors.charcoalSurface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              color: isGold
                  ? EmpireColors.champagneGold
                  : EmpireColors.textSecondary,
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 11,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    color: isGold
                        ? EmpireColors.champagneGold
                        : EmpireColors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrdenesCobradasView() {
    final filtered = _tickets.where((t) {
      if (_selectedPaymentFilter == 'TODOS') return true;
      final payments = t['payments'] as List? ?? [];
      return payments.any((p) => p['method'] == _selectedPaymentFilter);
    }).toList();

    return Column(
      children: [
        // Sub-filter chips
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: EmpireColors.charcoalSurface,
          child: Row(
            children: [
              const Text(
                'Filtrar por pago:',
                style: TextStyle(
                  color: EmpireColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 12),
              _buildFilterChip('TODOS', 'Todos (${_tickets.length})'),
              const SizedBox(width: 8),
              _buildFilterChip('cash', 'Efectivo'),
              const SizedBox(width: 8),
              _buildFilterChip('card', 'Tarjeta'),
            ],
          ),
        ),
        // Ticket list
        Expanded(
          child: _loadingTickets
              ? const Center(
                  child: CircularProgressIndicator(
                      color: EmpireColors.champagneGold),
                )
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.receipt_long,
                              size: 48, color: EmpireColors.textSecondary),
                          const SizedBox(height: 12),
                          const Text(
                            'No hay órdenes cobradas con el filtro seleccionado',
                            style: TextStyle(color: EmpireColors.textSecondary),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: _loadTickets,
                            icon: const Icon(Icons.refresh, size: 16),
                            label: const Text('Actualizar'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadTickets,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        separatorBuilder: (context, _) =>
                            const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final ticket = filtered[index];
                          return _buildTicketCard(ticket);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String value, String label) {
    final isSelected = _selectedPaymentFilter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => setState(() => _selectedPaymentFilter = value),
      selectedColor: EmpireColors.champagneGold,
      backgroundColor: EmpireColors.onyxSurface,
      labelStyle: TextStyle(
        color: isSelected ? EmpireColors.obsidian : EmpireColors.textPrimary,
        fontSize: 11,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
      side: BorderSide(
        color: isSelected
            ? EmpireColors.champagneGold
            : EmpireColors.agedBronzeDark,
      ),
    );
  }

  Widget _buildTicketCard(Map<String, dynamic> ticket) {
    final items = ticket['items'] as List? ?? [];
    final payments = ticket['payments'] as List? ?? [];
    final itemsSummary = items
        .map((i) => '${i['quantity']}x ${i['productName']}')
        .join(', ');

    return Card(
      color: EmpireColors.onyxSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: EmpireColors.agedBronzeDark),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => _showTicketDetail(ticket),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: EmpireColors.champagneGold
                              .withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          ticket['tableLabel'] ?? 'Mesa',
                          style: const TextStyle(
                            color: EmpireColors.champagneGold,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '#${ticket['id'].toString().substring(0, 8).toUpperCase()}',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '\$${_money(ticket['total']).toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                itemsSummary.isEmpty ? 'Sin artículos' : itemsSummary,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${ticket['createdAt']?.toString().substring(11, 16) ?? ''} hrs · Mesero: ${ticket['waiterName'] ?? 'Cajero'}',
                    style: const TextStyle(
                      color: EmpireColors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                  Row(
                    children: payments.map((p) {
                      final isCash = p['method'] == 'cash';
                      return Container(
                        margin: const EdgeInsets.only(left: 4),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isCash
                              ? EmpireColors.successGreen
                                  .withValues(alpha: 0.15)
                              : Colors.blueAccent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: isCash
                                ? EmpireColors.successGreen
                                : Colors.blueAccent,
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          isCash ? '💵 Efectivo' : '💳 Tarjeta',
                          style: TextStyle(
                            color: isCash
                                ? EmpireColors.successGreen
                                : Colors.blueAccent,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTicketRow(Map<String, dynamic> ticket) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      onTap: () => _showTicketDetail(ticket),
      leading: const Icon(Icons.receipt_outlined,
          color: EmpireColors.champagneGold, size: 20),
      title: Text(
        '${ticket['tableLabel'] ?? 'Mesa'} - \$${_money(ticket['total']).toStringAsFixed(2)}',
        style: const TextStyle(
          color: EmpireColors.textPrimary,
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
      ),
      subtitle: Text(
        '${ticket['createdAt']?.toString().substring(11, 16) ?? ''} hrs · ${ticket['waiterName'] ?? 'Cajero'}',
        style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 11),
      ),
      trailing: const Icon(Icons.chevron_right,
          color: EmpireColors.textSecondary, size: 18),
    );
  }
}

class _DenomButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _DenomButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: EmpireColors.charcoalSurface,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: EmpireColors.agedBronzeDark),
        ),
        child: Icon(icon, size: 16, color: EmpireColors.champagneGold),
      ),
    );
  }
}
