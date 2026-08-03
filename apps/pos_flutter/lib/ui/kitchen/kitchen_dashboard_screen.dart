import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../widgets/offline_status_bar.dart';
import '../login_screen.dart';

class KitchenDashboardScreen extends StatefulWidget {
  final AppState state;

  const KitchenDashboardScreen({super.key, required this.state});

  @override
  State<KitchenDashboardScreen> createState() => _KitchenDashboardScreenState();
}

class _KitchenDashboardScreenState extends State<KitchenDashboardScreen> {
  String selectedFilter =
      'TODOS'; // 'TODOS', 'PENDIENTES', 'EN PREPARACIÓN', 'LISTOS'
  String selectedStation = 'TODOS'; // 'TODOS', 'COCINA', 'BARRA'

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: widget.state,
          builder: (context, _) {
            final allActiveOrders = widget.state.kitchenOrders
                .where((o) => o.status != 'served')
                .toList();
            final pendingCount = allActiveOrders
                .where((o) => o.status == 'pending')
                .length;
            final preparingCount = allActiveOrders
                .where((o) => o.status == 'preparing')
                .length;
            final readyCount = allActiveOrders
                .where((o) => o.status == 'ready')
                .length;

            // Filter kitchen tickets by status and station
            final activeOrders = allActiveOrders.where((order) {
              if (selectedStation == 'COCINA' && order.station != 'cocina') {
                return false;
              }
              if (selectedStation == 'BARRA' && order.station != 'barra') {
                return false;
              }
              if (selectedFilter == 'PENDIENTES') {
                return order.status == 'pending';
              }
              if (selectedFilter == 'EN PREPARACIÓN') {
                return order.status == 'preparing';
              }
              if (selectedFilter == 'LISTOS') {
                return order.status == 'ready';
              }
              return true;
            }).toList();

            return Column(
              children: [
                OfflineStatusBar(state: widget.state),

                if (widget.state.lastSyncError != null)
                  Container(
                    width: double.infinity,
                    color: EmpireColors.errorRed,
                    padding: const EdgeInsets.all(12),
                    child: SelectableText(
                      'FALLO DE CONEXIÓN/PARSEO KDS:\n${widget.state.lastSyncError!}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),

                // Header
                _buildHeader(context, pendingCount, preparingCount, readyCount),

                // Filters
                _buildFilterBar(),

                // Active orders tickets grid
                Expanded(child: _buildTicketsGrid(activeOrders)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, int pending, int preparing, int ready) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: EmpireColors.onyxSurface,
        border: Border(
          bottom: BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left: Title
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: EmpireColors.champagneGold.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(
                  Icons.soup_kitchen,
                  color: EmpireColors.champagneGold,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'PANTALLA DE COCINA (KDS)',
                style: Theme.of(context).appBarTheme.titleTextStyle,
              ),
            ],
          ),

          // Center: Load counters
          Row(
            children: [
              _buildHeaderCounter('PENDIENTES', pending, EmpireColors.errorRed),
              const SizedBox(width: 12),
              _buildHeaderCounter('PREPARANDO', preparing, EmpireColors.warningOrange),
              const SizedBox(width: 12),
              _buildHeaderCounter('LISTOS', ready, EmpireColors.successGreen),
            ],
          ),

          // Right: Operator Info & Logout
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
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCounter(String label, int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 9,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    final filters = ['TODOS', 'PENDIENTES', 'EN PREPARACIÓN', 'LISTOS'];
    final stations = [
      {'id': 'TODOS', 'label': '🌐 TODAS LAS ESTACIONES'},
      {'id': 'COCINA', 'label': '🍳 COCINA'},
      {'id': 'BARRA', 'label': '🍹 BARRA'},
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: EmpireColors.obsidian,
      child: Column(
        children: [
          // Station Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: stations.map((st) {
              final isSelected = selectedStation == st['id'];
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: ChoiceChip(
                  label: Text(st['label']!),
                  selected: isSelected,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() => selectedStation = st['id']!);
                    }
                  },
                  selectedColor: st['id'] == 'BARRA' ? Colors.cyan : (st['id'] == 'COCINA' ? Colors.amber : EmpireColors.champagneGold),
                  backgroundColor: EmpireColors.onyxSurface,
                  labelStyle: TextStyle(
                    color: isSelected ? EmpireColors.obsidian : EmpireColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                  side: BorderSide(
                    color: isSelected
                        ? (st['id'] == 'BARRA' ? Colors.cyan : (st['id'] == 'COCINA' ? Colors.amber : EmpireColors.champagneGold))
                        : EmpireColors.agedBronzeDark,
                    width: 1,
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 6),
          // Status Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: filters.map((f) {
              final isSelected = selectedFilter == f;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
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
                    color: isSelected
                        ? EmpireColors.obsidian
                        : EmpireColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
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
        ],
      ),
    );
  }

  Widget _buildTicketsGrid(List<KitchenOrder> orders) {
    if (orders.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.assignment_turned_in_outlined,
              color: EmpireColors.textSecondary,
              size: 48,
            ),
            SizedBox(height: 12),
            Text(
              'No hay comandas activas en cocina.',
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.all(20),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        final minutesElapsed = DateTime.now()
            .difference(order.timestamp)
            .inMinutes;

        // Determine border and alert colors based on elapsed time
        final Color cardColor = _getTimeAlertBorderColor(minutesElapsed, order.status);

        return Container(
          width: 320,
          margin: const EdgeInsets.only(right: 16),
          child: Card(
            color: EmpireColors.onyxSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                color: cardColor,
                width: minutesElapsed > 15 && order.status != 'ready' ? 2.5 : 1.5,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Card Header: Table label and elapsed time
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        order.tableLabel,
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                      
                      // Highlight elapsed time if it exceeds 15 minutes
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: minutesElapsed > 15 && order.status != 'ready'
                              ? EmpireColors.errorRed.withOpacity(0.2)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (minutesElapsed > 15 && order.status != 'ready') ...[
                              const Icon(
                                Icons.warning_amber_rounded,
                                color: EmpireColors.errorRed,
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                            ],
                            Text(
                              'Hace $minutesElapsed min',
                              style: TextStyle(
                                color: minutesElapsed > 15 && order.status != 'ready'
                                    ? EmpireColors.errorRed
                                    : EmpireColors.textSecondary,
                                fontSize: 12,
                                fontWeight: minutesElapsed > 15 && order.status != 'ready'
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Status & Station Badges
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: _getStatusBgColor(order.status),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _getStatusLabel(order.status).toUpperCase(),
                          style: TextStyle(
                            color: _getStatusBorderColor(order.status),
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: order.station == 'barra'
                              ? Colors.cyan.withOpacity(0.15)
                              : Colors.amber.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: order.station == 'barra'
                                ? Colors.cyan
                                : Colors.amber,
                            width: 0.8,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              order.station == 'barra'
                                  ? Icons.local_bar
                                  : Icons.soup_kitchen,
                              size: 10,
                              color: order.station == 'barra'
                                  ? Colors.cyan
                                  : Colors.amber,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              order.station == 'barra' ? 'BARRA' : 'COCINA',
                              style: TextStyle(
                                color: order.station == 'barra'
                                    ? Colors.cyan
                                    : Colors.amber,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: EmpireColors.agedBronzeDark, height: 20),

                  // Order items list - scrollable internally
                  Expanded(
                    child: ListView.builder(
                      itemCount: order.items.length,
                      itemBuilder: (context, idx) {
                        final item = order.items[idx];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${item.quantity}x ',
                                    style: const TextStyle(
                                      color: EmpireColors.champagneGold,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(
                                      item.item.name,
                                      style: const TextStyle(
                                        color: EmpireColors.textPrimary,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (item.modifiers.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(
                                    left: 24,
                                    top: 3,
                                  ),
                                  child: Text(
                                    '+ ' + item.modifiers.join(', '),
                                    style: const TextStyle(
                                      color: EmpireColors.textGold,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              if (item.notes.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(
                                    left: 24,
                                    top: 3,
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: EmpireColors.textGold.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(
                                        color: EmpireColors.textGold.withOpacity(0.3),
                                      ),
                                    ),
                                    child: Text(
                                      'Nota: ${item.notes}',
                                      style: const TextStyle(
                                        color: EmpireColors.textGold,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),

                  const Divider(color: EmpireColors.agedBronzeDark, height: 20),

                  // Actions Footer button - pinned at bottom of card
                  SizedBox(
                    height: 44,
                    width: double.infinity,
                    child: _buildActionButton(order),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Color _getTimeAlertBorderColor(int minutesElapsed, String status) {
    if (status == 'ready') {
      return EmpireColors.successGreen;
    }
    if (minutesElapsed > 15) {
      return EmpireColors.errorRed;
    }
    if (minutesElapsed >= 10) {
      return EmpireColors.warningOrange;
    }
    return _getStatusBorderColor(status);
  }

  Widget _buildActionButton(KitchenOrder order) {
    switch (order.status) {
      case 'pending':
        return ElevatedButton(
          onPressed: () {
            widget.state.updateKitchenOrderStatus(order.id, 'preparing');
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: EmpireColors.warningOrange,
            foregroundColor: EmpireColors.obsidian,
          ),
          child: const Text('EMPEZAR PREPARACIÓN'),
        );
      case 'preparing':
        return ElevatedButton(
          onPressed: () {
            widget.state.updateKitchenOrderStatus(order.id, 'ready');

            // Mark table as billing or notify ready
            // We can also trigger a SnackBar in KDS
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                backgroundColor: EmpireColors.successGreen,
                content: Text(
                  '¡Pedido para la ${order.tableLabel} marcado como LISTO!',
                ),
              ),
            );
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: EmpireColors.successGreen,
            foregroundColor: Colors.white,
          ),
          child: const Text('MARCAR COMO LISTO'),
        );
      case 'ready':
        return ElevatedButton(
          onPressed: () {
            widget.state.updateKitchenOrderStatus(order.id, 'served');
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                backgroundColor: EmpireColors.champagneGold,
                content: Text('¡Pedido entregado al mesero!'),
              ),
            );
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: EmpireColors.charcoalSurface,
            foregroundColor: EmpireColors.textPrimary,
            side: const BorderSide(color: EmpireColors.agedBronze, width: 1),
          ),
          child: const Text('ENTREGAR A MESERO'),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Color _getStatusBorderColor(String status) {
    switch (status) {
      case 'pending':
        return EmpireColors.errorRed;
      case 'preparing':
        return EmpireColors.warningOrange;
      case 'ready':
        return EmpireColors.successGreen;
      default:
        return EmpireColors.textSecondary;
    }
  }

  Color _getStatusBgColor(String status) {
    final border = _getStatusBorderColor(status);
    return border.withOpacity(0.15);
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'preparing':
        return 'Preparando';
      case 'ready':
        return 'Listo';
      default:
        return status;
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
}
