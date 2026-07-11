import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../common/sync_socket_service.dart';

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
            success ? 'Sincronización completa con éxito.' : 'Sincronización incompleta. Revise su conexión de red.',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          backgroundColor: success ? EmpireColors.successGreen : EmpireColors.errorRed,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Color _getStatusColor(SocketConnectionState connectionState, bool isOnline) {
    if (!isOnline) return EmpireColors.errorRed;
    switch (connectionState) {
      case SocketConnectionState.connected:
        return EmpireColors.successGreen;
      case SocketConnectionState.connecting:
        return EmpireColors.warningOrange;
      case SocketConnectionState.degradedRest:
        return EmpireColors.textGold;
      case SocketConnectionState.disconnected:
        return EmpireColors.errorRed;
    }
  }

  String _getStatusText(SocketConnectionState connectionState, bool isOnline) {
    if (!isOnline) return 'TRABAJANDO FUERA DE LÍNEA';
    switch (connectionState) {
      case SocketConnectionState.connected:
        return 'SISTEMA ONLINE (WS)';
      case SocketConnectionState.connecting:
        return 'CONECTANDO AL SERVIDOR...';
      case SocketConnectionState.degradedRest:
        return 'CONEXIÓN DEGRADADA (REST)';
      case SocketConnectionState.disconnected:
        return 'TRABAJANDO FUERA DE LÍNEA';
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
            color: state.isOnline ? EmpireColors.agedBronzeDark : EmpireColors.warningOrange.withOpacity(0.5),
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
                  color: _getStatusColor(state.socketConnectionState, state.isOnline),
                  boxShadow: [
                    BoxShadow(
                      color: _getStatusColor(state.socketConnectionState, state.isOnline).withOpacity(0.5),
                      blurRadius: 6,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                _getStatusText(state.socketConnectionState, state.isOnline),
                style: TextStyle(
                  color: state.isOnline ? EmpireColors.textPrimary : EmpireColors.textGold,
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
            ],
          ),
        ],
      ),
    );
  }
}
