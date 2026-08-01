import 'dart:io';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class DesktopPrinterSettingsDialog extends StatefulWidget {
  final AppState state;

  const DesktopPrinterSettingsDialog({super.key, required this.state});

  @override
  State<DesktopPrinterSettingsDialog> createState() =>
      _DesktopPrinterSettingsDialogState();
}

class _DesktopPrinterSettingsDialogState
    extends State<DesktopPrinterSettingsDialog> {
  List<Printer> _printers = [];
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadPrinters();
  }

  Future<void> _loadPrinters() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final printers = await Printing.listPrinters();
      setState(() {
        _printers = printers;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error al cargar impresoras: $e';
      });
    }
  }

  Future<void> _handleConnect(Printer printer) async {
    final success = await widget.state.connectToDesktopPrinter(printer.name);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor:
            success ? EmpireColors.successGreen : EmpireColors.errorRed,
        content: Text(
          success
              ? 'Impresora configurada: ${printer.name}'
              : 'Error al configurar la impresora.',
        ),
      ),
    );
  }

  Future<void> _handleDisconnect() async {
    await widget.state.disconnectPrinter();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: EmpireColors.successGreen,
        content: Text('Impresora desconectada.'),
      ),
    );
  }

  Future<void> _handleTestPrint() async {
    if (widget.state.connectedPrinterName == null) return;

    final printJob = PrintJob(
      id: 'test_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Prueba de Impresión',
      details: widget.state.formatCenter('*** TICKET DE PRUEBA ***') +
          '\n' +
          widget.state.formatCenter('IMPRESORA SISTEMA') +
          '\n' +
          widget.state.formatDivider() +
          '\n' +
          widget.state.formatRow('Estado:', 'ONLINE') +
          '\n' +
          widget.state.formatRow(
            'Conectado a:',
            widget.state.connectedPrinterName ?? 'Impresora',
          ) +
          '\n' +
          widget.state.formatDivider() +
          '\n' +
          widget.state.formatCenter('Conexión Sistema Exitosa!') +
          '\n' +
          widget.state.formatCenter(DateTime.now().toString().substring(0, 19)),
      target: 'Caja',
      timestamp: DateTime.now(),
    );

    await widget.state.enqueuePrintJob(printJob);
    if (!mounted) return;

    final wasPrinted = printJob.status == 'printed';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor:
            wasPrinted ? EmpireColors.successGreen : EmpireColors.errorRed,
        content: Text(
          wasPrinted
              ? '¡Ticket de prueba enviado a la impresora!'
              : 'Error al imprimir. Verifique la conexión.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: EmpireColors.obsidian,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
      ),
      child: ListenableBuilder(
        listenable: widget.state,
        builder: (context, _) {
          final isConnected = widget.state.connectedPrinterName != null;

          return Container(
            constraints: const BoxConstraints(maxWidth: 500, maxHeight: 600),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Row(
                  children: [
                    Icon(
                      Platform.isMacOS ? Icons.laptop_mac : Icons.computer,
                      color: EmpireColors.champagneGold,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Configurar Impresora Sistema',
                        style: TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    if (_isLoading)
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                              EmpireColors.champagneGold),
                        ),
                      )
                    else
                      IconButton(
                        onPressed: _loadPrinters,
                        icon: const Icon(Icons.refresh,
                            color: EmpireColors.champagneGold),
                        tooltip: 'Actualizar Lista',
                      ),
                  ],
                ),
                const SizedBox(height: 16),

                // Connected status banner
                if (isConnected) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: EmpireColors.successGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: EmpireColors.successGreen.withOpacity(0.5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle,
                            color: EmpireColors.successGreen, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Conectado a: ${widget.state.connectedPrinterName}',
                                style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Impresora del sistema',
                                style: TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton(
                          onPressed: _handleTestPrint,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: EmpireColors.champagneGold,
                            foregroundColor: EmpireColors.obsidian,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 8),
                            minimumSize: Size.zero,
                          ),
                          child: const Text('PROBAR',
                              style: TextStyle(
                                  fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                if (isConnected) ...[
                  _buildReceiveRemoteJobsSwitch(),
                  const SizedBox(height: 16),
                ],

                // Info banner
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: EmpireColors.champagneGold.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: EmpireColors.champagneGold.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline,
                          color: EmpireColors.champagneGold, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          Platform.isMacOS
                              ? 'Selecciona una impresora de tu sistema Mac'
                              : 'Selecciona una impresora de tu sistema Windows',
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Error Message if present
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: EmpireColors.errorRed.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: EmpireColors.errorRed.withOpacity(0.5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline,
                            color: EmpireColors.errorRed, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                                color: EmpireColors.textPrimary, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Printer List Title
                const Text(
                  'IMPRESORAS DISPONIBLES',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 8),

                // Printer List
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                                EmpireColors.champagneGold),
                          ),
                        )
                      : (_printers.isEmpty
                          ? const Center(
                              child: Text(
                                'No se encontraron impresoras.\nVerifica que tengas impresoras instaladas en tu sistema.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    color: EmpireColors.textSecondary,
                                    fontSize: 13),
                              ),
                            )
                          : ListView.builder(
                              itemCount: _printers.length,
                              itemBuilder: (context, index) {
                                final printer = _printers[index];
                                final isCurrent =
                                    widget.state.connectedPrinterName ==
                                        printer.name;

                                return Card(
                                  color: EmpireColors.charcoalSurface,
                                  margin:
                                      const EdgeInsets.symmetric(vertical: 6),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    side: BorderSide(
                                      color: isCurrent
                                          ? EmpireColors.champagneGold
                                          : EmpireColors.agedBronzeDark,
                                      width: isCurrent ? 1.5 : 1,
                                    ),
                                  ),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 16, vertical: 4),
                                    leading: Icon(
                                      printer.isDefault
                                          ? Icons.star
                                          : Icons.print,
                                      color: isCurrent
                                          ? EmpireColors.champagneGold
                                          : EmpireColors.textSecondary,
                                    ),
                                    title: Text(
                                      printer.name,
                                      style: TextStyle(
                                        color: isCurrent
                                            ? EmpireColors.champagneGold
                                            : EmpireColors.textPrimary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    subtitle: Text(
                                      printer.isDefault
                                          ? 'Impresora predeterminada'
                                          : 'Impresora del sistema',
                                      style: const TextStyle(
                                          color: EmpireColors.textSecondary,
                                          fontSize: 11),
                                    ),
                                    trailing: isCurrent
                                        ? OutlinedButton(
                                            onPressed: _handleDisconnect,
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor:
                                                  EmpireColors.errorRed,
                                              side: const BorderSide(
                                                  color: EmpireColors.errorRed),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 12),
                                            ),
                                            child: const Text('DESCONECTAR',
                                                style: TextStyle(fontSize: 11)),
                                          )
                                        : ElevatedButton(
                                            onPressed: () =>
                                                _handleConnect(printer),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor:
                                                  EmpireColors.agedBronze,
                                              foregroundColor:
                                                  EmpireColors.textPrimary,
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 16),
                                            ),
                                            child: const Text('CONECTAR',
                                                style: TextStyle(fontSize: 11)),
                                          ),
                                  ),
                                );
                              },
                            )),
                ),
                const SizedBox(height: 16),

                // Close Button
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.charcoalSurface,
                    foregroundColor: EmpireColors.textPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: EmpireColors.agedBronze),
                  ),
                  child: const Text('CERRAR',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildReceiveRemoteJobsSwitch() {
    final canUse = widget.state.isTerminalConfigured &&
        widget.state.currentUserRole != UserRole.none;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: widget.state.receiveRemotePrintJobs
              ? EmpireColors.successGreen.withOpacity(0.5)
              : EmpireColors.agedBronzeDark,
        ),
      ),
      child: SwitchListTile(
        value: widget.state.receiveRemotePrintJobs,
        onChanged: canUse ? widget.state.setReceiveRemotePrintJobs : null,
        dense: true,
        contentPadding: EdgeInsets.zero,
        activeColor: EmpireColors.successGreen,
        title: const Text(
          'Recibir comandas de otros dispositivos',
          style: TextStyle(
            color: EmpireColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
        subtitle: Text(
          canUse
              ? (widget.state.receiveRemotePrintJobs
                  ? 'Esta caja está disponible para imprimir comandas.'
                  : 'Actívalo para que meseros puedan elegir esta caja.')
              : 'Configura la sucursal e inicia sesión para activar esta estación.',
          style: const TextStyle(
            color: EmpireColors.textSecondary,
            fontSize: 11,
          ),
        ),
      ),
    );
  }
}
