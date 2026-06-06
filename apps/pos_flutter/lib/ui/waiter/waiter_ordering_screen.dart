import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../widgets/offline_status_bar.dart';
import '../widgets/table_node.dart';
import '../widgets/menu_card.dart';
import '../widgets/custom_toast.dart';
import '../widgets/printer_monitor_panel.dart';
import '../login_screen.dart';
import 'modifier_dialog.dart';
import 'cart_sidebar.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: widget.state,
          builder: (context, _) {
            final tablesInZone = widget.state.tables.where((t) => t.zone == selectedZone).toList();
            final categories = AppState.menu.map((item) => item.category).toSet().toList();

            return Stack(
              children: [
                Column(
                  children: [
                    // Network & Sync warnings
                    OfflineStatusBar(
                      state: widget.state,
                      onOpenPrinterQueue: () {
                        setState(() => isPrinterQueueOpen = true);
                      },
                    ),

                    // Navigation / Header bar
                    _buildHeader(context),

                    // Main Panel (Dynamic based on whether a table is selected for ordering)
                    Expanded(
                      child: Row(
                        children: [
                          // Left side: Floor map OR Menu selection
                          Expanded(
                            flex: 3,
                            child: activeOrderingTable == null
                                ? _buildFloorMap(tablesInZone)
                                : _buildMenuSection(categories),
                          ),

                          // Right side: Details sidebar or general stats
                          if (activeOrderingTable != null)
                            Expanded(
                              flex: 1,
                              child: Container(
                                decoration: const BoxDecoration(
                                  border: Border(left: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5)),
                                ),
                                child: CartSidebar(
                                  table: activeOrderingTable!,
                                  initialItems: currentCart,
                                  onConfirm: (finalItems, guests) {
                                    widget.state.submitOrder(activeOrderingTable!.id, finalItems, guests);
                                    
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        backgroundColor: EmpireColors.successGreen,
                                        content: Text(
                                          '¡Pedido confirmado para la ${activeOrderingTable!.label}! Comanda enviada.',
                                          style: const TextStyle(fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                    );

                                    setState(() {
                                      activeOrderingTable = null;
                                      currentCart = [];
                                    });
                                  },
                                  onCancel: () {
                                    setState(() {
                                      activeOrderingTable = null;
                                      currentCart = [];
                                    });
                                  },
                                ),
                              ),
                            )
                          else
                            _buildInfoSidebar(),
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
                          onClose: () => setState(() => isPrinterQueueOpen = false),
                        ),
                      ),
                    ),
                  ),

                // Floating Notification Toast Overlay
                if (widget.state.readyNotifications.isNotEmpty)
                  CustomToast(
                    message: widget.state.readyNotifications.first,
                    onDismiss: () {
                      widget.state.clearNotification(widget.state.readyNotifications.first);
                    },
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              if (activeOrderingTable != null) ...[
                OutlinedButton.icon(
                  onPressed: () {
                    setState(() {
                      activeOrderingTable = null;
                      currentCart = [];
                    });
                  },
                  icon: const Icon(Icons.arrow_back, size: 16),
                  label: const Text('VOLVER AL MAPA'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                ),
                const SizedBox(width: 20),
              ],
              Text(
                activeOrderingTable == null
                    ? 'DISTRIBUCIÓN DE MESAS'
                    : 'CREAR PEDIDO: ${activeOrderingTable!.label}',
                style: Theme.of(context).appBarTheme.titleTextStyle,
              ),
            ],
          ),
          
          // User Details and controls
          Row(
            children: [
              Text(
                widget.state.currentUserName,
                style: const TextStyle(
                  color: EmpireColors.textGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 20),
              IconButton(
                onPressed: () {
                  setState(() => isPrinterQueueOpen = !isPrinterQueueOpen);
                },
                icon: const Icon(Icons.print, color: EmpireColors.champagneGold),
                tooltip: 'Monitor Impresoras',
              ),
              const SizedBox(width: 10),
              IconButton(
                onPressed: () {
                  widget.state.logout();
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (context) => LoginScreen(state: widget.state)),
                  );
                },
                icon: const Icon(Icons.logout, color: EmpireColors.errorRed),
                tooltip: 'Cerrar Sesión',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFloorMap(List<TableModel> tables) {
    final zones = ['Salón Principal', 'Terraza', 'Bar'];
    
    return Column(
      children: [
        // Zone Tabs Bar
        Container(
          padding: const EdgeInsets.all(12),
          color: EmpireColors.obsidian,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: zones.map((zone) {
              final isSelected = selectedZone == zone;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: ChoiceChip(
                  label: Text(zone.toUpperCase()),
                  selected: isSelected,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() => selectedZone = zone);
                    }
                  },
                  selectedColor: EmpireColors.champagneGold,
                  backgroundColor: EmpireColors.onyxSurface,
                  labelStyle: TextStyle(
                    color: isSelected ? EmpireColors.obsidian : EmpireColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 0.8,
                  ),
                  side: BorderSide(
                    color: isSelected ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
                    width: 1.2,
                  ),
                ),
              );
            }).toList(),
          ),
        ),

        // Floor map coordinates layout (Option B)
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: EmpireColors.onyxSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: EmpireColors.agedBronzeDark, width: 1.5),
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
                                  content: Text('¡${table.label} disponible para nuevos clientes!'),
                                ),
                              );
                            } else {
                              setState(() {
                                activeOrderingTable = table;
                                currentCart = List.from(table.items);
                              });
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMenuSection(List<String> categories) {
    final filteredMenuItems = AppState.menu
        .where((i) => i.category == selectedMenuCategory)
        .toList();

    return Column(
      children: [
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
                      color: isSelected ? EmpireColors.obsidian : EmpireColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                    side: BorderSide(
                      color: isSelected ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
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
    // Check if item already exists in cart to prefill
    final existingIndex = currentCart.indexWhere((i) => i.item.id == item.id);
    final existingItem = existingIndex != -1 ? currentCart[existingIndex] : null;

    final OrderItem? result = await showDialog<OrderItem>(
      context: context,
      builder: (context) => ModifierDialog(
        item: item,
        existingOrderItem: existingItem,
      ),
    );

    if (result != null) {
      setState(() {
        if (existingIndex != -1) {
          currentCart[existingIndex] = result;
        } else {
          currentCart.add(result);
        }
      });
    }
  }

  Widget _buildInfoSidebar() {
    final occupiedCount = widget.state.tables.where((t) => t.state == TableState.occupied).length;
    final billingCount = widget.state.tables.where((t) => t.state == TableState.billing).length;
    final freeCount = widget.state.tables.where((t) => t.state == TableState.free).length;

    return Container(
      color: EmpireColors.onyxSurface,
      padding: const EdgeInsets.all(24),
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
          const SizedBox(height: 24),
          _buildInfoStatCard('Mesas Libres', '$freeCount', EmpireColors.agedBronze),
          const SizedBox(height: 16),
          _buildInfoStatCard('Mesas Ocupadas', '$occupiedCount', EmpireColors.champagneGold),
          const SizedBox(height: 16),
          _buildInfoStatCard('Por Cobrar', '$billingCount', EmpireColors.textGold),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: EmpireColors.charcoalSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: EmpireColors.agedBronzeDark, width: 1),
            ),
            child: const Column(
              children: [
                Icon(Icons.info_outline, color: EmpireColors.champagneGold, size: 24),
                SizedBox(height: 10),
                Text(
                  'Instrucciones de Servicio:',
                  style: TextStyle(color: EmpireColors.champagneGold, fontWeight: FontWeight.bold, fontSize: 12),
                ),
                SizedBox(height: 6),
                Text(
                  '1. Selecciona una mesa libre para tomar un pedido.\n2. Si el icono de cocina arriba parpadea, hay platillos listos para servir.\n3. Presiona en mesas ocupadas para agregar artículos o solicitar facturación.',
                  style: TextStyle(color: EmpireColors.textSecondary, fontSize: 11, height: 1.5),
                ),
              ],
            ),
          ),
        ],
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
            style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
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
