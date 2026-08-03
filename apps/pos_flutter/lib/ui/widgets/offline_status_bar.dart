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
            color: state.isOnline ? EmpireColors.agedBronzeDark : EmpireColors.warningOrange.withValues(alpha: 0.5),
            width: 1,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left: Connection status icon
          Row(
            children: [
              Tooltip(
                message: _getStatusText(state.socketConnectionState, state.isOnline),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: _getStatusColor(state.socketConnectionState, state.isOnline).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: _getStatusColor(state.socketConnectionState, state.isOnline).withValues(alpha: 0.5),
                      width: 1,
                    ),
                  ),
                  child: Icon(
                    state.socketConnectionState == SocketConnectionState.connected
                        ? Icons.cloud_done
                        : state.socketConnectionState == SocketConnectionState.connecting
                            ? Icons.cloud_sync
                            : state.socketConnectionState == SocketConnectionState.degradedRest
                                ? Icons.cloud_queue
                                : Icons.cloud_off,
                    size: 18,
                    color: _getStatusColor(state.socketConnectionState, state.isOnline),
                  ),
                ),
              ),
              if (!state.isOnline) ...[
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: EmpireColors.warningOrange.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: EmpireColors.warningOrange.withValues(alpha: 0.5),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    '${state.pendingSyncCount} sin sync',
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

          // Right: Printer alert
          if (hasFailedPrinters)
            GestureDetector(
              onTap: onOpenPrinterQueue,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: EmpireColors.errorRed.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: EmpireColors.errorRed.withValues(alpha: 0.6),
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
        ],
      ),
    );
  }
}
