import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class OfflineStatusBar extends StatelessWidget {
  final AppState state;
  final VoidCallback? onOpenPrinterQueue;

  const OfflineStatusBar({
    super.key,
    required this.state,
    this.onOpenPrinterQueue,
  });

  void _triggerSync(BuildContext context) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: EmpireColors.obsidian),
            ),
            SizedBox(width: 12),
            Text('Sincronizando datos con el servidor...', style: TextStyle(color: EmpireColors.obsidian, fontWeight: FontWeight.bold)),
          ],
        ),
        backgroundColor: EmpireColors.champagneGold,
        duration: Duration(milliseconds: 1500),
      ),
    );

    final bool success = await state.syncAllData();

    if (context.mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success 
              ? 'Sincronización completa con éxito.'
              : 'Sincronización incompleta. Revise su conexión de red.',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          backgroundColor: success ? EmpireColors.successGreen : EmpireColors.errorRed,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasFailedPrinters = state.printJobs.any(
      (job) => job.status == 'failed',
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(
          bottom: BorderSide(
            color: state.isOnline
                ? EmpireColors.agedBronzeDark
                : EmpireColors.warningOrange.withOpacity(0.5),
            width: 1,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left: Status and Connection Type
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: state.isOnline
                      ? EmpireColors.successGreen
                      : EmpireColors.warningOrange,
                  boxShadow: [
                    BoxShadow(
                      color:
                          (state.isOnline
                                  ? EmpireColors.successGreen
                                  : EmpireColors.warningOrange)
                              .withOpacity(0.5),
                      blurRadius: 6,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                state.isOnline ? 'SISTEMA ONLINE' : 'TRABAJANDO FUERA DE LÍNEA',
                style: TextStyle(
                  color: state.isOnline
                      ? EmpireColors.textPrimary
                      : EmpireColors.textGold,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                ),
              ),
              if (!state.isOnline) ...[
                const SizedBox(width: 16),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: EmpireColors.warningOrange.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: EmpireColors.warningOrange.withOpacity(0.5),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    '${state.pendingSyncCount} transacciones locales sin sincronizar',
                    style: const TextStyle(
                      color: EmpireColors.warningOrange,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),

          // Right: Printer alert and Online/Offline simulation toggles
          Row(
            children: [
              if (hasFailedPrinters) ...[
                GestureDetector(
                  onTap: onOpenPrinterQueue,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: EmpireColors.errorRed.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: EmpireColors.errorRed.withOpacity(0.6),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.print_disabled,
                          size: 14,
                          color: EmpireColors.errorRed,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${state.printJobs.where((j) => j.status == 'failed').length} comanda(s) fallida(s)',
                          style: const TextStyle(
                            color: EmpireColors.errorRed,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
              ],
              // Sync Button
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.sync, color: EmpireColors.textGold, size: 20),
                onPressed: () => _triggerSync(context),
                tooltip: 'Sincronizar Datos',
              ),
              const SizedBox(width: 12),

              // Simulator Mode Switch
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: EmpireColors.obsidian,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: EmpireColors.agedBronzeDark,
                    width: 1,
                  ),
                ),
                child: Row(
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(left: 8.0, right: 4.0),
                      child: Text(
                        'SIMULAR',
                        style: TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Switch(
                      value: state.isOnline,
                      onChanged: (val) {
                        state.toggleConnection();
                        if (state.isOnline) {
                          state.syncOfflineTransactions();
                        }
                      },
                      activeColor: EmpireColors.successGreen,
                      activeTrackColor: EmpireColors.successGreen.withOpacity(
                        0.2,
                      ),
                      inactiveThumbColor: EmpireColors.errorRed,
                      inactiveTrackColor: EmpireColors.errorRed.withOpacity(
                        0.2,
                      ),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
