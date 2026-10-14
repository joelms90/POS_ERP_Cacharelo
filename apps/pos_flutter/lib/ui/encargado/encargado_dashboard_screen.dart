import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../login_screen.dart';
import '../widgets/printer_monitor_panel.dart';
import '../widgets/printer_settings_dialog.dart';
import '../widgets/app_version_badge.dart';
import '../requisitions/create_requisition.dart';
import 'encargado_pos_tab.dart';
import 'encargado_orders_tab.dart';
import 'operator_operations_tabs.dart';
import 'encargado_caja_tab.dart';

class EncargadoDashboardScreen extends StatefulWidget {
  final AppState state;
  final bool showFullFeatures;

  const EncargadoDashboardScreen({
    super.key,
    required this.state,
    this.showFullFeatures = true,
  });

  @override
  State<EncargadoDashboardScreen> createState() =>
      _EncargadoDashboardScreenState();
}

class _EncargadoDashboardScreenState extends State<EncargadoDashboardScreen> {
  int _selectedIndex = 0;
  int _activeOrdersCount = 0;
  int _summaryRefreshToken = 0;
  int _lastSalesSummaryRevision = 0;
  bool _isPrinterQueueOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.state.checkActiveShift();
    });
    widget.state.addListener(_onStateChanged);
  }

  @override
  void dispose() {
    widget.state.removeListener(_onStateChanged);
    super.dispose();
  }

  void _onStateChanged() {
    if (!mounted) return;
    final count = widget.state.tables
        .where((t) =>
            t.zone == 'Para Llevar' &&
            (t.state == TableState.occupied || t.state == TableState.billing))
        .length;
    final reportChanged =
        widget.state.salesSummaryRevision != _lastSalesSummaryRevision;
    if (count != _activeOrdersCount || reportChanged) {
      setState(() {
        _activeOrdersCount = count;
        if (reportChanged) {
          _lastSalesSummaryRevision = widget.state.salesSummaryRevision;
          if (_selectedIndex == 4 && !widget.showFullFeatures) {
            _summaryRefreshToken++;
          }
        }
      });
    }
  }

  void _editOrder(int tableId) {
    widget.state.beginEditingOrder(tableId);
    if (_selectedIndex != 0) {
      setState(() => _selectedIndex = 0);
    }
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
                  strokeWidth: 2, color: EmpireColors.obsidian),
            ),
            SizedBox(width: 12),
            Text('Sincronizando datos con el servidor...',
                style: TextStyle(
                    color: EmpireColors.obsidian, fontWeight: FontWeight.bold)),
          ],
        ),
        backgroundColor: EmpireColors.champagneGold,
        duration: Duration(milliseconds: 1500),
      ),
    );

    final success = await widget.state.syncAllData();

    if (context.mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Sincronización completa con éxito.'
                : 'Sincronización incompleta. Revise su conexión de red.',
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold),
          ),
          backgroundColor:
              success ? EmpireColors.successGreen : EmpireColors.errorRed,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _logout() {
    widget.state.logout();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => LoginScreen(state: widget.state)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: ListenableBuilder(
        listenable: widget.state,
        builder: (context, _) {
          return Stack(
            children: [
              SafeArea(
                child: Column(
                  children: [
                    _buildHeader(context),
                    Expanded(
                      child: IndexedStack(
                        index: _selectedIndex,
                        children: widget.showFullFeatures
                            ? [
                                EncargadoPosTab(
                                  state: widget.state,
                                  showPrepararButton: true,
                                ),
                                EncargadoOrdersTab(
                                  state: widget.state,
                                  onEditOrder: _editOrder,
                                ),
                                RequisitionsScreen(state: widget.state),
                              ]
                            : [
                                EncargadoPosTab(
                                    state: widget.state,
                                    showPrepararButton: true),
                                EncargadoOrdersTab(
                                  state: widget.state,
                                  onEditOrder: _editOrder,
                                ),
                                RequisitionsScreen(state: widget.state),
                                InventoryReceiptsTab(state: widget.state),
                                EncargadoCajaTab(
                                  key: ValueKey(_summaryRefreshToken),
                                  state: widget.state,
                                ),
                              ],
                      ),
                    ),
                    _buildBottomNav(),
                  ],
                ),
              ),
              if (_isPrinterQueueOpen)
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
                          BoxShadow(color: Colors.black54, blurRadius: 20)
                        ],
                      ),
                      child: PrinterMonitorPanel(
                        state: widget.state,
                        onClose: () =>
                            setState(() => _isPrinterQueueOpen = false),
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
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
        children: [
          Row(
            children: [
              Icon(
                widget.state.currentUserRole ==
                        UserRole.warehousePurchasingOperator
                    ? Icons.warehouse
                    : Icons.storefront,
                color: EmpireColors.champagneGold,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                widget.state.currentUserRole ==
                        UserRole.warehousePurchasingOperator
                    ? 'ALMACÉN / BODEGA'
                    : 'MOSTRADOR',
                style: const TextStyle(
                  color: EmpireColors.champagneGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(width: 12),
              Container(
                height: 20,
                width: 1.5,
                color: EmpireColors.agedBronzeDark,
              ),
              const SizedBox(width: 12),
              Text(
                widget.state.currentUserName,
                style: const TextStyle(
                  color: EmpireColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 10),
              AppVersionBadge(version: widget.state.appVersion),
            ],
          ),
          const Spacer(),
          Row(
            children: [
              Icon(
                widget.state.isOnline ? Icons.wifi : Icons.wifi_off,
                color: widget.state.isOnline
                    ? EmpireColors.successGreen
                    : EmpireColors.warningOrange,
                size: 20,
              ),
              if (!widget.state.isOnline) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: EmpireColors.warningOrange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                        color:
                            EmpireColors.warningOrange.withValues(alpha: 0.4)),
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
                    onPressed: () => setState(
                        () => _isPrinterQueueOpen = !_isPrinterQueueOpen),
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
              PopupMenuButton<String>(
                icon: const Icon(Icons.settings,
                    color: EmpireColors.champagneGold),
                color: EmpireColors.onyxSurface,
                surfaceTintColor: Colors.transparent,
                offset: const Offset(0, 40),
                onSelected: (value) {
                  if (value == 'logout') {
                    _logout();
                  } else if (value == 'printer') {
                    showDialog(
                      context: context,
                      builder: (context) =>
                          PrinterSettingsDialog(state: widget.state),
                    );
                  } else if (value == 'sync') {
                    _triggerSync(context);
                  }
                },
                itemBuilder: (BuildContext context) => [
                  const PopupMenuItem<String>(
                    value: 'sync',
                    child: Row(children: [
                      Icon(Icons.sync,
                          color: EmpireColors.champagneGold, size: 18),
                      SizedBox(width: 8),
                      Text('Sincronizar Datos',
                          style: TextStyle(
                              color: EmpireColors.textPrimary, fontSize: 13)),
                    ]),
                  ),
                  const PopupMenuDivider(height: 1),
                  const PopupMenuItem<String>(
                    value: 'printer',
                    child: Row(children: [
                      Icon(Icons.print,
                          color: EmpireColors.champagneGold, size: 18),
                      SizedBox(width: 8),
                      Text('Configurar Impresora',
                          style: TextStyle(
                              color: EmpireColors.textPrimary, fontSize: 13)),
                    ]),
                  ),
                  const PopupMenuDivider(height: 1),
                  const PopupMenuItem<String>(
                    value: 'logout',
                    child: Row(children: [
                      Icon(Icons.logout,
                          color: EmpireColors.errorRed, size: 18),
                      SizedBox(width: 8),
                      Text('Cerrar Sesión',
                          style: TextStyle(
                              color: EmpireColors.textPrimary, fontSize: 13)),
                    ]),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(
            top: BorderSide(color: EmpireColors.agedBronzeDark, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            _buildNavItem(0, Icons.point_of_sale, 'POS'),
            if (widget.showFullFeatures) ...[
              _buildNavItem(1, Icons.receipt_long, 'Órdenes',
                  badge: _activeOrdersCount),
              _buildNavItem(2, Icons.inventory_2_outlined, 'Requisiciones'),
            ] else ...[
              _buildNavItem(1, Icons.receipt_long, 'Órdenes',
                  badge: _activeOrdersCount),
              _buildNavItem(2, Icons.inventory_2_outlined, 'Requisiciones'),
              _buildNavItem(3, Icons.local_shipping_outlined, 'Recibir'),
              _buildNavItem(4, Icons.point_of_sale, 'Caja'),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label,
      {int badge = 0}) {
    final isSelected = _selectedIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() {
          _selectedIndex = index;
          // EncargadoCajaTab loads tickets & shift in initState. Recreate it whenever
          // the operator opens Caja so completed payments and shift updates are reflected.
          if (index == 4 && !widget.showFullFeatures) {
            _summaryRefreshToken++;
          }
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          color: isSelected
              ? EmpireColors.champagneGold.withValues(alpha: 0.1)
              : Colors.transparent,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                children: [
                  Icon(
                    icon,
                    color: isSelected
                        ? EmpireColors.champagneGold
                        : EmpireColors.textSecondary,
                    size: 22,
                  ),
                  if (badge > 0)
                    Positioned(
                      top: -4,
                      right: -10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: EmpireColors.errorRed,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$badge',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: isSelected
                      ? EmpireColors.champagneGold
                      : EmpireColors.textSecondary,
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
