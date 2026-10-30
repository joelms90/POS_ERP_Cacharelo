import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../login_screen.dart';

class WarehouseDashboardScreen extends StatefulWidget {
  final AppState state;

  const WarehouseDashboardScreen({
    super.key,
    required this.state,
  });

  @override
  State<WarehouseDashboardScreen> createState() =>
      _WarehouseDashboardScreenState();
}

class _WarehouseDashboardScreenState extends State<WarehouseDashboardScreen> {
  int _selectedTabIndex = 0;
  bool _isLoading = false;

  // Data lists
  List<Map<String, dynamic>> _purchaseOrders = [];
  List<Map<String, dynamic>> _requisitions = [];
  List<Map<String, dynamic>> _warehouseStock = [];
  List<Map<String, dynamic>> _warehouses = [];
  String? _selectedWarehouseId;

  // Search filter for stock
  final TextEditingController _stockSearchController = TextEditingController();
  final FocusNode _barcodeSearchFocusNode = FocusNode();
  String _stockFilterQuery = '';

  double _asDouble(dynamic val, [double fallback = 0.0]) {
    if (val == null) return fallback;
    if (val is num) return val.toDouble();
    return double.tryParse(val.toString().trim()) ?? fallback;
  }

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _stockSearchController.dispose();
    _barcodeSearchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final whList = await widget.state.fetchWarehousesList();
      if (mounted) {
        setState(() {
          _warehouses = whList;
          if (_selectedWarehouseId == null && whList.isNotEmpty) {
            _selectedWarehouseId = whList.first['id']?.toString();
          }
        });
      }
      await _refreshCurrentTab();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _refreshCurrentTab() async {
    if (_selectedTabIndex == 0) {
      final pos = await widget.state.fetchWarehousePurchaseOrders();
      if (mounted) setState(() => _purchaseOrders = pos);
    } else if (_selectedTabIndex == 1) {
      final reqs = await widget.state.fetchWarehousePendingRequisitions();
      if (mounted) setState(() => _requisitions = reqs);
    } else if (_selectedTabIndex == 2) {
      final stock = await widget.state
          .fetchWarehouseStock(warehouseId: _selectedWarehouseId);
      if (mounted) setState(() => _warehouseStock = stock);
    }
  }

