import 'dart:io';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class BluetoothSettingsDialog extends StatefulWidget {
  final AppState state;

  const BluetoothSettingsDialog({super.key, required this.state});

  @override
  State<BluetoothSettingsDialog> createState() =>
      _BluetoothSettingsDialogState();
}

class _BluetoothSettingsDialogState extends State<BluetoothSettingsDialog> {
  List<BluetoothInfo> _devices = [];
  bool _isScanning = false;
  bool _isRefreshingStations = false;
  bool _isBluetoothEnabled = false;
  bool _hasPermissions = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkStatusAndScan();
    _refreshPrintStations();
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

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: EmpireColors.successGreen,
        content: Text('Caja seleccionada: ${station.deviceName}'),
      ),
    );
  }

  Future<void> _checkStatusAndScan() async {
    setState(() {
      _isScanning = true;
      _errorMessage = null;
    });

    try {
      // 1. Check/Request permissions on Android
      bool permissionGranted =
          await PrintBluetoothThermal.isPermissionBluetoothGranted;
      if (!permissionGranted && Platform.isAndroid) {
        final statusConnect = await Permission.bluetoothConnect.request();
        final statusScan = await Permission.bluetoothScan.request();
        permissionGranted = statusConnect.isGranted && statusScan.isGranted;
      }
      _hasPermissions = permissionGranted;

      if (!permissionGranted) {
        setState(() {
          _isScanning = false;
          _errorMessage =
              'Permisos de Bluetooth no concedidos. Por favor, permítelos en la configuración.';
        });
        return;
      }

      // 2. Check if Bluetooth is turned on
      final bluetoothOn = await PrintBluetoothThermal.bluetoothEnabled;
      setState(() {
        _isBluetoothEnabled = bluetoothOn;
      });

      if (!bluetoothOn) {
        setState(() {
          _isScanning = false;
          _errorMessage =
              'El Bluetooth está apagado. Por favor, enciéndalo en su dispositivo.';
        });
        return;
      }

      // 3. Scan/Fetch paired devices
      final List<BluetoothInfo> list =
          await PrintBluetoothThermal.pairedBluetooths;
      setState(() {
        _devices = list;
        _isScanning = false;
      });
    } catch (e) {
      final isMissingPlugin = e.toString().contains('MissingPluginException') ||
          e.toString().contains('No implementation found');
      if (isMissingPlugin) {
        setState(() {
          _devices = [
            BluetoothInfo(
                name: 'Impresora M58-LL (Simulada)',
                macAdress: '00:11:22:33:44:55'),
          ];
          _hasPermissions = true;
          _isBluetoothEnabled = true;
          _isScanning = false;
          _errorMessage =
              'Entorno de simulador o canal no implementado. Se habilitó una Impresora M58-LL Simulada para pruebas. (Nota: Si es un dispositivo real, detenga la app y ejecute un build completo/reconstrucción).';
        });
      } else {
        setState(() {
          _isScanning = false;
          _errorMessage = 'Ocurrió un error al buscar dispositivos: $e';
        });
      }
    }
  }

  Future<void> _handleConnect(BluetoothInfo device) async {
    final success =
        await widget.state.connectToPrinter(device.macAdress, device.name);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor:
            success ? EmpireColors.successGreen : EmpireColors.errorRed,
        content: Text(
          success
              ? 'Conectado exitosamente a ${device.name}'
              : 'Error al conectar con ${device.name}. Verifique que la impresora esté encendida.',
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
    if (widget.state.connectedPrinterMac == null) return;

    final printJob = PrintJob(
      id: 'test_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Prueba de Impresión',
      details: widget.state.formatCenter('*** TICKET DE PRUEBA ***') +
          '\n' +
          widget.state.formatCenter('M58-LL THERMAL PRINTER') +
          '\n' +
          widget.state.formatDivider() +
          '\n' +
          widget.state.formatRow('Estado:', 'ONLINE') +
          '\n' +
          widget.state.formatRow('Conectado a:',
              widget.state.connectedPrinterName ?? 'Impresora') +
          '\n' +
          widget.state.formatDivider() +
          '\n' +
          widget.state.formatCenter('Conexión Bluetooth Exitosa!') +
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
          final isConnected = widget.state.connectedPrinterMac != null;

          return Container(
            constraints: const BoxConstraints(maxWidth: 520, maxHeight: 720),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Row(
                  children: [
                    const Icon(
                      Icons.bluetooth,
                      color: EmpireColors.champagneGold,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Configurar Impresora Bluetooth',
                        style: TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    if (_isScanning || widget.state.isConnectingPrinter)
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
                        onPressed: _checkStatusAndScan,
                        icon: const Icon(Icons.refresh,
                            color: EmpireColors.champagneGold),
                        tooltip: 'Buscar Dispositivos',
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
                              Text(
                                'Dirección MAC: ${widget.state.connectedPrinterMac}',
                                style: const TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton(
                          onPressed: widget.state.isConnectingPrinter
                              ? null
                              : _handleTestPrint,
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
                  _buildPaperWidthSelector(),
                  const SizedBox(height: 12),
                  _buildReceiveRemoteJobsSwitch(),
                  const SizedBox(height: 16),
                ],

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

                _buildPrintStationSection(),
                const SizedBox(height: 16),

                // Device List Title
                const Text(
                  'DISPOSITIVOS VINCULADOS',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 8),

                // Device List
                Expanded(
                  child: _isScanning
                      ? const Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                                EmpireColors.champagneGold),
                          ),
                        )
                      : (_devices.isEmpty
                          ? Center(
                              child: Text(
                                _hasPermissions && _isBluetoothEnabled
                                    ? 'No se encontraron dispositivos vinculados.\nPor favor vincule su impresora M58-LL en los ajustes del sistema.'
                                    : 'Bluetooth inactivo o sin permisos.',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    color: EmpireColors.textSecondary,
                                    fontSize: 13),
                              ),
                            )
                          : ListView.builder(
                              itemCount: _devices.length,
                              itemBuilder: (context, index) {
                                final device = _devices[index];
                                final isCurrent =
                                    widget.state.connectedPrinterMac ==
                                        device.macAdress;

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
                                    title: Text(
                                      device.name,
                                      style: TextStyle(
                                        color: isCurrent
                                            ? EmpireColors.champagneGold
                                            : EmpireColors.textPrimary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    subtitle: Text(
                                      device.macAdress,
                                      style: const TextStyle(
                                          color: EmpireColors.textSecondary,
                                          fontSize: 11),
                                    ),
                                    trailing: isCurrent
                                        ? OutlinedButton(
                                            onPressed:
                                                widget.state.isConnectingPrinter
                                                    ? null
                                                    : _handleDisconnect,
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
                                            onPressed: widget
                                                    .state.isConnectingPrinter
                                                ? null
                                                : () => _handleConnect(device),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor:
                                                  EmpireColors.agedBronze,
                                              foregroundColor:
                                                  EmpireColors.textPrimary,
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 16),
                                            ),
                                            child: widget.state
                                                        .isConnectingPrinter &&
                                                    widget.state
                                                            .connectedPrinterMac ==
                                                        device.macAdress
                                                ? const SizedBox(
                                                    width: 14,
                                                    height: 14,
                                                    child:
                                                        CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                      valueColor:
                                                          AlwaysStoppedAnimation<
                                                                  Color>(
                                                              Colors.white),
                                                    ),
                                                  )
                                                : const Text('CONECTAR',
                                                    style: TextStyle(
                                                        fontSize: 11)),
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
                  'CAJA PARA COMANDAS',
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
              'No hay cajas configuradas. Aun puedes enviar comandas a Cola de caja; cualquier cajero con Recibir comandas activo las imprimira al sincronizar.',
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
                                station.presenceLabel,
                                style: TextStyle(
                                  color: station.online
                                      ? EmpireColors.successGreen
                                      : EmpireColors.warningOrange,
                                  fontSize: 9,
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
                  ? 'Este dispositivo está disponible para imprimir comandas.'
                  : 'Actívalo para usar esta impresora como estación.')
              : 'Configura la sucursal e inicia sesión para activar esta estación.',
          style: const TextStyle(
            color: EmpireColors.textSecondary,
            fontSize: 11,
          ),
        ),
      ),
    );
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
}
