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
  String selectedFilter = 'TODOS'; // 'TODOS', 'PENDIENTES', 'EN PREPARACIÓN', 'LISTOS'

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: widget.state,
          builder: (context, _) {
            // Filter kitchen tickets
            final activeOrders = widget.state.kitchenOrders.where((order) {
              if (order.status == 'served') return false; // Served orders are archived
              
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
                // Top status bar
                OfflineStatusBar(state: widget.state),
                
                // Header
                _buildHeader(context),
                
                // Filters
                _buildFilterBar(),

                // Active orders tickets grid
                Expanded(
                  child: _buildTicketsGrid(activeOrders),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: EmpireColors.champagneGold.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(Icons.soup_kitchen, color: EmpireColors.champagneGold, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                'PANTALLA DE COCINA (KDS)',
                style: Theme.of(context).appBarTheme.titleTextStyle,
              ),
            ],
          ),
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
    final filters = ['TODOS', 'PENDIENTES', 'EN PREPARACIÓN', 'LISTOS'];
    
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

  Widget _buildTicketsGrid(List<KitchenOrder> orders) {
    if (orders.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_turned_in_outlined, color: EmpireColors.textSecondary, size: 48),
            SizedBox(height: 12),
            Text(
              'No hay comandas activas en cocina.',
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
        childAspectRatio: 0.82,
      ),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        final minutesElapsed = DateTime.now().difference(order.timestamp).inMinutes;

        return Card(
          color: EmpireColors.onyxSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: _getStatusBorderColor(order.status),
              width: 1.5,
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
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'Hace $minutesElapsed min',
                      style: TextStyle(
                        color: minutesElapsed > 15 ? EmpireColors.errorRed : EmpireColors.textSecondary,
                        fontSize: 11,
                        fontWeight: minutesElapsed > 15 ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Status Badge
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                  ],
                ),
                const Divider(color: EmpireColors.agedBronzeDark, height: 20),

                // Order items list
                Expanded(
                  child: ListView.builder(
                    itemCount: order.items.length,
                    itemBuilder: (context, idx) {
                      final item = order.items[idx];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8.0),
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
                                    fontSize: 13,
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    item.item.name,
                                    style: const TextStyle(
                                      color: EmpireColors.textPrimary,
                                      fontWeight: FontWeight.w500,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (item.modifiers.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(left: 20, top: 2),
                                child: Text(
                                  '+ ' + item.modifiers.join(', '),
                                  style: const TextStyle(color: EmpireColors.textGold, fontSize: 10),
                                ),
                              ),
                            if (item.notes.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(left: 20, top: 1),
                                child: Text(
                                  'Nota: ${item.notes}',
                                  style: const TextStyle(color: EmpireColors.textSecondary, fontSize: 10, fontStyle: FontStyle.italic),
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),

                const Divider(color: EmpireColors.agedBronzeDark, height: 20),

                // Actions Footer button
                _buildActionButton(order),
              ],
            ),
          ),
        );
      },
    );
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
                content: Text('¡Pedido para la ${order.tableLabel} marcado como LISTO!'),
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
}
