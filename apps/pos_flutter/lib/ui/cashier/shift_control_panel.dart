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

  @override
  void dispose() {
    _floatController.dispose();
    _dropController.dispose();
    super.dispose();
  }

  void _openShift() {
    final double? amount = double.tryParse(_floatController.text);
    if (amount != null && amount >= 0) {
      widget.state.openShift(amount);
      _floatController.clear();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: EmpireColors.errorRed,
          content: Text('Por favor, ingresa un monto válido.'),
        ),
      );
    }
  }

  void _performCashDrop(bool isAdd) {
    final double? amount = double.tryParse(_dropController.text);
    if (amount != null && amount > 0) {
      if (isAdd) {
        widget.state.addCashDrop(amount);
      } else {
        widget.state.removeCashDrop(amount);
      }
      _dropController.clear();
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

  void _printCorte(String type) {
    // Simulate printing X or Z report
    final reportTitle = 'Corte $type - Resumen de Turno';
    final reportDetails =
        'Caja Activa\nFecha: ${DateTime.now().toLocal()}\nFondo Inicial: \$${widget.state.cashDrawerAmount.toStringAsFixed(2)}\nTotal Ventas Efectivo: \$${(widget.state.cashDrawerAmount - 1000).toStringAsFixed(2)}\nOperador: ${widget.state.currentUserName}';

    widget.state.printJobs.add(
      PrintJob(
        id: 'report_${DateTime.now().millisecondsSinceEpoch}',
        title: reportTitle,
        details: reportDetails,
        target: 'Caja',
        timestamp: DateTime.now(),
        status: widget.state.isOnline ? 'printed' : 'failed',
      ),
    );

    if (type == 'Z') {
      widget.state.closeShift();
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: EmpireColors.successGreen,
        content: Text('¡Corte $type enviado a la impresora de caja!'),
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
                labelText: 'Monto Inicial (Float)',
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
              border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
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

          const Spacer(),

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
            onPressed: () => _printCorte('X'),
            child: const Text('CORTEX (PARCIAL)'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => _printCorte('Z'),
            style: OutlinedButton.styleFrom(
              foregroundColor: EmpireColors.errorRed,
              side: const BorderSide(color: EmpireColors.errorRed, width: 1.2),
            ),
            child: const Text('CORTE Z (CIERRE DE CAJA)'),
          ),
        ],
      ),
    );
  }
}