  void _logout() {
    widget.state.logout();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => LoginScreen(state: widget.state)),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 1: RECEPCIÓN DE ÓRDENES DE COMPRA (ENTRADAS DE PROVEEDORES)
  // ---------------------------------------------------------------------------
  Widget _buildPoReceivingTab() {
    if (_purchaseOrders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.inventory_2_outlined,
                size: 64, color: EmpireColors.textSecondary),
            const SizedBox(height: 16),
            const Text(
              'No hay Órdenes de Compra pendientes de recibir',
              style: TextStyle(
                color: EmpireColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Las órdenes emitidas por el área de Compras aparecerán aquí para su recepción.',
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _refreshCurrentTab,
              icon: const Icon(Icons.refresh),
              label: const Text('Actualizar'),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.charcoalSurface,
                foregroundColor: EmpireColors.champagneGold,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshCurrentTab,
      color: EmpireColors.champagneGold,
      backgroundColor: EmpireColors.onyxSurface,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _purchaseOrders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final po = _purchaseOrders[index];
          final poNumber = po['poNumber']?.toString() ?? 'OC-S/N';
          final provider = po['providerName']?.toString() ??
              po['provider']?['name']?.toString() ??
              'Proveedor';
          final status = po['status']?.toString() ?? 'sent';
          final rawItems = po['items'] as List? ?? const [];
          final itemsCount = (po['itemCount'] as num?)?.toInt() ??
              int.tryParse(po['itemCount']?.toString() ?? '') ??
              rawItems.length;
          final orderDate = po['orderDate']?.toString() ?? '';

          return Card(
            color: EmpireColors.charcoalSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Colors.white10),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: EmpireColors.champagneGold.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.local_shipping_outlined,
                      color: EmpireColors.champagneGold,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              poNumber,
                              style: const TextStyle(
                                color: EmpireColors.champagneGold,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: status == 'partially_received'
                                    ? EmpireColors.warningOrange
                                        .withOpacity(0.2)
                                    : EmpireColors.successGreen
                                        .withOpacity(0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                status == 'partially_received'
                                    ? 'Recepción Parcial'
                                    : 'Enviada (Lista para recibir)',
                                style: TextStyle(
                                  color: status == 'partially_received'
                                      ? EmpireColors.warningOrange
                                      : EmpireColors.successGreen,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Proveedor: $provider',
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$itemsCount productos solicitados • Fecha: ${orderDate.split('T').first}',
                          style: const TextStyle(
                            color: EmpireColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => _openPoReceivingDialog(po),
                    icon: const Icon(Icons.fact_check_outlined, size: 18),
                    label: const Text('Recibir Mercancía'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: EmpireColors.champagneGold,
                      foregroundColor: EmpireColors.obsidian,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _openPoReceivingDialog(Map<String, dynamic> po) async {
    final poId = po['id']?.toString() ?? '';
    final poNumber = po['poNumber']?.toString() ?? 'OC';
    final provider = po['providerName']?.toString() ??
        po['provider']?['name']?.toString() ??
        'Proveedor';

    List rawItems = po['items'] as List? ?? const [];
    if (rawItems.isEmpty && poId.isNotEmpty) {
      setState(() => _isLoading = true);
      final fullPo = await widget.state.fetchPurchaseOrderById(poId);
      setState(() => _isLoading = false);
      if (fullPo != null && fullPo['items'] is List) {
        rawItems = fullPo['items'] as List;
      }
    }

    if (rawItems.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: EmpireColors.warningOrange,
            content: Text('Esta orden de compra no tiene productos registrados.'),
          ),
        );
      }
      return;
    }

    // Editable controllers per item
    final controllers = <Map<String, dynamic>>[];
    for (final item in rawItems) {
      final ordered = _asDouble(item['quantityOrdered']);
      final prevReceived = _asDouble(item['quantityReceived']);
      final pending = (ordered - prevReceived).clamp(0.0, double.infinity);
      final estimatedCost = _asDouble(item['unitCostEstimated']);

      final defaultQty = pending > 0
          ? (pending == pending.roundToDouble()
              ? pending.toInt().toString()
              : pending.toString())
          : '0';

      controllers.add({
        'productId': item['productId']?.toString() ?? '',
        'productName': item['productName']?.toString() ??
            item['product']?['name']?.toString() ??
            'Producto',
        'unit': item['unit']?.toString() ?? 'pza',
        'ordered': ordered,
        'pending': pending,
        'qtyController': TextEditingController(text: defaultQty),
        'costController':
            TextEditingController(text: estimatedCost.toStringAsFixed(2)),
        'notesController': TextEditingController(),
      });
    }

    final invoiceController = TextEditingController();
    final generalNotesController = TextEditingController();

    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (dialogInnerCtx, setDialogState) {
            return AlertDialog(
              backgroundColor: EmpireColors.charcoalSurface,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Recepción de Mercancía · $poNumber',
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                      Text(
                        'Proveedor: $provider',
                        style: const TextStyle(
                            color: EmpireColors.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Colors.white70),
                  ),
                ],
              ),
              content: SizedBox(
                width: 780,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Invoice Number Field
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: invoiceController,
                              style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontSize: 14),
                              decoration: const InputDecoration(
                                labelText: 'Folio de Remisión / Factura',
                                labelStyle: TextStyle(
                                    color: EmpireColors.textSecondary),
                                prefixIcon: Icon(Icons.receipt_outlined,
                                    color: EmpireColors.champagneGold),
                                filled: true,
                                fillColor: Colors.black26,
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: TextField(
                              controller: generalNotesController,
                              style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontSize: 14),
                              decoration: const InputDecoration(
                                labelText: 'Observaciones generales del andén',
                                labelStyle: TextStyle(
                                    color: EmpireColors.textSecondary),
                                prefixIcon: Icon(Icons.notes_outlined,
                                    color: EmpireColors.champagneGold),
                                filled: true,
                                fillColor: Colors.black26,
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Cotejo de Productos Recibidos:',
                        style: TextStyle(
                          color: EmpireColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Items Table
                      Table(
                        columnWidths: const {
                          0: FlexColumnWidth(3),
                          1: FlexColumnWidth(1.2),
                          2: FlexColumnWidth(1.5),
                          3: FlexColumnWidth(1.5),
                          4: FlexColumnWidth(2.5),
                        },
                        defaultVerticalAlignment:
                            TableCellVerticalAlignment.middle,
                        children: [
                          const TableRow(
                            decoration: BoxDecoration(color: Colors.white10),
                            children: [
                              Padding(
                                  padding: EdgeInsets.all(8),
                                  child: Text('Producto',
                                      style: TextStyle(
                                          color: EmpireColors.textSecondary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12))),
                              Padding(
                                  padding: EdgeInsets.all(8),
                                  child: Text('Pedido',
                                      style: TextStyle(
                                          color: EmpireColors.textSecondary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12))),
                              Padding(
                                  padding: EdgeInsets.all(8),
                                  child: Text('Cant. Recibida',
                                      style: TextStyle(
                                          color: EmpireColors.champagneGold,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12))),
                              Padding(
                                  padding: EdgeInsets.all(8),
                                  child: Text('Costo Real (\$)',
                                      style: TextStyle(
                                          color: EmpireColors.textSecondary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12))),
                              Padding(
                                  padding: EdgeInsets.all(8),
                                  child: Text('Merma / Motivo faltante',
                                      style: TextStyle(
                                          color: EmpireColors.textSecondary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12))),
                            ],
                          ),
                          ...controllers.map((row) {
                            return TableRow(
                              decoration: const BoxDecoration(
                                border: Border(bottom: BorderSide(color: Colors.white10)),
                              ),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 8, horizontal: 4),
                                  child: Text(
                                    row['productName'],
                                    style: const TextStyle(
                                        color: EmpireColors.textPrimary,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(8),
                                  child: Text(
                                    '${row['pending']} ${row['unit']}',
                                    style: const TextStyle(
                                        color: EmpireColors.textSecondary,
                                        fontSize: 13),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: TextField(
                                    controller: row['qtyController'],
                                    keyboardType: TextInputType.number,
                                    style: const TextStyle(
                                        color: EmpireColors.champagneGold,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14),
                                    decoration: const InputDecoration(
                                      filled: true,
                                      fillColor: Colors.black38,
                                      isDense: true,
                                      contentPadding: EdgeInsets.all(8),
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: TextField(
                                    controller: row['costController'],
                                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                    style: const TextStyle(
                                        color: EmpireColors.textPrimary,
                                        fontSize: 13),
                                    decoration: const InputDecoration(
                                      filled: true,
                                      fillColor: Colors.black38,
                                      isDense: true,
                                      contentPadding: EdgeInsets.all(8),
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: TextField(
                                    controller: row['notesController'],
                                    style: const TextStyle(
                                        color: EmpireColors.textPrimary,
                                        fontSize: 12),
                                    decoration: const InputDecoration(
                                      hintText: 'Ej. 2 cajas rotas',
                                      hintStyle: TextStyle(
                                          color: Colors.white30, fontSize: 11),
                                      filled: true,
                                      fillColor: Colors.black38,
                                      isDense: true,
                                      contentPadding: EdgeInsets.all(8),
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          }),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogCtx).pop(),
                  child: const Text('Cancelar',
                      style: TextStyle(color: EmpireColors.textSecondary)),
                ),
                ElevatedButton.icon(
                  onPressed: () async {
                    final itemsPayload = controllers.map((row) {
                      final qty = double.tryParse(
                              (row['qtyController'] as TextEditingController)
                                  .text) ??
                          0.0;
                      final cost = double.tryParse(
                              (row['costController'] as TextEditingController)
                                  .text) ??
                          0.0;
                      final notes = (row['notesController']
                              as TextEditingController)
                          .text
                          .trim();

                      return {
                        'productId': row['productId'],
                        'quantityReceived': qty,
                        'unitCostActual': cost,
                        'actualUnitCost': cost,
                        if (notes.isNotEmpty) 'rejectionReason': notes,
                      };
                    }).toList();

                    Navigator.of(dialogCtx).pop();
                    setState(() => _isLoading = true);

                    final success = await widget.state.receivePurchaseOrder(
                      poId: poId,
                      warehouseId: _selectedWarehouseId,
                      invoiceNumber: invoiceController.text.trim(),
                      items: itemsPayload,
                      receivingNotes: generalNotesController.text.trim(),
                    );

                    setState(() => _isLoading = false);

                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: success
                              ? EmpireColors.successGreen
                              : EmpireColors.errorRed,
                          content: Text(success
                              ? 'Mercancía ingresada correctamente al inventario de la bodega.'
                              : 'Error al procesar la recepción de mercancía.'),
                        ),
                      );
                      if (success) _refreshCurrentTab();
                    }
                  },
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Confirmar Entrada a Bodega'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: EmpireColors.successGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 12),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 2: SURTIDO Y DESPACHO A SUCURSALES (SALIDAS / REQUISICIONES)
  // ---------------------------------------------------------------------------
  Widget _buildRequisitionsTab() {
    if (_requisitions.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.outbox_outlined,
                size: 64, color: EmpireColors.textSecondary),
            const SizedBox(height: 16),
            const Text(
              'No hay requisiciones pendientes de surtir',
              style: TextStyle(
                color: EmpireColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Las solicitudes de insumos emitidas por las tiendas y cafeterías aparecerán aquí.',
              style: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _refreshCurrentTab,
              icon: const Icon(Icons.refresh),
              label: const Text('Actualizar'),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.charcoalSurface,
                foregroundColor: EmpireColors.champagneGold,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshCurrentTab,
      color: EmpireColors.champagneGold,
      backgroundColor: EmpireColors.onyxSurface,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _requisitions.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final req = _requisitions[index];
          final reqId = req['id']?.toString() ?? '';
          final branch = req['fromBranchName']?.toString() ??
              req['fromBranch']?['name']?.toString() ??
              'Sucursal';
          final status = req['status']?.toString() ?? 'pending';
          final rawItems = req['items'] as List? ?? const [];
          final itemsCount = (req['itemCount'] as num?)?.toInt() ??
              int.tryParse(req['itemCount']?.toString() ?? '') ??
              rawItems.length;
          final notes = req['notes']?.toString();
          final createdAt = req['createdAt']?.toString() ?? '';

          return Card(
            color: EmpireColors.charcoalSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Colors.white10),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: EmpireColors.infoCyan.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.storefront_outlined,
                                color: EmpireColors.infoCyan, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                branch,
                                style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                              Row(
                                children: [
                                  Text(
                                    '$itemsCount insumos solicitados • Solicitud: ${createdAt.split('T').first}',
                                    style: const TextStyle(
                                        color: EmpireColors.textSecondary,
                                        fontSize: 12),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: req['toWarehouseName'] != null
                                          ? EmpireColors.champagneGold
                                              .withOpacity(0.15)
                                          : Colors.white10,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      req['toWarehouseName'] != null
                                          ? 'Bodega: ${req['toWarehouseName']}'
                                          : 'Bodega: Asignar al surtir',
                                      style: TextStyle(
                                        color: req['toWarehouseName'] != null
                                            ? EmpireColors.champagneGold
                                            : Colors.white54,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: status == 'standby'
                              ? EmpireColors.warningOrange.withOpacity(0.2)
                              : EmpireColors.infoCyan.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status == 'standby' ? 'En Espera' : 'Pendiente de Surtir',
                          style: TextStyle(
                            color: status == 'standby'
                                ? EmpireColors.warningOrange
                                : EmpireColors.infoCyan,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (notes != null && notes.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.black26,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Nota de la sucursal: $notes',
                        style: const TextStyle(
                            color: EmpireColors.textSecondary,
                            fontStyle: FontStyle.italic,
                            fontSize: 12),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  const Divider(color: Colors.white10),
                  const SizedBox(height: 8),

                  // Requested items preview chips
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: rawItems.map((item) {
                      final name = item['productName']?.toString() ??
                          item['product']?['name']?.toString() ??
                          'Insumo';
                      final qty = _asDouble(item['quantityRequested'], 1.0);
                      final unit = item['unit']?.toString() ?? item['uom']?.toString() ?? '';
                      final qtyFormatted =
                          qty % 1 == 0 ? qty.toInt().toString() : qty.toString();
                      return Chip(
                        backgroundColor: Colors.black45,
                        label: Text('$name: $qtyFormatted $unit'.trim(),
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 12)),
                        padding: const EdgeInsets.all(4),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _standbyRequisition(reqId),
                        icon: const Icon(Icons.pause_circle_outline, size: 16),
                        label: const Text('Poner en Espera'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: EmpireColors.warningOrange,
                          side: const BorderSide(
                              color: EmpireColors.warningOrange),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton.icon(
                        onPressed: () => _openRequisitionDispatchDialog(req),
                        icon: const Icon(Icons.send_outlined, size: 16),
                        label: const Text('Surtir y Despachar'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: EmpireColors.successGreen,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _openRequisitionDispatchDialog(Map<String, dynamic> req) async {
    final reqId = req['id']?.toString() ?? '';
    final branch = req['fromBranchName']?.toString() ??
        req['fromBranch']?['name']?.toString() ??
        'Sucursal';

    List<dynamic> items = (req['items'] as List?) ?? [];
    if (items.isEmpty && reqId.isNotEmpty) {
      setState(() => _isLoading = true);
      final fullReq = await widget.state.fetchRequisitionById(reqId);
      setState(() => _isLoading = false);
      if (fullReq != null && fullReq['items'] is List) {
        items = fullReq['items'] as List;
      }
    }

    if (items.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: EmpireColors.warningOrange,
            content: Text('No hay insumos detallados en esta requisición.'),
          ),
        );
      }
      return;
    }

    final List<Map<String, dynamic>> rows = [];
    for (var item in items) {
      final name = item['productName']?.toString() ??
          item['product']?['name']?.toString() ??
          'Insumo';
      final unit = item['unit']?.toString() ?? item['uom']?.toString() ?? 'pza';
      final qtyReq = _asDouble(item['quantityRequested'], 1.0);
      final qtyFormatted =
          qtyReq % 1 == 0 ? qtyReq.toInt().toString() : qtyReq.toString();

      rows.add({
        'productId': item['productId'],
        'productName': name,
        'unit': unit,
        'qtyRequested': qtyReq,
        'controller': TextEditingController(text: qtyFormatted),
      });
    }

    final dispatchNotesController = TextEditingController();
    String currentDispatchWarehouseId = req['toWarehouseId']?.toString() ??
        _selectedWarehouseId ??
        (_warehouses.isNotEmpty ? _warehouses.first['id']?.toString() ?? '' : '');

    if (!mounted) return;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
          backgroundColor: EmpireColors.charcoalSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Colors.white24),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: EmpireColors.successGreen.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.outbox,
                    color: EmpireColors.successGreen, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Surtir y Despachar a Sucursal',
                      style: TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    Text(
                      'Destino: $branch',
                      style: const TextStyle(
                          color: EmpireColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
          content: SizedBox(
            width: 650,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.black26,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline,
                            color: EmpireColors.infoCyan, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Verifica los insumos surtidos de la bodega para su entrega a "$branch". Al confirmar, se generará la salida del inventario.',
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: EmpireColors.onyxSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: EmpireColors.champagneGold.withOpacity(0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.warehouse_outlined,
                                color: EmpireColors.champagneGold, size: 18),
                            SizedBox(width: 8),
                            Text(
                              'Bodega de Salida (Origen del Inventario):',
                              style: TextStyle(
                                color: EmpireColors.champagneGold,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<String>(
                          value: currentDispatchWarehouseId.isNotEmpty
                              ? currentDispatchWarehouseId
                              : null,
                          dropdownColor: EmpireColors.charcoalSurface,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 13),
                          decoration: const InputDecoration(
                            filled: true,
                            fillColor: Colors.black38,
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                            border: OutlineInputBorder(),
                          ),
                          items: _warehouses.map((w) {
                            return DropdownMenuItem<String>(
                              value: w['id']?.toString(),
                              child: Text(
                                  w['name']?.toString() ?? 'Bodega'),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setDialogState(() {
                                currentDispatchWarehouseId = val;
                              });
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Insumos Solicitados:',
                    style: TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Table(
                    columnWidths: const {
                      0: FlexColumnWidth(3),
                      1: FlexColumnWidth(1.5),
                      2: FlexColumnWidth(2),
                    },
                    defaultVerticalAlignment:
                        TableCellVerticalAlignment.middle,
                    children: [
                      const TableRow(
                        decoration: BoxDecoration(
                          border:
                              Border(bottom: BorderSide(color: Colors.white24)),
                        ),
                        children: [
                          Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Text('Insumo',
                                style: TextStyle(
                                    color: Colors.white60,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12)),
                          ),
                          Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Text('Solicitado',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    color: Colors.white60,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12)),
                          ),
                          Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Text('A Despachar',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    color: EmpireColors.champagneGold,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12)),
                          ),
                        ],
                      ),
                      ...rows.map((row) {
                        final reqDisplay = row['qtyRequested'] % 1 == 0
                            ? row['qtyRequested'].toInt().toString()
                            : row['qtyRequested'].toString();
                        return TableRow(
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    row['productName'],
                                    style: const TextStyle(
                                      color: EmpireColors.textPrimary,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    'Unidad: ${row['unit']}',
                                    style: const TextStyle(
                                        color: Colors.white38, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Text(
                                '$reqDisplay ${row['unit']}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    color: Colors.white70, fontSize: 13),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(4),
                              child: TextField(
                                controller: row['controller'],
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: EmpireColors.champagneGold,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                                decoration: const InputDecoration(
                                  filled: true,
                                  fillColor: Colors.black38,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(
                                      vertical: 8, horizontal: 8),
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ),
                          ],
                        );
                      }),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: dispatchNotesController,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Notas de despacho / Chofer / Folio (opcional)',
                      labelStyle:
                          TextStyle(color: Colors.white54, fontSize: 12),
                      hintText: 'Ej. Entregado completo en camioneta 02',
                      hintStyle:
                          TextStyle(color: Colors.white30, fontSize: 12),
                      filled: true,
                      fillColor: Colors.black26,
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text('Cancelar',
                  style: TextStyle(color: EmpireColors.textSecondary)),
            ),
            ElevatedButton.icon(
              onPressed: () async {
                Navigator.of(dialogCtx).pop();
                setState(() => _isLoading = true);

                final notes = dispatchNotesController.text.trim();
                final ok = await widget.state.updateRequisitionStatus(
                  requisitionId: reqId,
                  status: 'approved',
                  notes: notes.isNotEmpty ? notes : null,
                  warehouseId: currentDispatchWarehouseId.isNotEmpty
                      ? currentDispatchWarehouseId
                      : null,
                );

                setState(() => _isLoading = false);

                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: ok
                          ? EmpireColors.successGreen
                          : EmpireColors.errorRed,
                      content: Text(ok
                          ? 'Traspaso surtido y despachado exitosamente hacia "$branch".'
                          : 'Error al despachar la requisición.'),
                    ),
                  );
                  if (ok) _refreshCurrentTab();
                }
              },
              icon: const Icon(Icons.send_outlined, size: 18),
              label: const Text('Confirmar Despacho a Sucursal'),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.successGreen,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          ],
        );
          },
        );
      },
    );
  }

  Future<void> _standbyRequisition(String reqId) async {
    final notesController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EmpireColors.charcoalSurface,
        title: const Text('Poner Requisición en Espera',
            style: TextStyle(color: EmpireColors.warningOrange)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Indica el motivo por el cual no se puede surtir de inmediato:',
              style: TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: const InputDecoration(
                hintText: 'Ej. Insumo agotado, en espera de proveedor',
                hintStyle: TextStyle(color: Colors.white30, fontSize: 12),
                filled: true,
                fillColor: Colors.black26,
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar',
                style: TextStyle(color: EmpireColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.warningOrange,
                foregroundColor: Colors.black),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _isLoading = true);
      final ok = await widget.state.updateRequisitionStatus(
        requisitionId: reqId,
        status: 'standby',
        notes: notesController.text.trim(),
      );
      setState(() => _isLoading = false);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor:
                ok ? EmpireColors.warningOrange : EmpireColors.errorRed,
            content: Text(ok
                ? 'Requisición colocada en espera.'
                : 'Error al actualizar requisición.'),
          ),
        );
        if (ok) _refreshCurrentTab();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 3: INVENTARIO DE BODEGA & CÓDIGO DE BARRAS (SIN COSTOS / EMPLEADOS OPERATIVOS)
  // ---------------------------------------------------------------------------
  Future<void> _openStockAdjustmentDialog(Map<String, dynamic> item) async {
    final productId =
        item['productId']?.toString() ?? item['id']?.toString() ?? '';
    final name = item['productName'] ?? item['name'] ?? 'Insumo';
    final sku = item['sku'] ?? 'S/SKU';
    final unit = item['unit'] ?? item['uom'] ?? 'pza';
    final currentStock =
        _asDouble(item['currentStock'] ?? item['quantity'], 0.0);
    final currentStockFormatted = currentStock % 1 == 0
        ? currentStock.toInt().toString()
        : currentStock.toString();

    final newQtyController =
        TextEditingController(text: currentStockFormatted);
    final reasonController = TextEditingController(text: 'Conteo físico');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          backgroundColor: EmpireColors.charcoalSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Colors.white24),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: EmpireColors.champagneGold.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.tune,
                    color: EmpireColors.champagneGold, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Ajuste Físico de Existencia',
                      style: TextStyle(
                        color: EmpireColors.champagneGold,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      '$name (SKU: $sku)',
                      style: const TextStyle(
                          color: EmpireColors.textSecondary, fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Stock actual en sistema:',
                        style: TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      Text(
                        '$currentStockFormatted $unit',
                        style: const TextStyle(
                          color: EmpireColors.champagneGold,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Nueva Cantidad Física Contada:',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: newQtyController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                  decoration: InputDecoration(
                    suffixText: unit,
                    suffixStyle:
                        const TextStyle(color: EmpireColors.champagneGold),
                    filled: true,
                    fillColor: Colors.black38,
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Motivo del Ajuste:',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: reasonController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'Ej. Conteo físico, Merma por daño, etc.',
                    hintStyle:
                        TextStyle(color: Colors.white30, fontSize: 12),
                    filled: true,
                    fillColor: Colors.black38,
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(false),
              child: const Text('Cancelar',
                  style: TextStyle(color: EmpireColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogCtx).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.champagneGold,
                foregroundColor: EmpireColors.obsidian,
              ),
              child: const Text('Guardar Ajuste'),
            ),
          ],
        );
      },
    );

    if (confirmed == true && _selectedWarehouseId != null) {
      final newQty = double.tryParse(newQtyController.text.trim());
      if (newQty == null || newQty < 0) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: EmpireColors.errorRed,
              content: Text('Por favor ingresa una cantidad válida.'),
            ),
          );
        }
        return;
      }

      setState(() => _isLoading = true);
      final ok = await widget.state.adjustWarehouseStock(
        productId: productId,
        warehouseId: _selectedWarehouseId!,
        newQuantity: newQty,
      );
      setState(() => _isLoading = false);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor:
                ok ? EmpireColors.successGreen : EmpireColors.errorRed,
            content: Text(ok
                ? 'Existencia de "$name" ajustada a $newQty $unit.'
                : 'Error al ajustar la existencia.'),
          ),
        );
        if (ok) _refreshCurrentTab();
      }
    }
  }

  Widget _buildWarehouseStockTab() {
    final filtered = _warehouseStock.where((item) {
      if (_stockFilterQuery.isEmpty) return true;
      final q = _stockFilterQuery.toLowerCase();
      final name = (item['productName'] ?? item['name'] ?? '').toString().toLowerCase();
      final sku = (item['sku'] ?? '').toString().toLowerCase();
      final barcode = (item['barcode'] ?? item['internalCode'] ?? '').toString().toLowerCase();
      return name.contains(q) || sku.contains(q) || barcode.contains(q);
    }).toList();

    return Column(
      children: [
        // Search & Barcode Scan Bar
        Container(
          padding: const EdgeInsets.all(16),
          color: EmpireColors.charcoalSurface,
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _stockSearchController,
                  focusNode: _barcodeSearchFocusNode,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.qr_code_scanner,
                        color: EmpireColors.champagneGold),
                    hintText:
                        'Escanear código de barras o buscar por nombre / SKU…',
                    hintStyle:
                        const TextStyle(color: Colors.white30, fontSize: 13),
                    filled: true,
                    fillColor: Colors.black26,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    suffixIcon: _stockSearchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, color: Colors.white60),
                            onPressed: () {
                              _stockSearchController.clear();
                              setState(() => _stockFilterQuery = '');
                            },
                          )
                        : null,
                  ),
                  onChanged: (val) {
                    setState(() => _stockFilterQuery = val.trim());
                  },
                ),
              ),
              const SizedBox(width: 12),
              IconButton(
                onPressed: _refreshCurrentTab,
                icon: const Icon(Icons.refresh, color: EmpireColors.champagneGold),
                tooltip: 'Actualizar existencias',
              ),
            ],
          ),
        ),

        // Stock List (NO COSTS SHOWN)
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    _stockFilterQuery.isEmpty
                        ? 'No hay productos registrados en esta bodega'
                        : 'No se encontraron productos coincidentes con "$_stockFilterQuery"',
                    style: const TextStyle(
                        color: EmpireColors.textSecondary, fontSize: 14),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    final name = item['productName'] ?? item['name'] ?? 'Insumo';
                    final sku = item['sku'] ?? 'S/SKU';
                    final barcode = item['barcode'] ?? item['internalCode'] ?? 'S/Código';
                    final stockNum = _asDouble(item['currentStock'] ?? item['quantity'], 0.0);
                    final unit = item['unit'] ?? item['uom'] ?? 'pza';
                    final stockFormatted = stockNum % 1 == 0
                        ? stockNum.toInt().toString()
                        : stockNum.toString();

                    final isOutOfStock = stockNum <= 0;
                    final isLowStock = stockNum > 0 && stockNum <= 5;

                    return Card(
                      color: EmpireColors.charcoalSurface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: const BorderSide(color: Colors.white10),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor:
                              EmpireColors.champagneGold.withOpacity(0.12),
                          child: const Icon(Icons.inventory_2,
                              color: EmpireColors.champagneGold, size: 20),
                        ),
                        title: Text(
                          name.toString(),
                          style: const TextStyle(
                            color: EmpireColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        subtitle: Text(
                          'SKU: $sku • Código: $barcode',
                          style: const TextStyle(
                              color: EmpireColors.textSecondary, fontSize: 12),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black38,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isOutOfStock
                                      ? EmpireColors.errorRed.withOpacity(0.5)
                                      : isLowStock
                                          ? EmpireColors.warningOrange.withOpacity(0.5)
                                          : EmpireColors.successGreen.withOpacity(0.5),
                                ),
                              ),
                              child: Text(
                                isOutOfStock
                                    ? 'Agotado (0 $unit)'
                                    : isLowStock
                                        ? '$stockFormatted $unit (Bajo)'
                                        : '$stockFormatted $unit',
                                style: TextStyle(
                                  color: isOutOfStock
                                      ? EmpireColors.errorRed
                                      : isLowStock
                                          ? EmpireColors.warningOrange
                                          : EmpireColors.successGreen,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.tune,
                                  color: EmpireColors.champagneGold, size: 20),
                              tooltip: 'Ajustar conteo físico',
                              onPressed: () => _openStockAdjustmentDialog(item),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN SCAFFOLD & APP BAR
  // ---------------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      appBar: AppBar(
        backgroundColor: EmpireColors.charcoalSurface,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: EmpireColors.champagneGold.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.warehouse_rounded,
                  color: EmpireColors.champagneGold, size: 22),
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Text(
                    'ALMACÉN & BODEGA CENTRAL',
                    style: TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      letterSpacing: 1.2,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Operaciones de Custodia, Entradas y Salidas',
                    style: TextStyle(color: Colors.white54, fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Bodega Switcher if multiple
          if (_warehouses.length > 1)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedWarehouseId,
                    dropdownColor: EmpireColors.charcoalSurface,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    items: _warehouses.map((w) {
                      return DropdownMenuItem<String>(
                        value: w['id']?.toString(),
                        child: Text(w['name']?.toString() ?? 'Bodega'),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedWarehouseId = val);
                        _refreshCurrentTab();
                      }
                    },
                  ),
                ),
              ),
            ),

          const SizedBox(width: 12),

          // Operator profile & Logout
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Row(
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      widget.state.currentUserName.isNotEmpty
                          ? widget.state.currentUserName
                          : 'Operador de Almacén',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold),
                    ),
                    const Text(
                      'Almacén & Compras',
                      style: TextStyle(
                          color: EmpireColors.champagneGold, fontSize: 10),
                    ),
                  ],
                ),
                const SizedBox(width: 10),
                IconButton(
                  onPressed: _logout,
                  icon: const Icon(Icons.logout, color: EmpireColors.errorRed),
                  tooltip: 'Cerrar sesión',
                ),
              ],
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: EmpireColors.champagneGold))
          : IndexedStack(
              index: _selectedTabIndex,
              children: [
                _buildPoReceivingTab(),
                _buildRequisitionsTab(),
                _buildWarehouseStockTab(),
              ],
            ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: EmpireColors.charcoalSurface,
        indicatorColor: EmpireColors.champagneGold.withOpacity(0.2),
        selectedIndex: _selectedTabIndex,
        onDestinationSelected: (idx) {
          setState(() => _selectedTabIndex = idx);
          _refreshCurrentTab();
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.move_to_inbox_outlined),
            selectedIcon:
                Icon(Icons.move_to_inbox, color: EmpireColors.champagneGold),
            label: 'Entradas (Proveedores)',
          ),
          NavigationDestination(
            icon: Icon(Icons.outbox_outlined),
            selectedIcon: Icon(Icons.outbox, color: EmpireColors.champagneGold),
            label: 'Salidas (Sucursales)',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon:
                Icon(Icons.inventory_2, color: EmpireColors.champagneGold),
            label: 'Inventario de Bodega',
          ),
        ],
      ),
    );
  }
}
