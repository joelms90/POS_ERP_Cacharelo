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
      final diff = _money(summary['cashDifference']);
      final diffLabel = diff.abs() < 0.01
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
              child: const Text(
                'CANCELAR',
                style: TextStyle(color: EmpireColors.textSecondary),
              ),
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
        'CORTE X (REPORTE INFORMATIVO)',
        auditData,
        isCorteX: true,
      );

      unawaited(widget.state.enqueueCajaPrintJob(
        PrintJob(
          id: 'report_x_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Corte X - Reporte Informativo',
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
              'Corte X (Reporte Informativo)',
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

    final Map<String, dynamic>? auditData =
        await widget.state.getCashShiftAuditReport(shiftId);

    if (mounted) {
      Navigator.of(context).pop();
    }

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
                color: EmpireColors.champagneGold,
                width: 1.5,
              ),
            ),
            title: const Text(
              'Arqueo de Caja (Verificación Física)',
              style: TextStyle(
                color: EmpireColors.champagneGold,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
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
                              const Text(
                                'Efectivo Esperado (Sistema):',
                                style: TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
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
                              const Text(
                                'Efectivo Contado (Físico):',
                                style: TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
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
                            color: EmpireColors.agedBronzeDark,
                            height: 16,
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Diferencia:',
                                style: TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                '${difference >= 0 ? '+' : ''}\$${difference.toStringAsFixed(2)} ${difference.abs() < 0.01 ? '(Cuadrado)' : difference > 0 ? '(Sobrante)' : '(Faltante)'}',
                                style: TextStyle(
                                  color: difference.abs() < 0.01
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
                                    vertical: 8,
                                    horizontal: 4,
                                  ),
                                ),
                                style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontSize: 13,
                                ),
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
              ElevatedButton.icon(
                onPressed: () {
                  final reportCopy = Map<String, dynamic>.from(auditData);
                  final summaryCopy =
                      Map<String, dynamic>.from(_summary(reportCopy));
                  summaryCopy['actualCash'] = countedCash;
                  summaryCopy['cashDifference'] = difference;
                  reportCopy['summary'] = summaryCopy;
                  reportCopy['denominationCounts'] = _denominationCounts();

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
                          color: EmpireColors.champagneGold,
                          width: 1.5,
                        ),
                      ),
                      title: const Text(
                        'Comprobante de Arqueo Generado',
                        style: TextStyle(
                          color: EmpireColors.champagneGold,
                          fontSize: 16,
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
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text(
                            'CERRAR',
                            style: TextStyle(color: EmpireColors.textSecondary),
                          ),
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
                backgroundColor:
                    EmpireColors.successGreen.withValues(alpha: 0.8),
                foregroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () => _showDropDialog(false),
              icon: const Icon(Icons.arrow_upward, size: 16),
              label: const Text('RETIRO (CASH-OUT)'),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.errorRed.withValues(alpha: 0.8),
                foregroundColor: Colors.white,
              ),
            ),

            const SizedBox(height: 24),

            // Z / X Reports & Arqueo
            const Text(
              'AUDITORÍA Y CIERRES DE CAJA',
              style: TextStyle(
                color: EmpireColors.textGold,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _printCorteX,
              icon: const Icon(Icons.assessment_outlined, size: 16),
              label: const Text('CORTE X (INFORMATIVO)'),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: EmpireColors.champagneGold),
                foregroundColor: EmpireColors.champagneGold,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _showArqueoDialog,
              icon: const Icon(Icons.fact_check_outlined, size: 16),
              label: const Text('ARQUEO FÍSICO (VERIFICACIÓN)'),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: EmpireColors.agedBronze),
                foregroundColor: EmpireColors.champagneGold,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _showCierreDialog,
              icon: const Icon(Icons.lock, size: 16),
              label: const Text('CORTE Z (CIERRE DE CAJA)'),
              style: OutlinedButton.styleFrom(
                foregroundColor: EmpireColors.errorRed,
                side: const BorderSide(
                  color: EmpireColors.errorRed,
                  width: 1.2,
                ),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
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
