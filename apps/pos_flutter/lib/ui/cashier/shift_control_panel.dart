import 'package:flutter/material.dart';
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
  final TextEditingController _countedCashController = TextEditingController();

  @override
  void dispose() {
    _floatController.dispose();
    _dropController.dispose();
    _countedCashController.dispose();
    super.dispose();
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
            const SnackBar(
              backgroundColor: EmpireColors.errorRed,
              content: Text('Error al abrir el turno de caja. Valida tu conexión.'),
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

      final String reason = isAdd ? 'Ingreso de caja manual' : 'Retiro de caja manual';
      final bool success = isAdd
          ? await widget.state.addCashDrop(amount, reason: reason)
          : await widget.state.removeCashDrop(amount, reason: reason);

      if (mounted) {
        Navigator.of(context).pop();
      }

      if (success) {
        _dropController.clear();
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
            const SnackBar(
              backgroundColor: EmpireColors.errorRed,
              content: Text('Error al registrar transacción. Valida tu conexión.'),
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
        content: TextField(
          controller: _dropController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            labelText: 'Monto en \$',
            hintText: '0.00',
          ),
          style: const TextStyle(color: EmpireColors.textPrimary),
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

  void _showCierreDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
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
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Por favor, cuenta el efectivo físico en caja e ingresa el monto para conciliar.',
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _countedCashController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Efectivo Contado (\$)',
                hintText: '0.00',
              ),
              style: const TextStyle(color: EmpireColors.textPrimary),
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
            onPressed: () {
              final double? amount = double.tryParse(_countedCashController.text);
              if (amount != null && amount >= 0) {
                Navigator.of(context).pop();
                _performCierre(amount);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    backgroundColor: EmpireColors.errorRed,
                    content: Text('Ingresa un monto de efectivo válido.'),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: EmpireColors.errorRed),
            child: const Text('CERRAR CAJA'),
          ),
        ],
      ),
    );
  }

  void _performCierre(double actualAmount) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: EmpireColors.champagneGold),
      ),
    );

    final Map<String, dynamic>? recon = await widget.state.closeShift(actualAmount);

    if (mounted) {
      Navigator.of(context).pop();
    }

    if (recon != null) {
      _countedCashController.clear();

      final initialFloatVal = double.tryParse(recon['initialFloat']?.toString() ?? '0') ?? 0.0;
      final totalCashSalesVal = double.tryParse(recon['totalCashSales']?.toString() ?? '0') ?? 0.0;
      final totalCashInVal = double.tryParse(recon['totalCashIn']?.toString() ?? '0') ?? 0.0;
      final totalCashOutVal = double.tryParse(recon['totalCashOut']?.toString() ?? '0') ?? 0.0;
      final expectedAmountVal = double.tryParse(recon['expectedAmount']?.toString() ?? '0') ?? 0.0;
      final actualAmountVal = double.tryParse(recon['actualAmount']?.toString() ?? '0') ?? 0.0;
      final discrepancyVal = double.tryParse(recon['discrepancy']?.toString() ?? '0') ?? 0.0;

      final reportDetails = 'Corte Z - Cierre de Caja\n'
          'Fecha: ${DateTime.now().toLocal()}\n'
          'Fondo Inicial: \$${initialFloatVal.toStringAsFixed(2)}\n'
          'Ventas Efectivo: \$${totalCashSalesVal.toStringAsFixed(2)}\n'
          'Ingresos Turno: \$${totalCashInVal.toStringAsFixed(2)}\n'
          'Retiros Turno: \$${totalCashOutVal.toStringAsFixed(2)}\n'
          'Esperado en Caja: \$${expectedAmountVal.toStringAsFixed(2)}\n'
          'Físico Reportado: \$${actualAmountVal.toStringAsFixed(2)}\n'
          'Diferencia: \$${discrepancyVal.toStringAsFixed(2)}\n'
          'Operador: ${widget.state.currentUserName}';

      widget.state.enqueuePrintJob(
        PrintJob(
          id: 'report_z_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Corte Z - Cierre de Caja',
          details: reportDetails,
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      );

      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: EmpireColors.obsidian,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: EmpireColors.champagneGold, width: 1.5),
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
          const SnackBar(
            backgroundColor: EmpireColors.errorRed,
            content: Text('Error al cerrar el turno de caja.'),
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

    final Map<String, dynamic>? auditData = await widget.state.getCashShiftAuditReport(shiftId);

    if (mounted) {
      Navigator.of(context).pop();
    }

    if (auditData != null) {
      final summary = auditData['summary'] ?? {};
      final initialFloatVal = double.tryParse(auditData['shiftInfo']?['initialFloat']?.toString() ?? '0') ?? 0.0;
      final totalCashSalesVal = double.tryParse(summary['cashSales']?.toString() ?? '0') ?? 0.0;
      final totalCashInVal = double.tryParse(summary['totalCashIn']?.toString() ?? '0') ?? 0.0;
      final totalCashOutVal = double.tryParse(summary['totalCashOut']?.toString() ?? '0') ?? 0.0;
      final expectedCashVal = double.tryParse(summary['expectedCash']?.toString() ?? '0') ?? 0.0;

      final reportDetails = 'Corte X - Arqueo Parcial\n'
          'Fecha: ${DateTime.now().toLocal()}\n'
          'Fondo Inicial: \$${initialFloatVal.toStringAsFixed(2)}\n'
          'Ventas Efectivo: \$${totalCashSalesVal.toStringAsFixed(2)}\n'
          'Ingresos Turno: \$${totalCashInVal.toStringAsFixed(2)}\n'
          'Retiros Turno: \$${totalCashOutVal.toStringAsFixed(2)}\n'
          'Esperado en Caja: \$${expectedCashVal.toStringAsFixed(2)}\n'
          'Operador: ${widget.state.currentUserName}';

      widget.state.enqueuePrintJob(
        PrintJob(
          id: 'report_x_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Corte X - Resumen Parcial',
          details: reportDetails,
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      );

      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: EmpireColors.obsidian,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: EmpireColors.champagneGold, width: 1.5),
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
