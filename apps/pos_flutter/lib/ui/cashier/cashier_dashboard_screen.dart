import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../widgets/printer_monitor_panel.dart';
import '../widgets/printer_settings_dialog.dart';
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
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.state.checkActiveShift();
    });
  }

  void _triggerSync(BuildContext context) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: EmpireColors.obsidian,
              ),
            ),
            SizedBox(width: 12),
            Text(
              'Sincronizando datos con el servidor...',
              style: TextStyle(
                color: EmpireColors.obsidian,
                fontWeight: FontWeight.bold,
              ),
            ),
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
            success ? 'Sincronización completa con éxito.' : 'Sincronización incompleta. Revise su conexión de red.',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          backgroundColor: success ? EmpireColors.successGreen : EmpireColors.errorRed,
          duration: const Duration(seconds: 2),
        ),
      );
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
            // Filter tables based on selection
            final filteredTables = widget.state.tables.where((t) {
              if (selectedFilter == 'OCUPADAS') {
                return t.state == TableState.occupied;
              }
              if (selectedFilter == 'POR COBRAR') {
                return t.state == TableState.billing;
              }
              // 'TODOS' shows only occupied and billing tables
              return t.state == TableState.occupied || t.state == TableState.billing;
            }).toList();

            // Get fresh table reference if one is selected
            final freshTable = selectedTableForCheckout != null
                ? widget.state.tables.firstWhere(
                    (t) => t.id == selectedTableForCheckout!.id,
                    orElse: () => selectedTableForCheckout!,
                  )
                : null;

            return Stack(
              children: [
                Column(
                  children: [
                    // Consolidated Navigation, Tools & Status Header
                    _buildHeader(context),

                    // Main dashboard workspace
                    Expanded(
                      child: (freshTable != null && widget.state.isShiftOpen)
                          ? SplitCheckoutView(
                              key: ValueKey('checkout_${freshTable.id}'),
                              table: freshTable,
                              state: widget.state,
                              onCancel: () {
                                setState(() => selectedTableForCheckout = null);
                              },
                              onSuccess: () {
                                setState(() => selectedTableForCheckout = null);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    backgroundColor: EmpireColors.successGreen,
                                    content: Text(
                                      'Facturación completada con éxito. Mesa liberada.',
                                    ),
                                  ),
                                );
                              },
                            )
                          : Row(
                              children: [
                                // Left Panel: Shift control
                                Expanded(
                                  flex: 6,
                                  child: Container(
                                    decoration: const BoxDecoration(
                                      border: Border(
                                        right: BorderSide(
                                          color: EmpireColors.agedBronzeDark,
                                          width: 1.5,
                                        ),
                                      ),
                                    ),
                                    child: ShiftControlPanel(
                                      state: widget.state,
                                    ),
                                  ),
                                ),

                                // Main Area: Active tables grid (flex 18)
                                Expanded(
                                  flex: 18,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      _buildFilterBar(),

                                      // Table grid
                                      Expanded(
                                        child: widget.state.isShiftOpen
                                            ? _buildActiveTablesGrid(
                                                filteredTables,
                                              )
                                            : _buildLockedOverlay(),
                                      ),
                                    ],
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
    final hasFailedPrinters = widget.state.printJobs.any(
      (job) => job.status == 'failed',
    );
    final isCheckoutActive = selectedTableForCheckout != null;

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
              if (isCheckoutActive) ...[
                // Back arrow to clear selection (comes first)
                IconButton(
                  icon: const Icon(
                    Icons.arrow_back,
                    color: EmpireColors.textPrimary,
                  ),
                  tooltip: 'Volver a Panel',
                  onPressed: () {
                    setState(() => selectedTableForCheckout = null);
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
                        selectedTableForCheckout!.label.toUpperCase(),
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
              // --- User Profile Chip ---
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: EmpireColors.charcoalSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: EmpireColors.agedBronze.withOpacity(0.5),
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.person_outline,
                      color: EmpireColors.champagneGold,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      widget.state.currentUserName.isNotEmpty
                          ? widget.state.currentUserName
                          : 'Cajero',
                      style: const TextStyle(
                        color: EmpireColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // --- SUB-GROUP 1: Section Navigation ---
              Icon(
                Icons.point_of_sale,
                color: isCheckoutActive ? EmpireColors.textSecondary : EmpireColors.champagneGold,
              ),

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

              if (!isCheckoutActive) ...[
                const SizedBox(width: 16),
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    IconButton(
                      icon: Icon(
                        Icons.print,
                        color: hasFailedPrinters ? EmpireColors.errorRed : EmpireColors.champagneGold,
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
                          builder: (context) => LoginScreen(state: widget.state),
                        ),
                      );
                    } else if (value == 'printer') {
                      showDialog(
                        context: context,
                        builder: (context) => PrinterSettingsDialog(state: widget.state),
                      );
                    } else if (value == 'sync') {
                      _triggerSync(context);
                    }
                  },
                  itemBuilder: (BuildContext context) => [
                    const PopupMenuItem<String>(
                      value: 'sync',
                      child: Row(
                        children: [
                          Icon(
                            Icons.sync,
                            color: EmpireColors.champagneGold,
                            size: 18,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Sincronizar Datos',
                            style: TextStyle(
                              color: EmpireColors.textPrimary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const PopupMenuDivider(height: 1),
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
            Icon(
              Icons.table_bar_outlined,
              color: EmpireColors.textSecondary,
              size: 48,
            ),
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
        childAspectRatio: 1.3,
      ),
      itemCount: activeTables.length,
      itemBuilder: (context, index) {
        final table = activeTables[index];
        final isSelected = selectedTableForCheckout?.id == table.id;

        return Container(
          decoration: isSelected
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: EmpireColors.champagneGold,
                    width: 2,
                  ),
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
                padding: const EdgeInsets.all(8),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: table.state == TableState.billing ? EmpireColors.warningOrange.withOpacity(0.15) : EmpireColors.agedBronzeDark,
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
                          const SizedBox(width: 8),
                          Text(
                            '${table.guests} Pax',
                            style: const TextStyle(
                              color: EmpireColors.textSecondary,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        table.label,
                        style: const TextStyle(
                          color: EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        'Zona: ${table.zone}',
                        style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    const Divider(
                      color: EmpireColors.agedBronzeDark,
                      height: 8,
                    ),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        '\$${table.total.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
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
