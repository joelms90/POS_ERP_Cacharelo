import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class PrinterMonitorPanel extends StatelessWidget {
  final AppState state;
  final VoidCallback onClose;

  const PrinterMonitorPanel({
    super.key,
    required this.state,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final failedJobs = state.printJobs
        .where((j) => j.status == 'failed')
        .toList();
    final printedJobs = state.printJobs
        .where((j) => j.status == 'printed')
        .toList();

    return Container(
      width: 450,
      height: double.infinity,
      color: EmpireColors.obsidian,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
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
                Row(
                  children: [
                    const Icon(
                      Icons.print,
                      color: EmpireColors.champagneGold,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Monitor de Impresiones',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: onClose,
                  icon: const Icon(
                    Icons.close,
                    color: EmpireColors.champagneGold,
                  ),
                ),
              ],
            ),
          ),

          // Main print list
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (failedJobs.isNotEmpty) ...[
                  Text(
                    'TRABAJOS FALLIDOS (${failedJobs.length})',
                    style: const TextStyle(
                      color: EmpireColors.errorRed,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...failedJobs.map((job) => _buildJobCard(context, job)),
                  const SizedBox(height: 24),
                ],

                Text(
                  'HISTORIAL DE IMPRESIÓN (${printedJobs.length})',
                  style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 10),
                if (printedJobs.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text(
                        'No hay trabajos impresos',
                        style: TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  )
                else
                  ...printedJobs.reversed.map(
                    (job) => _buildJobCard(context, job),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJobCard(BuildContext context, PrintJob job) {
    final isFailed = job.status == 'failed';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: EmpireColors.onyxSurface,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: isFailed
              ? EmpireColors.errorRed.withOpacity(0.5)
              : EmpireColors.agedBronzeDark,
          width: 1,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Title and Target
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        job.title,
                        style: const TextStyle(
                          color: EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Destino: ${job.target} • ${_formatTime(job.timestamp)}',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),

                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: isFailed
                        ? EmpireColors.errorRed.withOpacity(0.15)
                        : EmpireColors.successGreen.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: isFailed
                          ? EmpireColors.errorRed.withOpacity(0.5)
                          : EmpireColors.successGreen.withOpacity(0.5),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    isFailed ? 'FALLIDO' : 'IMPRESO',
                    style: TextStyle(
                      color: isFailed
                          ? EmpireColors.errorRed
                          : EmpireColors.successGreen,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),
            // Print Content details
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: EmpireColors.charcoalSurface,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                job.details,
                style: const TextStyle(
                  fontFamily: 'Courier',
                  fontSize: 12,
                  color: EmpireColors.textPrimary,
                ),
              ),
            ),

            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: () => state.retryPrintJob(job.id),
                  icon: Icon(isFailed ? Icons.refresh : Icons.print, size: 16),
                  label: Text(
                    isFailed ? 'REINTENTAR IMPRESIÓN' : 'REIMPRIMIR TICKET',
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    foregroundColor: EmpireColors.champagneGold,
                    side: const BorderSide(
                      color: EmpireColors.champagneGold,
                      width: 1,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final hours = dt.hour.toString().padLeft(2, '0');
    final minutes = dt.minute.toString().padLeft(2, '0');
    final seconds = dt.second.toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }
}
