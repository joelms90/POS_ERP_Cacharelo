import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../widgets/offline_status_bar.dart';
import '../widgets/table_node.dart';
import '../widgets/printer_monitor_panel.dart';
import '../login_screen.dart';
import 'shift_control_panel.dart';
import 'split_checkout_view.dart';

class CashierDashboardScreen extends StatefulWidget {
  final AppState state;

  const CashierDashboardScreen({super.key, required this.state});

  @override
  State<CashierDashboardScreen> createState() => _CashierDashboardScreenState();
}

class _CashierDashboardScreenState extends State<CashierDashboardScreen> {
  TableModel? selectedTableForCheckout;
  bool isPrinterQueueOpen = false;
  String selectedFilter = 'TODOS'; // 'TODOS', 'OCUPADAS', 'POR COBRAR'

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: widget.state,
          builder: (context, _) {
            // Filter tables based on selection
            final filteredTables = widget.state.tables.where((t) {
              if (selectedFilter == 'OCUPADAS') {
                return t.state == TableState.occupied;
              }
              if (selectedFilter == 'POR COBRAR') {
                return t.state == TableState.billing;
              }
              return t.state != TableState.free; // Show all active occupied/billing/cleaning tables
            }).toList();

            return Stack(
              children: [
                Column(
                  children: [
                    // Network Sync alerts
                    OfflineStatusBar(
                      state: widget.state,
                      onOpenPrinterQueue: () {
                        setState(() => isPrinterQueueOpen = true);
                      },
                    ),

                    // Main dashboard workspace
                    Expanded(
                      child: Row(
                        children: [
                          // Left Panel: Shift control
                          Expanded(
                            flex: 6,
                            child: Container(
                              decoration: const BoxDecoration(
                                border: Border(right: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5)),
                              ),
                              child: ShiftControlPanel(state: widget.state),
                            ),
                          ),

                          // Center Panel: Interactive active tables grid
                          Expanded(
                            flex: 12,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _buildHeader(context),
                                _buildFilterBar(),
                                
                                // Table grid
                                Expanded(
                                  child: widget.state.isShiftOpen
                                      ? _buildActiveTablesGrid(filteredTables)
                                      : _buildLockedOverlay(),
                                ),
                              ],
                            ),
                          ),

                          // Right Panel: Checkout options (visible when table is selected and shift is open)
                          if (selectedTableForCheckout != null && widget.state.isShiftOpen)
                            Expanded(
                              flex: 7,
                              child: Container(
                                decoration: const BoxDecoration(
                                  border: Border(left: BorderSide(color: EmpireColors.agedBronzeDark, width: 1.5)),
                                ),
                                child: SplitCheckoutView(
                                  table: selectedTableForCheckout!,
                                  state: widget.state,
                                  onCancel: () {
                                    setState(() => selectedTableForCheckout = null);
                                  },
                                  onSuccess: () {
                                    setState(() => selectedTableForCheckout = null);
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        backgroundColor: EmpireColors.successGreen,
                                        content: Text('Facturación completada con éxito. Mesa liberada.'),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Slide-out Printer queue
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
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'CONTROL DE FACTURACIÓN',
            style: Theme.of(context).appBarTheme.titleTextStyle,
          ),
          Row(
            children: [
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

  Widget _buildFilterBar() {
    final filters = ['TODOS', 'OCUPADAS', 'POR COBRAR'];
    return Container(
      padding: const EdgeInsets.all(12),
      color: EmpireColors.obsidian,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: filters.map((f) {
          final isSelected = selectedFilter == f;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: ChoiceChip(
              label: Text(f),
              selected: isSelected,
              onSelected: (selected) {
                if (selected) {
                  setState(() => selectedFilter = f);
                }
              },
              selectedColor: EmpireColors.champagneGold,
              backgroundColor: EmpireColors.onyxSurface,
              labelStyle: TextStyle(
                color: isSelected ? EmpireColors.obsidian : EmpireColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
              side: BorderSide(
                color: isSelected ? EmpireColors.champagneGold : EmpireColors.agedBronzeDark,
                width: 1,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildActiveTablesGrid(List<TableModel> activeTables) {
    if (activeTables.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.table_bar_outlined, color: EmpireColors.textSecondary, size: 48),
            SizedBox(height: 12),
            Text(
              'No hay mesas activas con los filtros seleccionados.',
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 1.1,
      ),
      itemCount: activeTables.length,
      itemBuilder: (context, index) {
        final table = activeTables[index];
        final isSelected = selectedTableForCheckout?.id == table.id;
        
        return Container(
          decoration: isSelected
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: EmpireColors.champagneGold, width: 2),
                )
              : null,
          child: Card(
            color: EmpireColors.onyxSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(
                color: table.state == TableState.billing ? EmpireColors.textGold : EmpireColors.agedBronzeDark,
                width: table.state == TableState.billing ? 1.5 : 1,
              ),
            ),
            child: InkWell(
              onTap: () {
                setState(() {
                  selectedTableForCheckout = table;
                });
              },
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: table.state == TableState.billing
                                ? EmpireColors.warningOrange.withOpacity(0.15)
                                : EmpireColors.agedBronzeDark,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            table.state == TableState.billing ? 'POR COBRAR' : 'OCUPADA',
                            style: TextStyle(
                              color: table.state == TableState.billing ? EmpireColors.warningOrange : EmpireColors.textSecondary,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        Text(
                          '${table.guests} Pax',
                          style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 10),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      table.label,
                      style: const TextStyle(color: EmpireColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Zona: ${table.zone}',
                      style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 11),
                    ),
                    const Divider(color: EmpireColors.agedBronzeDark, height: 16),
                    Text(
                      '\$${(table.subtotal * 1.16).toStringAsFixed(2)}',
                      style: const TextStyle(color: EmpireColors.champagneGold, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildLockedOverlay() {
    return Container(
      color: Colors.black26,
      alignment: Alignment.center,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock, color: EmpireColors.textSecondary, size: 48),
          const SizedBox(height: 16),
          Text(
            'MÓDULO DE FACTURACIÓN BLOQUEADO',
            style: TextStyle(
              color: EmpireColors.textSecondary,
              fontWeight: FontWeight.bold,
              fontSize: 14,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Por favor, configure el fondo de apertura en el panel izquierdo para comenzar.',
            style: TextStyle(color: EmpireColors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
