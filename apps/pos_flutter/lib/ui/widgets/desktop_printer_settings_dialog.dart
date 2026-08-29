import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
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
  bool _isRefreshingStations = false;
  String? _errorMessage;

  final TextEditingController _customPrinterController =
      TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPrinters();
    _refreshPrintStations();
  }

  @override
  void dispose() {
    _customPrinterController.dispose();
    super.dispose();
  }

  Future<void> _refreshPrintStations({bool showError = false}) async {
    setState(() => _isRefreshingStations = true);
    final success = await widget.state.refreshOnlinePrintStations();
    if (!mounted) return;
    setState(() => _isRefreshingStations = false);

    if (showError && !success && widget.state.onlinePrintStations.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: EmpireColors.warningOrange,
          content: Text('No se pudieron consultar las cajas disponibles.'),
        ),
      );
    }
  }

  Future<void> _selectPrintStation(PrintStation station) async {
    await widget.state.saveLastSelectedPrintStation(station.stationId);
    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: EmpireColors.successGreen,
        content: Text('Caja seleccionada: ${station.displayName}'),
      ),
    );
  }

  Future<void> _loadPrinters() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final list = <Printer>[];
    void addPrinterIfMissing(Printer printer) {
      if (!list.any((existing) => existing.name == printer.name)) {
        list.add(printer);
      }
    }

    // Always include connected printer if set
    final currentName = widget.state.connectedPrinterName;
    if (currentName != null && currentName.isNotEmpty) {
      addPrinterIfMissing(Printer(url: currentName, name: currentName));
    }

    if (!kIsWeb) {
      try {
        final printers = await Printing.listPrinters();
        debugPrint('System printers enumerated: ${printers.length}');
        for (final p in printers) {
          addPrinterIfMissing(p);
        }
      } catch (e) {
        debugPrint('Error listing system printers: $e');
        _errorMessage =
            'No se pudieron listar las impresoras de Windows automáticamente. Puedes seleccionarla usando el botón de abajo o escribir su nombre.';
      }

      if (Platform.isWindows) {
        final windowsPrinters = await _loadWindowsSystemPrintersFallback();
        if (windowsPrinters.isNotEmpty) {
          for (final printer in windowsPrinters) {
            addPrinterIfMissing(printer);
          }
          _errorMessage = null;
        } else if (list.isEmpty) {
          _errorMessage ??=
              'Windows no devolvió impresoras instaladas. Verifica el servicio de cola de impresión o escribe el nombre exacto.';
        }
      }
    }

    // Always add default system / browser option as fallback
    const systemFallback = Printer(
      url: 'Impresora Sistema / Navegador',
      name: 'Impresora Sistema / Navegador',
    );
    addPrinterIfMissing(systemFallback);

    if (mounted) {
      setState(() {
        _printers = list;
        _isLoading = false;
      });
    }
  }

  Future<List<Printer>> _loadWindowsSystemPrintersFallback() async {
    if (kIsWeb || !Platform.isWindows) return const [];

    try {
      final result = await Process.run(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          'Get-Printer | Select-Object -ExpandProperty Name',
        ],
      ).timeout(const Duration(seconds: 5));

      if (result.exitCode != 0) {
        debugPrint('Get-Printer failed: ${result.stderr}');
        return const [];
      }

      return result.stdout
          .toString()
          .split(RegExp(r'\r?\n'))
          .map((line) => line.trim())
          .where((name) => name.isNotEmpty)
          .map((name) => Printer(url: name, name: name))
          .toList();
    } catch (e) {
      debugPrint('Windows printer fallback failed: $e');
      return const [];
    }
  }

  Future<void> _handlePickWindowsPrinter() async {
    try {
      final printer = await Printing.pickPrinter(context: context);
      if (printer != null && mounted) {
        await _handleConnect(printer);
        _loadPrinters();
      }
    } catch (e) {
      debugPrint('Error picking Windows printer: $e');
      if (mounted) {
        setState(() {
          _errorMessage =
              'Error al abrir el selector de impresoras de Windows: $e';
        });
      }
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

  Future<void> _handlePublishStationNow() async {
    final success = await widget.state.publishPrintStationNow();
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor:
            success ? EmpireColors.successGreen : EmpireColors.errorRed,
        content: Text(
          success
              ? (widget.state.lastPrintStationPublishMessage ??
                  'Estado de estación de impresión publicado.')
              : (widget.state.lastPrintStationPublishMessage ??
                  'Error al publicar estado de estación.'),
        ),
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
            constraints: BoxConstraints(
              maxWidth: 520,
              maxHeight: MediaQuery.of(context).size.height * 0.85,
            ),
            padding: const EdgeInsets.all(24),
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Header
                  Row(
                    children: [
                      Icon(
                        (!kIsWeb && Platform.isMacOS)
                            ? Icons.laptop_mac
                            : Icons.computer,
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
                    _buildPaperWidthSelector(),
                    const SizedBox(height: 12),
                    _buildReceiveRemoteJobsSwitch(),
                    const SizedBox(height: 16),
                  ],

                  _buildPrintStationSection(),
                  const SizedBox(height: 16),

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
                            (!kIsWeb && Platform.isMacOS)
                                ? 'Selecciona una impresora de tu sistema Mac'
                                : 'Selecciona una impresora de tu sistema o navegador',
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
                                  color: EmpireColors.textPrimary,
                                  fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Printer List Title & Native System Picker
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'IMPRESORAS DISPONIBLES',
                          style: TextStyle(
                            color: EmpireColors.textGold,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      if (!kIsWeb)
                        OutlinedButton.icon(
                          onPressed: _handlePickWindowsPrinter,
                          icon: const Icon(Icons.search, size: 14),
                          label: const Text('SELECCIONAR DE WINDOWS',
                              style: TextStyle(
                                  fontSize: 10, fontWeight: FontWeight.bold)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: EmpireColors.champagneGold,
                            side: const BorderSide(
                                color: EmpireColors.champagneGold),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            minimumSize: Size.zero,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Manual Printer Name Entry
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: EmpireColors.onyxSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: EmpireColors.agedBronzeDark),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _customPrinterController,
                            style: const TextStyle(
                                color: EmpireColors.textPrimary, fontSize: 13),
                            decoration: const InputDecoration(
                              hintText:
                                  'Nombre de impresora (ej. POS-80, XP-58)',
                              hintStyle: TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 12),
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding:
                                  EdgeInsets.symmetric(horizontal: 8),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            final name = _customPrinterController.text.trim();
                            if (name.isNotEmpty) {
                              _handleConnect(Printer(url: name, name: name));
                              _customPrinterController.clear();
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: EmpireColors.champagneGold,
                            foregroundColor: EmpireColors.obsidian,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            minimumSize: Size.zero,
                          ),
                          child: const Text(
                            'CONECTAR',
                            style: TextStyle(
                                fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Printer List
                  SizedBox(
                    height: 260,
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
                                      contentPadding:
                                          const EdgeInsets.symmetric(
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
                                                    color:
                                                        EmpireColors.errorRed),
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        horizontal: 12),
                                              ),
                                              child: const Text('DESCONECTAR',
                                                  style:
                                                      TextStyle(fontSize: 11)),
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
                                                  style:
                                                      TextStyle(fontSize: 11)),
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
      child: Column(
        children: [
          SwitchListTile(
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
                      ? 'Esta caja imprimira comandas enviadas a la Cola de caja.'
                      : 'Actívalo para recibir la Cola de caja y comandas dirigidas a este equipo.')
                  : 'Configura la sucursal e inicia sesión para activar esta estación.',
              style: const TextStyle(
                color: EmpireColors.textSecondary,
                fontSize: 11,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                widget.state.lastPrintStationPublishSucceeded == true
                    ? Icons.check_circle
                    : widget.state.lastPrintStationPublishSucceeded == false
                        ? Icons.error_outline
                        : Icons.info_outline,
                color: widget.state.lastPrintStationPublishSucceeded == true
                    ? EmpireColors.successGreen
                    : widget.state.lastPrintStationPublishSucceeded == false
                        ? EmpireColors.errorRed
                        : EmpireColors.textSecondary,
                size: 16,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _printStationStatusText(),
                  style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: canUse ? _handlePublishStationNow : null,
                style: OutlinedButton.styleFrom(
                  foregroundColor: EmpireColors.champagneGold,
                  side: const BorderSide(color: EmpireColors.agedBronze),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  minimumSize: Size.zero,
                ),
                child: const Text(
                  'PUBLICAR AHORA',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _printStationStatusText() {
    final message = widget.state.lastPrintStationPublishMessage;
    final attemptAt = widget.state.lastPrintStationPublishAttemptAt;
    if (message == null || attemptAt == null) {
      return 'Sin intento de publicacion en esta sesion.';
    }
    final secondsAgo = DateTime.now().difference(attemptAt).inSeconds;
    final age =
        secondsAgo < 60 ? 'hace ${secondsAgo}s' : 'hace ${secondsAgo ~/ 60}m';
    return '$message ($age)';
  }

  Widget _buildPaperWidthSelector() {
    final current = widget.state.printerPaperWidth;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ANCHO DE PAPEL TÉRMICO (TICKET)',
            style: TextStyle(
              color: EmpireColors.textGold,
              fontWeight: FontWeight.bold,
              fontSize: 11,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: const Text('📱 58mm (26 cols)',
                      style: TextStyle(fontSize: 11)),
                  selected: current != '80mm',
                  onSelected: (selected) async {
                    if (selected) {
                      await widget.state.setPrinterPaperWidth('58mm');
                      if (mounted) setState(() {});
                    }
                  },
                  selectedColor: EmpireColors.champagneGold,
                  backgroundColor: EmpireColors.charcoalSurface,
                  labelStyle: TextStyle(
                    color: current != '80mm'
                        ? EmpireColors.obsidian
                        : EmpireColors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ChoiceChip(
                  label: const Text('🖥️ 80mm (42 cols)',
                      style: TextStyle(fontSize: 11)),
                  selected: current == '80mm',
                  onSelected: (selected) async {
                    if (selected) {
                      await widget.state.setPrinterPaperWidth('80mm');
                      if (mounted) setState(() {});
                    }
                  },
                  selectedColor: EmpireColors.champagneGold,
                  backgroundColor: EmpireColors.charcoalSurface,
                  labelStyle: TextStyle(
                    color: current == '80mm'
                        ? EmpireColors.obsidian
                        : EmpireColors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPrintStationSection() {
    final localName = widget.state.localDeviceName.trim().toLowerCase();
    final stations = widget.state.onlinePrintStations
        .where(
          (s) =>
              s.stationId != widget.state.localStationId &&
              s.deviceName.trim().toLowerCase() != localName,
        )
        .toList();
    final selectedStationId = widget.state.lastSelectedPrintStationId;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.point_of_sale,
                  color: EmpireColors.champagneGold, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'CAJA PARA COMANDAS REMOTAS',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              IconButton(
                onPressed: _isRefreshingStations
                    ? null
                    : () => _refreshPrintStations(showError: true),
                icon: _isRefreshingStations
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                              EmpireColors.champagneGold),
                        ),
                      )
                    : const Icon(Icons.refresh,
                        color: EmpireColors.champagneGold, size: 18),
                tooltip: 'Actualizar cajas',
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (stations.isEmpty)
            const Text(
              'No hay cajas configuradas online en esta sucursal. Cualquier cajero con Recibir comandas activo las imprimira.',
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 12),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 150),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: stations.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final station = stations[index];
                  final isSelected = station.stationId == selectedStationId;

                  return InkWell(
                    onTap: () => _selectPrintStation(station),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? EmpireColors.champagneGold.withOpacity(0.12)
                            : EmpireColors.charcoalSurface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected
                              ? EmpireColors.champagneGold
                              : EmpireColors.agedBronzeDark,
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isSelected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            color: isSelected
                                ? EmpireColors.champagneGold
                                : EmpireColors.textSecondary,
                            size: 18,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  station.deviceName,
                                  style: TextStyle(
                                    color: isSelected
                                        ? EmpireColors.champagneGold
                                        : EmpireColors.textPrimary,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  station.operatorName?.isNotEmpty == true
                                      ? '${station.operatorName} - ${station.printerName}'
                                      : station.printerName,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: EmpireColors.textSecondary,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                station.online ? Icons.wifi : Icons.wifi_off,
                                color: station.online
                                    ? EmpireColors.successGreen
                                    : EmpireColors.warningOrange,
                                size: 16,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                station.online ? 'En línea' : 'Sin heartbeat',
                                style: TextStyle(
                                  color: station.online
                                      ? EmpireColors.successGreen
                                      : EmpireColors.warningOrange,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
