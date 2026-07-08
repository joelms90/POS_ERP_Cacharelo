import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'common/colors.dart';
import 'common/app_state.dart';
import 'waiter/waiter_ordering_screen.dart';
import 'cashier/cashier_dashboard_screen.dart';
import 'kitchen/kitchen_dashboard_screen.dart';
import 'widgets/offline_status_bar.dart';

class LoginScreen extends StatefulWidget {
  final AppState state;

  const LoginScreen({super.key, required this.state});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String pin = "";
  bool hasError = false;
  String errorMessage = "";

  // Terminal Activation Controllers
  final TextEditingController _jsonController = TextEditingController();
  final TextEditingController _businessIdController = TextEditingController(
    text: 'd3b07384-d113-4a0e-a555-e5b12824bf01',
  );
  final TextEditingController _branchIdController = TextEditingController();
  final TextEditingController _businessNameController = TextEditingController(
    text: 'Empire POS',
  );
  final TextEditingController _branchNameController = TextEditingController(
    text: 'Sucursal Centro',
  );
  final TextEditingController _apiUrlController = TextEditingController(
    text: 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api',
  );

  bool _showManualConfig = false;
  String _activationError = "";

  @override
  void dispose() {
    _jsonController.dispose();
    _businessIdController.dispose();
    _branchIdController.dispose();
    _businessNameController.dispose();
    _branchNameController.dispose();
    _apiUrlController.dispose();
    super.dispose();
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: EmpireColors.textGold, fontSize: 13),
      filled: true,
      fillColor: EmpireColors.charcoalSurface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(
          color: EmpireColors.agedBronze,
          width: 1.5,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(
          color: EmpireColors.agedBronzeDark,
          width: 1.5,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(
          color: EmpireColors.champagneGold,
          width: 1.5,
        ),
      ),
    );
  }

  Widget _buildActivationView() {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 450),
        padding: const EdgeInsets.all(32.0),
        margin: const EdgeInsets.all(16.0),
        decoration: BoxDecoration(
          color: EmpireColors.onyxSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: EmpireColors.agedBronze, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.qr_code_scanner,
                size: 48,
                color: EmpireColors.textGold,
              ),
              const SizedBox(height: 16),
              const Text(
                'VINCULAR DISPOSITIVO POS',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EmpireColors.textGold,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Configure el dispositivo escaneando el código de activación o ingresando el UUID de la sucursal.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 24),

              if (_activationError.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: EmpireColors.errorRed.withOpacity(0.1),
                    border: Border.all(
                      color: EmpireColors.errorRed.withOpacity(0.3),
                    ),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _activationError,
                    style: const TextStyle(
                      color: EmpireColors.errorRed,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              if (!_showManualConfig) ...[
                TextField(
                  controller: _jsonController,
                  maxLines: 1,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                  decoration: _inputDecoration('Código de Activación (UUID)'),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _startCameraScan,
                        icon: const Icon(Icons.camera_alt),
                        label: const Text(
                          'ESCANEAR QR',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: EmpireColors.champagneGold,
                          foregroundColor: EmpireColors.obsidian,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _processCodeActivation,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: EmpireColors.charcoalSurface,
                          foregroundColor: EmpireColors.textGold,
                          side: const BorderSide(
                            color: EmpireColors.agedBronze,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Text(
                          'VINCULAR CÓDIGO',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                TextField(
                  controller: _businessIdController,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: _inputDecoration('ID de Negocio (businessId)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _branchIdController,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: _inputDecoration('ID de Sucursal (branchId)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _businessNameController,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: _inputDecoration('Nombre del Negocio'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _branchNameController,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: _inputDecoration('Nombre de la Sucursal'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _apiUrlController,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: _inputDecoration('API URL Base'),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _processManualActivation,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.champagneGold,
                    foregroundColor: EmpireColors.obsidian,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'GUARDAR CONFIGURACIÓN',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],

              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  setState(() {
                    _showManualConfig = !_showManualConfig;
                    _activationError = "";
                  });
                },
                child: Text(
                  _showManualConfig
                      ? 'Volver a Activación por QR/JSON'
                      : 'Configuración Manual',
                  style: const TextStyle(
                    color: EmpireColors.textGold,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _processCodeActivation() async {
    final String code = _jsonController.text.trim();
    if (code.isEmpty) {
      setState(() {
        _activationError = "El código de activación no puede estar vacío.";
      });
      return;
    }

    final RegExp uuidRegex = RegExp(
      r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    );
    final Match? match = uuidRegex.firstMatch(code);
    final String cleanCode = match != null ? match.group(0)! : code;

    setState(() {
      _activationError = "";
    });

    final success = await widget.state.configureTerminalWithCode(cleanCode);
    if (success) {
      setState(() {
        _jsonController.clear();
      });
    } else {
      setState(() {
        _activationError =
            "No se pudo vincular la terminal. Verifique que el código UUID sea correcto y que el servidor de sincronización esté activo.";
      });
    }
  }

  void _processManualActivation() async {
    final String bId = _businessIdController.text.trim();
    final String brId = _branchIdController.text.trim();
    final String bName = _businessNameController.text.trim();
    final String brName = _branchNameController.text.trim();
    final String url = _apiUrlController.text.trim();

    if (bId.isEmpty || brId.isEmpty || url.isEmpty) {
      setState(() {
        _activationError =
            "Los campos de ID de Negocio, ID de Sucursal y URL Base son obligatorios.";
      });
      return;
    }

    await widget.state.configureTerminal(
      businessId: bId,
      branchId: brId,
      businessName: bName.isNotEmpty ? bName : "Empire POS",
      branchName: brName.isNotEmpty ? brName : "Sucursal",
      apiUrl: url,
    );

    setState(() {
      _activationError = "";
    });
  }

  void _startCameraScan() async {
    final String? scannedValue = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (context) => const QrScannerDialog()),
    );

    if (scannedValue != null && scannedValue.isNotEmpty) {
      _jsonController.text = scannedValue;
      _processCodeActivation();
    }
  }

  void _handleKeyPress(String value) {
    if (pin.length >= 4) return;
    setState(() {
      hasError = false;
      pin += value;
    });

    if (pin.length == 4) {
      _processLogin();
    }
  }

  void _handleDelete() {
    if (pin.isNotEmpty) {
      setState(() {
        hasError = false;
        pin = pin.substring(0, pin.length - 1);
      });
    }
  }

  void _handleClear() {
    setState(() {
      hasError = false;
      pin = "";
    });
  }

  void _processLogin() async {
    // Simulate brief processing time for premium feel
    await Future.delayed(const Duration(milliseconds: 300));

    final success = await widget.state.login(pin);
    if (success) {
      _handleClear();
      Widget nextScreen;

      switch (widget.state.currentUserRole) {
        case UserRole.waiter:
          nextScreen = WaiterOrderingScreen(state: widget.state);
          break;
        case UserRole.cashier:
          nextScreen = CashierDashboardScreen(state: widget.state);
          break;
        case UserRole.kitchen:
          nextScreen = KitchenDashboardScreen(state: widget.state);
          break;
        default:
          return;
      }

      if (mounted) {
        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) => nextScreen,
            transitionsBuilder:
                (context, animation, secondaryAnimation, child) {
                  const begin = Offset(0.0, 1.0);
                  const end = Offset.zero;
                  const curve = Curves.easeInOutQuart;
                  var tween = Tween(
                    begin: begin,
                    end: end,
                  ).chain(CurveTween(curve: curve));
                  return SlideTransition(
                    position: animation.drive(tween),
                    child: child,
                  );
                },
            transitionDuration: const Duration(milliseconds: 600),
          ),
        );
      }
    } else {
      setState(() {
        hasError = true;
        errorMessage = "Código PIN incorrecto";
        pin = "";
      });
      // Vibrate/Shake indicator feedback
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted && hasError) {
          setState(() {
            hasError = false;
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            // Top Offline Status bar
            ListenableBuilder(
              listenable: widget.state,
              builder: (context, _) => OfflineStatusBar(state: widget.state),
            ),

            Expanded(
              child: ListenableBuilder(
                listenable: widget.state,
                builder: (context, _) {
                  if (!widget.state.isTerminalConfigured) {
                    return _buildActivationView();
                  }
                  return LayoutBuilder(
                    builder: (context, constraints) {
                      final isLandscape = constraints.maxWidth > 700;
                      final isCompactHeight = constraints.maxHeight < 660;
                      final panelPadding = EdgeInsets.symmetric(
                        horizontal: isCompactHeight ? 28 : 40,
                        vertical: isCompactHeight ? 12 : 20,
                      );
                      final titleGap = isCompactHeight ? 16.0 : 30.0;
                      final indicatorGap = isCompactHeight ? 12.0 : 20.0;
                      final keypadGap = isCompactHeight ? 14.0 : 30.0;
                      final footerGap = isCompactHeight ? 10.0 : 24.0;
                      final keypadWidth = isCompactHeight ? 280.0 : 320.0;
                      return Row(
                        children: [
                          // Left branding side (takes full width if portrait)
                          if (isLandscape)
                            Expanded(flex: 12, child: _buildBrandingPanel()),

                          // Right Keypad side
                          Expanded(
                            flex: 10,
                            child: Container(
                              padding: panelPadding,
                              decoration: BoxDecoration(
                                border: isLandscape
                                    ? const Border(
                                        left: BorderSide(
                                          color: EmpireColors.agedBronzeDark,
                                          width: 1.5,
                                        ),
                                      )
                                    : null,
                              ),
                              child: Center(
                                child: SingleChildScrollView(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        '${widget.state.terminalBusinessName} - ${widget.state.terminalBranchName}'
                                            .toUpperCase(),
                                        textAlign: TextAlign.center,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium
                                            ?.copyWith(
                                              color: EmpireColors.textGold,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 1.2,
                                              fontSize: 14,
                                            ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'INGRESAR CREDENCIAL',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium
                                            ?.copyWith(
                                              color: Colors.white54,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 1.5,
                                              fontSize: 10,
                                            ),
                                      ),
                                      SizedBox(height: titleGap),

                                      // PIN Code indicators
                                      _buildPinIndicators(
                                        compact: isCompactHeight,
                                      ),

                                      SizedBox(height: indicatorGap),

                                      if (hasError)
                                        Text(
                                          errorMessage,
                                          style: const TextStyle(
                                            color: EmpireColors.errorRed,
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        )
                                      else
                                        SizedBox(
                                          height: isCompactHeight ? 12 : 18,
                                        ),

                                      SizedBox(height: keypadGap),

                                      // Numeric Keyboard
                                      Container(
                                        constraints: BoxConstraints(
                                          maxWidth: keypadWidth,
                                        ),
                                        child: _buildKeypadGrid(
                                          compact: isCompactHeight,
                                        ),
                                      ),

                                      SizedBox(height: footerGap),
                                      TextButton(
                                        onPressed: () {
                                          widget.state.deconfigureTerminal();
                                        },
                                        style: TextButton.styleFrom(
                                          visualDensity: isCompactHeight
                                              ? VisualDensity.compact
                                              : VisualDensity.standard,
                                          padding: EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: isCompactHeight ? 6 : 10,
                                          ),
                                          minimumSize: Size.zero,
                                          tapTargetSize:
                                              MaterialTapTargetSize.shrinkWrap,
                                        ),
                                        child: const Text(
                                          'Vincular a otra Sucursal',
                                          style: TextStyle(
                                            color: Colors.white38,
                                            fontSize: 11,
                                            decoration:
                                                TextDecoration.underline,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrandingPanel() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [EmpireColors.obsidian, EmpireColors.onyxSurface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: EmpireColors.champagneGold,
                    width: 1.5,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Image.asset(
                  'assets/logo.png',
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 40),
              Text(
                'Cacharelo Restaurant',
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  fontSize: 40,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: 80,
                height: 1,
                color: EmpireColors.champagneGold,
              ),
              const SizedBox(height: 24),
              Text(
                'Sistema de Punto de Venta y Gestión de Recursos. Diseñado con autoría local para operación continua offline.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: EmpireColors.textSecondary,
                  height: 1.6,
                ),
              ),
              const SizedBox(height: 40),
              Row(
                children: [
                  const Icon(
                    Icons.wifi_off,
                    color: EmpireColors.agedBronze,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Seguridad Offline-First Activa',
                      style: TextStyle(
                        color: EmpireColors.agedBronze.withOpacity(0.9),
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPinIndicators({bool compact = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (index) {
        final isActive = index < pin.length;
        return Container(
          margin: EdgeInsets.symmetric(horizontal: compact ? 9 : 12),
          width: compact ? 14 : 18,
          height: compact ? 14 : 18,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? EmpireColors.champagneGold : Colors.transparent,
            border: Border.all(
              color: hasError
                  ? EmpireColors.errorRed
                  : (isActive
                        ? EmpireColors.champagneGold
                        : EmpireColors.agedBronze),
              width: 2,
            ),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: EmpireColors.champagneGold.withOpacity(0.5),
                      blurRadius: 8,
                      spreadRadius: 1,
                    ),
                  ]
                : null,
          ),
        );
      }),
    );
  }

  Widget _buildKeypadGrid({bool compact = false}) {
    final keys = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["C", "0", "del"],
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: compact ? 10 : 16,
        mainAxisSpacing: compact ? 10 : 16,
        childAspectRatio: compact ? 1.3 : 1.15,
      ),
      itemCount: 12,
      itemBuilder: (context, index) {
        final row = index ~/ 3;
        final col = index % 3;
        final val = keys[row][col];

        return _buildKeypadButton(val);
      },
    );
  }

  Widget _buildKeypadButton(String label) {
    final isAction = label == "C" || label == "del";

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (label == "C") {
            _handleClear();
          } else if (label == "del") {
            _handleDelete();
          } else {
            _handleKeyPress(label);
          }
        },
        borderRadius: BorderRadius.circular(40),
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: EmpireColors.onyxSurface,
            border: Border.all(
              color: isAction
                  ? EmpireColors.agedBronzeDark
                  : EmpireColors.agedBronze,
              width: 1.2,
            ),
          ),
          alignment: Alignment.center,
          child: _buildButtonContent(label),
        ),
      ),
    );
  }

  Widget _buildButtonContent(String label) {
    if (label == "del") {
      return const Icon(
        Icons.backspace_outlined,
        color: EmpireColors.textPrimary,
        size: 20,
      );
    }
    if (label == "C") {
      return const Text(
        "C",
        style: TextStyle(
          color: EmpireColors.errorRed,
          fontWeight: FontWeight.bold,
          fontSize: 20,
        ),
      );
    }
    return Text(
      label,
      style: const TextStyle(
        color: EmpireColors.textPrimary,
        fontWeight: FontWeight.bold,
        fontSize: 24,
      ),
    );
  }
}

class QrScannerDialog extends StatefulWidget {
  const QrScannerDialog({super.key});

  @override
  State<QrScannerDialog> createState() => _QrScannerDialogState();
}

class _QrScannerDialogState extends State<QrScannerDialog> {
  late final MobileScannerController controller;
  bool _isClosing = false;
  bool _hasCameraPermission = false;
  String? _scannerError;

  @override
  void initState() {
    super.initState();
    controller = MobileScannerController(
      autoStart: false,
      detectionSpeed: DetectionSpeed.noDuplicates,
      formats: const [BarcodeFormat.qrCode],
    );
    _prepareScanner();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> _prepareScanner() async {
    final status = await Permission.camera.request();
    if (!mounted) return;

    if (!status.isGranted) {
      setState(() {
        _hasCameraPermission = false;
        _scannerError =
            'Permiso de cámara denegado. Active la cámara o ingrese el código manualmente.';
      });
      return;
    }

    setState(() {
      _hasCameraPermission = true;
      _scannerError = null;
    });

    try {
      await controller.start();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _scannerError = 'No se pudo iniciar la cámara: $error';
      });
    }
  }

  Future<void> _finishScan(String value) async {
    if (_isClosing || !mounted) return;
    _isClosing = true;

    try {
      await controller.stop();
    } catch (_) {
      // The route is closing anyway; scanner shutdown errors should not block.
    }

    if (mounted) {
      Navigator.of(context).pop(value);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Escanee el Código QR',
          style: TextStyle(color: EmpireColors.textGold, fontSize: 16),
        ),
        backgroundColor: EmpireColors.obsidian,
        iconTheme: const IconThemeData(color: EmpireColors.textGold),
      ),
      backgroundColor: Colors.black,
      body: _hasCameraPermission && _scannerError == null
          ? MobileScanner(
              controller: controller,
              errorBuilder: (context, error, child) {
                final details = error.errorDetails?.message;
                return _buildScannerMessage(
                  details == null || details.isEmpty
                      ? 'No se pudo abrir el escáner (${error.errorCode.name}).'
                      : details,
                );
              },
              onDetect: (capture) {
                for (final barcode in capture.barcodes) {
                  final value = barcode.rawValue?.trim();
                  if (value != null && value.isNotEmpty) {
                    _finishScan(value);
                    break;
                  }
                }
              },
            )
          : _buildScannerMessage(
              _scannerError ?? 'Preparando cámara...',
              showProgress: _scannerError == null,
            ),
    );
  }

  Widget _buildScannerMessage(String message, {bool showProgress = false}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showProgress)
              const CircularProgressIndicator(color: EmpireColors.textGold)
            else
              const Icon(
                Icons.error_outline,
                color: EmpireColors.errorRed,
                size: 40,
              ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
