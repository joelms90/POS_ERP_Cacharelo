import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
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
  bool isCartOpen = false;

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
                                        onBackToMenu: () => setState(() => isCartOpen = false),
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
                            Expanded(
                              flex: 1,
                              child: _buildInfoSidebar(),
                            ),
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
      floatingActionButton: activeOrderingTable != null && !isCartOpen
          ? FloatingActionButton.extended(
              onPressed: () => setState(() => isCartOpen = true),
              backgroundColor: EmpireColors.champagneGold,
              icon: const Icon(Icons.shopping_basket, color: EmpireColors.obsidian),
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
    final hasFailedPrinters = widget.state.printJobs.any((job) => job.status == 'failed');

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1)),
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
                  icon: const Icon(Icons.arrow_back, color: EmpireColors.textPrimary),
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
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: EmpireColors.champagneGold.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: EmpireColors.champagneGold, width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.table_restaurant, color: EmpireColors.champagneGold, size: 14),
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
                color: widget.state.isOnline ? EmpireColors.successGreen : EmpireColors.warningOrange,
                size: 20,
              ),
              if (!widget.state.isOnline) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: EmpireColors.warningOrange.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: EmpireColors.warningOrange.withOpacity(0.4)),
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
                        setState(() => isPrinterQueueOpen = !isPrinterQueueOpen);
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
                  icon: const Icon(Icons.settings, color: EmpireColors.champagneGold),
                  color: EmpireColors.onyxSurface,
                  surfaceTintColor: Colors.transparent,
                  offset: const Offset(0, 40),
                  onSelected: (value) {
                    if (value == 'logout') {
                      widget.state.logout();
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (context) => LoginScreen(state: widget.state)),
                      );
                    }
                  },
                  itemBuilder: (BuildContext context) => [
                    // Connection Simulator Switch in dropdown
                    PopupMenuItem<String>(
                      enabled: false, // Make it non-clickable as a whole menu item, so the switch is interactive
                      child: StatefulBuilder(
                        builder: (context, setStateDropdown) {
                          return Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.sync_alt, color: EmpireColors.textSecondary, size: 18),
                                  SizedBox(width: 8),
                                  Text(
                                    'Simular Conexión', 
                                    style: TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
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
                                activeTrackColor: EmpireColors.successGreen.withOpacity(0.2),
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
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
                          Icon(Icons.logout, color: EmpireColors.errorRed, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Cerrar Sesión', 
                            style: TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
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
                                isCartOpen = false;
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
            _buildInfoStatCard('Mesas Libres', '$freeCount', EmpireColors.agedBronze),
            const SizedBox(height: 12),
            _buildInfoStatCard('Mesas Ocupadas', '$occupiedCount', EmpireColors.champagneGold),
            const SizedBox(height: 12),
            _buildInfoStatCard('Por Cobrar', '$billingCount', EmpireColors.textGold),
            const SizedBox(height: 20),
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
