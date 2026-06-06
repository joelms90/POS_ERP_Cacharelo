import 'package:flutter/material.dart';
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
    
    final success = widget.state.login(pin);
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
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              const begin = Offset(0.0, 1.0);
              const end = Offset.zero;
              const curve = Curves.easeInOutQuart;
              var tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
              return SlideTransition(position: animation.drive(tween), child: child);
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

  void _simulateBiometrics() {
    setState(() {
      hasError = false;
      pin = "1111"; // Simulate waiter login with biometric cached credential
    });
    _processLogin();
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
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isLandscape = constraints.maxWidth > 700;
                  return Row(
                    children: [
                      // Left branding side (takes full width if portrait)
                      if (isLandscape)
                        Expanded(
                          flex: 12,
                          child: _buildBrandingPanel(),
                        ),
                      
                      // Right Keypad side
                      Expanded(
                        flex: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 20),
                          decoration: BoxDecoration(
                            border: isLandscape
                                ? const Border(left: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5))
                                : null,
                          ),
                          child: Center(
                            child: SingleChildScrollView(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'INGRESAR CREDENCIAL',
                                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color: EmpireColors.textGold,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.5,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(height: 30),
                                  
                                  // PIN Code indicators
                                  _buildPinIndicators(),
                                  
                                  const SizedBox(height: 20),
                                  
                                  if (hasError)
                                    Text(
                                      errorMessage,
                                      style: const TextStyle(color: EmpireColors.errorRed, fontSize: 13, fontWeight: FontWeight.bold),
                                    )
                                  else
                                    const SizedBox(height: 18),
                                    
                                  const SizedBox(height: 30),
                                  
                                  // Numeric Keyboard
                                  Container(
                                    constraints: const BoxConstraints(maxWidth: 320),
                                    child: _buildKeypadGrid(),
                                  ),

                                  const SizedBox(height: 20),
                                  _buildMockCredentialCheatSheet(),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
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
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: EmpireColors.champagneGold, width: 1.5),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Icon(
              Icons.restaurant_menu,
              color: EmpireColors.champagneGold,
              size: 40,
            ),
          ),
          const SizedBox(height: 40),
          Text(
            'EMPIRE NOIR',
            style: Theme.of(context).textTheme.displayLarge?.copyWith(
              fontSize: 48,
              letterSpacing: 3,
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
              const Icon(Icons.wifi_off, color: EmpireColors.agedBronze, size: 20),
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

  Widget _buildPinIndicators() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (index) {
        final isActive = index < pin.length;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? EmpireColors.champagneGold : Colors.transparent,
            border: Border.all(
              color: hasError
                  ? EmpireColors.errorRed
                  : (isActive ? EmpireColors.champagneGold : EmpireColors.agedBronze),
              width: 2,
            ),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: EmpireColors.champagneGold.withOpacity(0.5),
                      blurRadius: 8,
                      spreadRadius: 1,
                    )
                  ]
                : null,
          ),
        );
      }),
    );
  }

  Widget _buildKeypadGrid() {
    final keys = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["C", "0", "del"]
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 1.15,
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
              color: isAction ? EmpireColors.agedBronzeDark : EmpireColors.agedBronze,
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
      return const Icon(Icons.backspace_outlined, color: EmpireColors.textPrimary, size: 20);
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

  Widget _buildMockCredentialCheatSheet() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 4,
            children: [
              const Text(
                'PINs de Acceso Rápido:',
                style: TextStyle(
                  color: EmpireColors.champagneGold,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
              GestureDetector(
                onTap: _simulateBiometrics,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.fingerprint, color: EmpireColors.champagneGold, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      'Biometría',
                      style: TextStyle(
                        color: EmpireColors.champagneGold.withOpacity(0.9),
                        fontSize: 10,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: const [
              Text('Mesero: 1111', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 11)),
              Text('Cajero: 2222', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 11)),
              Text('Cocina: 3333', style: TextStyle(color: EmpireColors.textSecondary, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}
