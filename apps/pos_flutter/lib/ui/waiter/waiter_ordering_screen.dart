import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../widgets/table_node.dart';
import '../widgets/menu_card.dart';
import '../widgets/custom_toast.dart';
import '../widgets/printer_monitor_panel.dart';
import '../widgets/bluetooth_settings_dialog.dart';
import '../login_screen.dart';
import 'modifier_dialog.dart';
import 'cart_sidebar.dart';
import 'payment_flow_dialog.dart';
import 'zone_tabs.dart';

class WaiterOrderingScreen extends StatefulWidget {
  final AppState state;

  const WaiterOrderingScreen({super.key, required this.state});

  @override
  State<WaiterOrderingScreen> createState() => _WaiterOrderingScreenState();
}

class _WaiterOrderingScreenState extends State<WaiterOrderingScreen> {
  String selectedZone = 'Salón Principal';
  TableModel? activeOrderingTable;
  List<OrderItem> currentCart = [];
  String selectedMenuCategory = 'Pastas';

  bool isPrinterQueueOpen = false;
  bool isCartOpen = false;

  List<String> activeGenders = ['M'];
  int selectedGuestIndex = 0;

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

    final bool success = await widget.state.syncAllData();

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

  String _getGenderEmoji(String gender) {
    switch (gender) {
      case 'F':
        return '👩';
      case 'K':
        return '🧒';
      case 'M':
      default:
        return '👨';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: widget.state,
          builder: (context, _) {
            final zones = widget.state.tables.map((t) => t.zone).toSet().toList();
            if (zones.isNotEmpty && !zones.contains(selectedZone)) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  setState(() {
                    selectedZone = zones.first;
                  });
                }
              });
            }

            final tablesInZone = widget.state.tables
                .where((t) => t.zone == selectedZone)
                .toList();
            final categories = AppState.menu
                .map((item) => item.category)
                .toSet()
                .toList();

            return Stack(
              children: [
                Column(
                  children: [
                    // Consolidated Navigation, Tools & Status Header
                    _buildHeader(context),

                    // Main Panel (Dynamic based on whether a table is selected for ordering)
                    Expanded(
                      child: Row(
                        children: [
                          // Left side: Floor map OR Menu selection OR Full-screen Cart
                          Expanded(
                            flex: 3,
                            child: activeOrderingTable == null
                                ? _buildFloorMap(tablesInZone)
                                : (isCartOpen
                                      ? CartSidebar(
                                          table: activeOrderingTable!,
                                          initialItems: currentCart,
                                          activeGenders: activeGenders,
                                          onRemoveGuest: _handleRemoveGuest,
                                          onBillingRequested: () async {
                                            final result = await showDialog<String>(
                                              context: context,
                                              builder: (context) => PaymentFlowDialog(
                                                table: activeOrderingTable!,
                                                state: widget.state,
                                              ),
                                            );
                                            if (result != null) {
                                              if (!context.mounted) return;
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(
                                                  backgroundColor: EmpireColors.successGreen,
                                                  content: Text(
                                                    result == 'efectivo'
                                                        ? 'Mesa ${activeOrderingTable!.label} marcada POR COBRAR y pre-cuenta enviada a caja.'
                                                        : 'Cobro con tarjeta completado. Mesa ${activeOrderingTable!.label} en limpieza.',
                                                  ),
                                                ),
                                              );
                                              setState(() {
                                                activeOrderingTable = null;
                                                currentCart = [];
                                                isCartOpen = false;
                                              });
                                            }
                                          },
                                          onBackToMenu: () => setState(
                                            () => isCartOpen = false,
                                          ),
                                          onConfirm: (finalItems, guests, shouldPrint) {
                                            widget.state.submitOrder(
                                              activeOrderingTable!.id,
                                              finalItems,
                                              guests,
                                              activeGenders,
                                              printComanda: shouldPrint,
                                            );

                                            ScaffoldMessenger.of(
                                              context,
                                            ).showSnackBar(
                                              SnackBar(
                                                backgroundColor:
                                                    EmpireColors.successGreen,
                                                content: Text(
                                                  shouldPrint
                                                      ? '¡Pedido confirmado para la ${activeOrderingTable!.label}! Comanda enviada e imprimiendo...'
                                                      : '¡Pedido confirmado para la ${activeOrderingTable!.label}! Comanda enviada.',
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            );

                                            setState(() {
                                              activeOrderingTable = null;
                                              currentCart = [];
                                              isCartOpen = false;
                                            });
                                          },
                                          onCancel: () {
                                            setState(() {
                                              activeOrderingTable = null;
                                              currentCart = [];
                                              isCartOpen = false;
                                            });
                                          },
                                        )
                                      : _buildMenuSection(categories)),
                          ),

                          // Right side: Info sidebar (only when no table is selected and cart is closed)
                          if (activeOrderingTable == null)
                            Expanded(flex: 1, child: _buildInfoSidebar()),
                        ],
                      ),
                    ),
                  ],
                ),

                // Slide-out Printer Queue panel
                if (isPrinterQueueOpen)
                  Positioned(
                    top: 0,
                    bottom: 0,
                    right: 0,
                    child: Material(
                      elevation: 16,
                      color: Colors.transparent,
                      child: Container(
                        decoration: const BoxDecoration(
                          boxShadow: [
                            BoxShadow(color: Colors.black54, blurRadius: 20),
                          ],
                        ),
                        child: PrinterMonitorPanel(
                          state: widget.state,
                          onClose: () =>
                              setState(() => isPrinterQueueOpen = false),
                        ),
                      ),
                    ),
                  ),

                // Floating Notification Toast Overlay
                if (widget.state.readyNotifications.isNotEmpty)
                  CustomToast(
                    message: widget.state.readyNotifications.first,
                    onDismiss: () {
                      widget.state.clearNotification(
                        widget.state.readyNotifications.first,
                      );
                    },
                  ),
              ],
            );
          },
        ),
      ),
      floatingActionButton: activeOrderingTable != null && !isCartOpen
          ? FloatingActionButton.extended(
              onPressed: () => setState(() => isCartOpen = true),
              backgroundColor: EmpireColors.champagneGold,
              icon: const Icon(
                Icons.shopping_basket,
                color: EmpireColors.obsidian,
              ),
              label: Text(
                'VER COMANDA (${currentCart.fold<int>(0, (sum, i) => sum + i.quantity)}) - \$${currentCart.fold<double>(0.0, (sum, i) => sum + i.totalPrice).toStringAsFixed(2)}',
                style: const TextStyle(
                  color: EmpireColors.obsidian,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildHeader(BuildContext context) {
    final hasFailedPrinters = widget.state.printJobs.any(
      (job) => job.status == 'failed',
    );

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(
          bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left Side: Context & Action
          Row(
            children: [
              if (activeOrderingTable != null) ...[
                // Back arrow - context-dependent back navigation (comes first)
                IconButton(
                  icon: const Icon(
                    Icons.arrow_back,
                    color: EmpireColors.textPrimary,
                  ),
                  tooltip: isCartOpen ? 'Volver al Menú' : 'Volver al Mapa',
                  onPressed: () {
                    setState(() {
                      if (isCartOpen) {
                        isCartOpen = false;
                      } else {
                        activeOrderingTable = null;
                        currentCart = [];
                      }
                    });
                  },
                ),
                const SizedBox(width: 12),

                // Table Context Badge (with a small table_restaurant icon)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: EmpireColors.champagneGold.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: EmpireColors.champagneGold,
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.table_restaurant,
                        color: EmpireColors.champagneGold,
                        size: 14,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        activeOrderingTable!.label.toUpperCase(),
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),

          // Right Side: Sections + Tools
          Row(
            children: [
              // --- SUB-GROUP 1: Section Navigation ---
              IconButton(
                icon: Icon(
                  Icons.table_bar,
                  color: activeOrderingTable == null
                      ? EmpireColors.champagneGold
                      : EmpireColors.textSecondary,
                ),
                tooltip: 'Distribución de Mesas',
                onPressed: activeOrderingTable == null
                    ? null
                    : () {
                        setState(() {
                          activeOrderingTable = null;
                          currentCart = [];
                          isCartOpen = false;
                        });
                      },
              ),
              if (activeOrderingTable != null) ...[
                const SizedBox(width: 8),
                IconButton(
                  icon: Icon(
                    Icons.shopping_basket,
                    color: isCartOpen
                        ? EmpireColors.champagneGold
                        : EmpireColors.textSecondary,
                  ),
                  tooltip: 'Detalle de Comanda',
                  onPressed: () {
                    setState(() => isCartOpen = !isCartOpen);
                  },
                ),
              ],

              const SizedBox(width: 12),

              // --- Divider ---
              Container(
                height: 20,
                width: 1.5,
                color: EmpireColors.agedBronzeDark,
              ),

              const SizedBox(width: 12),

              // --- SUB-GROUP 2: Status & Tools ---
              Icon(
                widget.state.isOnline ? Icons.wifi : Icons.wifi_off,
                color: widget.state.isOnline
                    ? EmpireColors.successGreen
                    : EmpireColors.warningOrange,
                size: 20,
              ),
              const SizedBox(width: 12),
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.sync, color: EmpireColors.textGold, size: 20),
                tooltip: 'Sincronizar Datos',
                onPressed: () => _triggerSync(context),
              ),
              if (!widget.state.isOnline) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: EmpireColors.warningOrange.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: EmpireColors.warningOrange.withOpacity(0.4),
                    ),
                  ),
                  child: Text(
                    '${widget.state.pendingSyncCount}',
                    style: const TextStyle(
                      color: EmpireColors.warningOrange,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
              ],

              if (!isCartOpen) ...[
                const SizedBox(width: 16),
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    IconButton(
                      icon: Icon(
                        Icons.print,
                        color: hasFailedPrinters
                            ? EmpireColors.errorRed
                            : EmpireColors.champagneGold,
                      ),
                      tooltip: 'Monitor de Impresoras',
                      onPressed: () {
                        setState(
                          () => isPrinterQueueOpen = !isPrinterQueueOpen,
                        );
                      },
                    ),
                    if (hasFailedPrinters)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: EmpireColors.errorRed,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '${widget.state.printJobs.where((j) => j.status == 'failed').length}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(width: 12),

                // Gear Menu Popup (Infrequent Actions)
                PopupMenuButton<String>(
                  icon: const Icon(
                    Icons.settings,
                    color: EmpireColors.champagneGold,
                  ),
                  color: EmpireColors.onyxSurface,
                  surfaceTintColor: Colors.transparent,
                  offset: const Offset(0, 40),
                  onSelected: (value) {
                    if (value == 'logout') {
                      widget.state.logout();
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute(
                          builder: (context) =>
                              LoginScreen(state: widget.state),
                        ),
                      );
                    } else if (value == 'printer') {
                      showDialog(
                        context: context,
                        builder: (context) =>
                            BluetoothSettingsDialog(state: widget.state),
                      );
                    }
                  },
                  itemBuilder: (BuildContext context) => [
                    const PopupMenuItem<String>(
                      value: 'printer',
                      child: Row(
                        children: [
                          Icon(
                            Icons.print,
                            color: EmpireColors.champagneGold,
                            size: 18,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Configurar Impresora',
                            style: TextStyle(
                              color: EmpireColors.textPrimary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const PopupMenuDivider(height: 1),
                    // Connection Simulator Switch in dropdown
                    PopupMenuItem<String>(
                      enabled:
                          false, // Make it non-clickable as a whole menu item, so the switch is interactive
                      child: StatefulBuilder(
                        builder: (context, setStateDropdown) {
                          return Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Row(
                                children: [
                                  Icon(
                                    Icons.sync_alt,
                                    color: EmpireColors.textSecondary,
                                    size: 18,
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    'Simular Conexión',
                                    style: TextStyle(
                                      color: EmpireColors.textPrimary,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                              Switch(
                                value: widget.state.isOnline,
                                onChanged: (val) {
                                  widget.state.toggleConnection();
                                  if (widget.state.isOnline) {
                                    widget.state.syncOfflineTransactions();
                                  }
                                  setState(() {});
                                  setStateDropdown(() {});
                                },
                                activeColor: EmpireColors.successGreen,
                                activeTrackColor: EmpireColors.successGreen
                                    .withOpacity(0.2),
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                    const PopupMenuDivider(height: 1),
                    const PopupMenuItem<String>(
                      value: 'logout',
                      child: Row(
                        children: [
                          Icon(
                            Icons.logout,
                            color: EmpireColors.errorRed,
                            size: 18,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Cerrar Sesión',
                            style: TextStyle(
                              color: EmpireColors.textPrimary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFloorMap(List<TableModel> tables) {
    return Column(
      children: [
        // Zone Tabs Bar
        ZoneTabs(
          selectedZone: selectedZone,
          zones: widget.state.tables.isNotEmpty
              ? widget.state.tables.map((t) => t.zone).toSet().toList()
              : const ['Salón Principal', 'Terraza', 'Bar'],
          onZoneChanged: (zone) {
            setState(() => selectedZone = zone);
          },
        ),

        // Floor map coordinates layout (Option B)
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: EmpireColors.onyxSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: EmpireColors.agedBronzeDark,
                width: 1.5,
              ),
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                return Stack(
                  children: [
                    // Grid background lines for premium design
                    Positioned.fill(
                      child: GridPaper(
                        color: EmpireColors.agedBronzeDark.withOpacity(0.08),
                        divisions: 2,
                        subdivisions: 1,
                        interval: 100,
                      ),
                    ),

                    // Render tables
                    ...tables.map((table) {
                      return Positioned(
                        left: table.x * (constraints.maxWidth - 100),
                        top: table.y * (constraints.maxHeight - 100),
                        child: TableNode(
                          table: table,
                          onTap: () {
                            if (table.state == TableState.cleaning) {
                              // If cleaning, waiter can mark as free
                              widget.state.finishCleaning(table.id);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: EmpireColors.successGreen,
                                  content: Text(
                                    '¡${table.label} disponible para nuevos clientes!',
                                  ),
                                ),
                              );
                            } else {
                              setState(() {
                                activeOrderingTable = table;
                                currentCart = List.from(table.items);
                                isCartOpen = false;
                                activeGenders = List.from(
                                  table.guestGenders.isEmpty
                                      ? ['M']
                                      : table.guestGenders,
                                );
                                selectedGuestIndex = 0;
                              });
                            }
                          },
                        ),
                      );
                    }),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGuestSelectorBar() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(
          bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.people_outline,
            color: EmpireColors.champagneGold,
            size: 18,
          ),
          const SizedBox(width: 8),
          const Text(
            'COMENSAL:',
            style: TextStyle(
              color: EmpireColors.textGold,
              fontWeight: FontWeight.bold,
              fontSize: 11,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ...List.generate(activeGenders.length, (index) {
                    final isSelected = selectedGuestIndex == index;
                    final gender = activeGenders[index];
                    final emoji = _getGenderEmoji(gender);
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            if (isSelected) {
                              // Cycle gender: M -> F -> K -> M
                              if (gender == 'M') {
                                activeGenders[index] = 'F';
                              } else if (gender == 'F') {
                                activeGenders[index] = 'K';
                              } else {
                                activeGenders[index] = 'M';
                              }
                            } else {
                              selectedGuestIndex = index;
                            }
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? EmpireColors.champagneGold
                                : EmpireColors.charcoalSurface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected
                                  ? EmpireColors.champagneGold
                                  : EmpireColors.agedBronzeDark,
                              width: 1.2,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'P${index + 1}',
                                style: TextStyle(
                                  color: isSelected
                                      ? EmpireColors.obsidian
                                      : EmpireColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(emoji, style: const TextStyle(fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),

                  // Add Guest Button
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        activeGenders.add('M');
                        selectedGuestIndex = activeGenders.length - 1;
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: EmpireColors.charcoalSurface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: EmpireColors.agedBronzeDark,
                          width: 1.2,
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.add,
                            color: EmpireColors.champagneGold,
                            size: 14,
                          ),
                          SizedBox(width: 2),
                          Text(
                            'Pax',
                            style: TextStyle(
                              color: EmpireColors.champagneGold,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (activeGenders.length > 1) ...[
                    const SizedBox(width: 8),
                    // Remove Guest Button
                    GestureDetector(
                      onTap: _handleRemoveGuest,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: EmpireColors.charcoalSurface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: EmpireColors.errorRed.withOpacity(0.4),
                            width: 1.2,
                          ),
                        ),
                        child: const Icon(
                          Icons.remove,
                          color: EmpireColors.errorRed,
                          size: 14,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuSection(List<String> categories) {
    final filteredMenuItems = AppState.menu
        .where((i) => i.category == selectedMenuCategory)
        .toList();

    return Column(
      children: [
        // Comensal Selection Bar
        _buildGuestSelectorBar(),

        // Horizontal Menu Categories tabs
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          color: EmpireColors.obsidian,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: categories.map((cat) {
                final isSelected = selectedMenuCategory == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: ChoiceChip(
                    label: Text(cat),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => selectedMenuCategory = cat);
                      }
                    },
                    selectedColor: EmpireColors.champagneGold,
                    backgroundColor: EmpireColors.onyxSurface,
                    labelStyle: TextStyle(
                      color: isSelected
                          ? EmpireColors.obsidian
                          : EmpireColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                    side: BorderSide(
                      color: isSelected
                          ? EmpireColors.champagneGold
                          : EmpireColors.agedBronzeDark,
                      width: 1,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),

        // Grid of menu items
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(20),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 0.95,
            ),
            itemCount: filteredMenuItems.length,
            itemBuilder: (context, index) {
              final item = filteredMenuItems[index];
              return MenuCard(
                item: item,
                onTap: () => _openModifierDialog(item),
              );
            },
          ),
        ),
      ],
    );
  }

  void _openModifierDialog(MenuItem item) async {
    // Check if item already exists in cart for the CURRENT active guest to prefill (unsent only)
    final existingIndex = currentCart.indexWhere(
      (i) =>
          i.item.id == item.id &&
          i.assignedGuest == 'P${selectedGuestIndex + 1}' &&
          !i.isSent,
    );
    final existingItem = existingIndex != -1
        ? currentCart[existingIndex]
        : null;

    final OrderItem? result = await showDialog<OrderItem>(
      context: context,
      builder: (context) => ModifierDialog(
        item: item,
        existingOrderItem: existingItem,
        guestGenders: activeGenders,
        initialSelectedGuestIndex: selectedGuestIndex,
      ),
    );

    if (result != null) {
      setState(() {
        // Find if there is already an item in the cart with the same item.id and the same result.assignedGuest (unsent only)
        final duplicateIndex = currentCart.indexWhere(
          (i) =>
              i.item.id == result.item.id &&
              i.assignedGuest == result.assignedGuest &&
              !i.isSent,
        );

        if (duplicateIndex != -1 && duplicateIndex != existingIndex) {
          // Merge them!
          final existing = currentCart[duplicateIndex];
          currentCart[duplicateIndex] = existing.copyWith(
            quantity: existing.quantity + result.quantity,
            modifiers: result.modifiers,
            notes: result.notes.isNotEmpty
                ? (existing.notes.isNotEmpty
                      ? '${existing.notes}\n${result.notes}'
                      : result.notes)
                : existing.notes,
          );
          if (existingIndex != -1) {
            // Remove the old one since it was moved/merged
            currentCart.removeAt(existingIndex);
          }
        } else if (existingIndex != -1) {
          currentCart[existingIndex] = result;
        } else {
          currentCart.add(result);
        }
      });
    }
  }

  Future<bool> _handleRemoveGuest() async {
    final int removeIndex = activeGenders.length - 1;
    final String guestLabel = 'P${removeIndex + 1}';

    // Check if there are items assigned to this guest
    final hasItems = currentCart.any((i) => i.assignedGuest == guestLabel);

    if (!hasItems) {
      // Remove immediately
      setState(() {
        activeGenders.removeLast();
        if (selectedGuestIndex >= activeGenders.length) {
          selectedGuestIndex = activeGenders.length - 1;
        }
      });
      return true;
    }

    // There are items, show the modal
    final result = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        // Find remaining guests to reassign to
        final remainingGuests = List.generate(removeIndex, (index) => index);

        return Dialog(
          backgroundColor: EmpireColors.obsidian,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
          ),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: EmpireColors.warningOrange,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Quitar Comensal $guestLabel',
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  'El comensal $guestLabel tiene pedidos en la comanda. Selecciona una acción para continuar:',
                  style: const TextStyle(
                    color: EmpireColors.textPrimary,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),

                // Action 1: Delete all items
                ElevatedButton.icon(
                  onPressed: () => Navigator.of(dialogContext).pop('delete'),
                  icon: const Icon(
                    Icons.delete_forever,
                    color: Colors.white,
                    size: 16,
                  ),
                  label: const Text('ELIMINAR PEDIDOS'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.errorRed,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
                const SizedBox(height: 16),

                // Action 2: Reassign to other guests
                const Text(
                  'O REASIGNAR PEDIDOS A:',
                  style: TextStyle(
                    color: EmpireColors.textGold,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: remainingGuests.map((idx) {
                    final otherLabel = 'P${idx + 1}';
                    final gender = activeGenders[idx];
                    final emoji = _getGenderEmoji(gender);
                    return ActionChip(
                      label: Text('$otherLabel $emoji'),
                      backgroundColor: EmpireColors.charcoalSurface,
                      side: const BorderSide(
                        color: EmpireColors.agedBronzeDark,
                      ),
                      labelStyle: const TextStyle(
                        color: EmpireColors.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                      onPressed: () =>
                          Navigator.of(dialogContext).pop('reassign_$idx'),
                    );
                  }).toList(),
                ),

                const Divider(color: EmpireColors.agedBronzeDark, height: 32),

                // Cancel
                OutlinedButton(
                  onPressed: () => Navigator.of(dialogContext).pop('cancel'),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: EmpireColors.textSecondary),
                    foregroundColor: EmpireColors.textPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('CANCELAR'),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (result == null || result == 'cancel') {
      return false;
    }

    setState(() {
      if (result == 'delete') {
        // Delete all items of the guest being removed
        currentCart.removeWhere((i) => i.assignedGuest == guestLabel);
      } else if (result.startsWith('reassign_')) {
        final targetIndex = int.parse(result.replaceFirst('reassign_', ''));
        final targetLabel = 'P${targetIndex + 1}';

        // Reassign all items of guestIndex to targetIndex
        for (int i = 0; i < currentCart.length; i++) {
          if (currentCart[i].assignedGuest == guestLabel) {
            currentCart[i] = currentCart[i].copyWith(
              assignedGuest: targetLabel,
            );
          }
        }

        // Merge duplicates for the target guest
        final mergedList = <OrderItem>[];
        for (final item in currentCart) {
          final existingIdx = mergedList.indexWhere(
            (i) =>
                i.item.id == item.item.id &&
                i.assignedGuest == item.assignedGuest,
          );
          if (existingIdx != -1) {
            final existing = mergedList[existingIdx];
            mergedList[existingIdx] = existing.copyWith(
              quantity: existing.quantity + item.quantity,
              modifiers: item.modifiers, // use the newer modifiers
              notes: item.notes.isNotEmpty
                  ? (existing.notes.isNotEmpty
                        ? '${existing.notes}\n${item.notes}'
                        : item.notes)
                  : existing.notes,
            );
          } else {
            mergedList.add(item);
          }
        }
        currentCart = mergedList;
      }

      // Finally, remove the guest
      activeGenders.removeLast();
      if (selectedGuestIndex >= activeGenders.length) {
        selectedGuestIndex = activeGenders.length - 1;
      }
    });

    return true;
  }

  Widget _buildInfoSidebar() {
    final occupiedCount = widget.state.tables
        .where((t) => t.state == TableState.occupied)
        .length;
    final billingCount = widget.state.tables
        .where((t) => t.state == TableState.billing)
        .length;
    final freeCount = widget.state.tables
        .where((t) => t.state == TableState.free)
        .length;

    return Container(
      color: EmpireColors.onyxSurface,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Estado de Sala',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: EmpireColors.champagneGold,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildInfoStatCard(
              'Mesas Libres',
              '$freeCount',
              EmpireColors.agedBronze,
            ),
            const SizedBox(height: 12),
            _buildInfoStatCard(
              'Mesas Ocupadas',
              '$occupiedCount',
              EmpireColors.champagneGold,
            ),
            const SizedBox(height: 12),
            _buildInfoStatCard(
              'Por Cobrar',
              '$billingCount',
              EmpireColors.textGold,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: EmpireColors.charcoalSurface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: EmpireColors.agedBronzeDark,
                  width: 1,
                ),
              ),
              child: const Column(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: EmpireColors.champagneGold,
                    size: 24,
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Instrucciones de Servicio:',
                    style: TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    '1. Selecciona una mesa libre para tomar un pedido.\n2. Si el icono de cocina arriba parpadea, hay platillos listos para servir.\n3. Presiona en mesas ocupadas para agregar artículos o solicitar facturación.',
                    style: TextStyle(
                      color: EmpireColors.textSecondary,
                      fontSize: 11,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoStatCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: EmpireColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.bold,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: color, width: 1.2),
            ),
            child: Text(
              value,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
