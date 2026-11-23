import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../common/uom.dart';
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
      final reqs = await widget.state.fetchWarehouseOutboundRequisitions();
      if (mounted) setState(() => _requisitions = reqs);
    } else if (_selectedTabIndex == 2) {
      final stock = await widget.state
          .fetchWarehouseStock(warehouseId: _selectedWarehouseId);
      if (mounted) setState(() => _warehouseStock = stock);
    }
  }

  Future<void> _triggerSync() async {
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
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
    // Reload the warehouse lists so the screen reflects the fresh server state.
    if (mounted) await _loadInitialData();
    if (!mounted) return;

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          success
              ? 'Sincronización completa con éxito.'
              : 'Sincronización incompleta. Revise su conexión de red.',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor:
            success ? EmpireColors.successGreen : EmpireColors.errorRed,
        duration: const Duration(seconds: 2),
      ),
    );
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
              'No hay órdenes de compra autorizadas',
              style: TextStyle(
                color: EmpireColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Aquí aparecen las órdenes que el propietario o el administrador de inventario autorizan para comprar.',
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

    List<Map<String, dynamic>> withStatus(String status) =>
        _purchaseOrders.where((po) => po['status'] == status).toList();
    final toBuy = withStatus('authorized');
    final onTheWay = withStatus('purchased');
    final partial = withStatus('partially_received');

    return RefreshIndicator(
      onRefresh: _refreshCurrentTab,
      color: EmpireColors.champagneGold,
      backgroundColor: EmpireColors.onyxSurface,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Por comprar', toBuy.length, EmpireColors.infoCyan),
          ...toBuy.map(_buildPurchaseOrderCard),
          if (toBuy.isEmpty) _emptySectionHint('Nada por comprar.'),
          const SizedBox(height: 20),
          _sectionHeader('Comprada · en camino a bodega', onTheWay.length,
              EmpireColors.champagneGold),
          ...onTheWay.map(_buildPurchaseOrderCard),
          if (onTheWay.isEmpty) _emptySectionHint('Ninguna compra en camino.'),
          const SizedBox(height: 20),
          _sectionHeader('Recibidas en parte', partial.length,
              EmpireColors.warningOrange),
          ...partial.map(_buildPurchaseOrderCard),
          if (partial.isEmpty) _emptySectionHint('Sin entradas parciales.'),
        ],
      ),
    );
  }

  Widget _buildPurchaseOrderCard(Map<String, dynamic> po) {
    final poNumber = po['poNumber']?.toString() ?? 'OC-S/N';
    final provider = po['providerName']?.toString() ??
        po['provider']?['name']?.toString() ??
        'Proveedor';
    final status = po['status']?.toString() ?? 'authorized';
    final rawItems = po['items'] as List? ?? const [];
    final orderDate = po['orderDate']?.toString() ?? '';
    final warehouse = po['warehouseName']?.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
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
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: EmpireColors.champagneGold.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      status == 'authorized'
                          ? Icons.shopping_cart_outlined
                          : Icons.local_shipping_outlined,
                      color: EmpireColors.champagneGold,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(poNumber,
                            style: const TextStyle(
                              color: EmpireColors.champagneGold,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            )),
                        Text('Proveedor: $provider',
                            style: const TextStyle(
                              color: EmpireColors.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            )),
                        Text(
                          '${rawItems.length} productos • ${orderDate.split('T').first}'
                          '${warehouse != null ? ' • Entra a: $warehouse' : ''}',
                          style: const TextStyle(
                              color: EmpireColors.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: rawItems.map((item) {
                  final name = item['productName']?.toString() ?? 'Producto';
                  final unit = uomLabel(item['unit'] ?? item['uom']);
                  final pending = (_asDouble(item['quantityOrdered']) -
                          _asDouble(item['quantityReceived']))
                      .clamp(0.0, double.infinity);
                  return Chip(
                    backgroundColor: Colors.black45,
                    label: Text('$name: ${_fmtQty(pending)} $unit'.trim(),
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12)),
                    padding: const EdgeInsets.all(4),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: status == 'authorized'
                    ? ElevatedButton.icon(
                        onPressed: () => _markPurchased(po),
                        icon: const Icon(Icons.shopping_cart_checkout, size: 18),
                        label: const Text('Marcar Comprada'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: EmpireColors.infoCyan,
                          foregroundColor: EmpireColors.obsidian,
                        ),
                      )
                    : ElevatedButton.icon(
                        onPressed: () => _openPoReceivingDialog(po),
                        icon: const Icon(Icons.fact_check_outlined, size: 18),
                        label: const Text('Registrar Entrada'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: EmpireColors.champagneGold,
                          foregroundColor: EmpireColors.obsidian,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _markPurchased(Map<String, dynamic> po) async {
    final ticketController = TextEditingController();
    final notesController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EmpireColors.charcoalSurface,
        title: Text('Comprada · ${po['poNumber'] ?? 'OC'}',
            style: const TextStyle(color: EmpireColors.champagneGold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
                'La orden queda "en camino a bodega". El inventario se actualiza cuando registres la entrada.',
                style: TextStyle(color: EmpireColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 12),
            TextField(
              controller: ticketController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Ticket / factura (opcional)',
                labelStyle: TextStyle(color: Colors.white54, fontSize: 12),
                filled: true,
                fillColor: Colors.black26,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: notesController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: const InputDecoration(
                labelText: 'Nota (opcional)',
                labelStyle: TextStyle(color: Colors.white54, fontSize: 12),
                hintText: 'Ej. Lo trae el proveedor el jueves',
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
                backgroundColor: EmpireColors.infoCyan,
                foregroundColor: EmpireColors.obsidian),
            child: const Text('Confirmar compra'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isLoading = true);
    final error = await widget.state.markPurchaseOrderPurchased(
      poId: po['id'].toString(),
      documentNumber: ticketController.text,
      notes: notesController.text,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    _showResult(error, 'Orden marcada como comprada: va en camino a bodega.');
    if (error == null) _refreshCurrentTab();
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
        'unit': uomLabel(item['unit'] ?? item['uom']),
        'ordered': ordered,
        'pending': pending,
        'estimated': estimatedCost,
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
                        'Entrada a Bodega · $poNumber',
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
                                  child: Text('Pendiente',
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
                                  child: Text('Precio pagado (\$)',
                                      style: TextStyle(
                                          color: EmpireColors.textSecondary,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12))),
                              Padding(
                                  padding: EdgeInsets.all(8),
                                  child: Text('Motivo de diferencia',
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
                    double parse(TextEditingController c) =>
                        double.tryParse(c.text.trim().replaceAll(',', '.')) ??
                        -1;
                    final itemsPayload = <Map<String, dynamic>>[];
                    final lineNotes = <String>[];
                    var hasDifference = false;
                    for (final row in controllers) {
                      final qty = parse(row['qtyController']);
                      final cost = parse(row['costController']);
                      if (qty < 0 || cost < 0) {
                        _showResult('Revisa las cantidades y precios capturados.', '');
                        return;
                      }
                      if ((qty - (row['pending'] as double)).abs() > 0.0005 ||
                          (cost - (row['estimated'] as double)).abs() > 0.004) {
                        hasDifference = true;
                      }
                      final note = (row['notesController'] as TextEditingController)
                          .text
                          .trim();
                      if (note.isNotEmpty) lineNotes.add('${row['productName']}: $note');
                      itemsPayload.add({
                        'productId': row['productId'],
                        'quantityReceived': qty,
                        'unitCostActual': cost,
                      });
                    }
                    if (!itemsPayload.any((i) => (i['quantityReceived'] as double) > 0)) {
                      _showResult('Captura al menos un producto recibido.', '');
                      return;
                    }
                    final notes = [
                      generalNotesController.text.trim(),
                      ...lineNotes,
                    ].where((n) => n.isNotEmpty).join(' · ');
                    if (hasDifference && notes.isEmpty) {
                      _showResult(
                          'Hay diferencias en cantidad o precio: explica el motivo (merma, faltante, cambio de precio…).',
                          '');
                      return;
                    }

                    Navigator.of(dialogCtx).pop();
                    setState(() => _isLoading = true);
                    final error = await widget.state.receivePurchaseOrder(
                      poId: poId,
                      items: itemsPayload,
                      documentNumber: invoiceController.text,
                      notes: notes,
                    );
                    if (!mounted) return;
                    setState(() => _isLoading = false);
                    _showResult(error,
                        'Entrada registrada: el inventario de la bodega ya se actualizó.');
                    if (error == null) _refreshCurrentTab();
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
              'No hay salidas autorizadas',
              style: TextStyle(
                color: EmpireColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Aquí aparecen las requisiciones que el propietario o el administrador de inventario ya autorizaron.',
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

    List<Map<String, dynamic>> withStatus(List<String> statuses) =>
        _requisitions.where((r) => statuses.contains(r['status'])).toList();
    final toFulfil = withStatus(const ['approved', 'standby']);
    final onTheWay = withStatus(const ['in_transit']);
    final delivered = withStatus(const ['delivered']);

    return RefreshIndicator(
      onRefresh: _refreshCurrentTab,
      color: EmpireColors.champagneGold,
      backgroundColor: EmpireColors.onyxSurface,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Por surtir', toFulfil.length, EmpireColors.infoCyan),
          ...toFulfil.map(_buildRequisitionCard),
          if (toFulfil.isEmpty) _emptySectionHint('Nada por surtir.'),
          const SizedBox(height: 20),
          _sectionHeader('En camino', onTheWay.length, EmpireColors.champagneGold),
          ...onTheWay.map(_buildRequisitionCard),
          if (onTheWay.isEmpty) _emptySectionHint('Ninguna salida en camino.'),
          const SizedBox(height: 20),
          _sectionHeader('Entregadas · esperando confirmación de la sucursal',
              delivered.length, EmpireColors.successGreen),
          ...delivered.map(_buildRequisitionCard),
          if (delivered.isEmpty) _emptySectionHint('Sin entregas pendientes de confirmar.'),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, int count, Color color) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Container(width: 4, height: 18, color: color),
            const SizedBox(width: 8),
            Text('$title ($count)',
                style: TextStyle(
                    color: color, fontWeight: FontWeight.bold, fontSize: 15)),
          ],
        ),
      );

  Widget _emptySectionHint(String text) => Padding(
        padding: const EdgeInsets.only(left: 12, bottom: 4),
        child: Text(text,
            style: const TextStyle(
                color: EmpireColors.textSecondary, fontSize: 12)),
      );

  String _fmtQty(double value) =>
      value % 1 == 0 ? value.toInt().toString() : value.toString();

  /// Quantity Bodega must fulfil: the approved one (legacy rows fall back to requested).
  double _approvedQty(dynamic item) {
    final approved = _asDouble(item['quantityApproved'], 0);
    return approved > 0 ? approved : _asDouble(item['quantityRequested'], 0);
  }

  ({String label, Color color}) _statusChip(String status) {
    switch (status) {
      case 'standby':
        return (label: 'En Espera', color: EmpireColors.warningOrange);
      case 'in_transit':
        return (label: 'En Camino', color: EmpireColors.champagneGold);
      case 'delivered':
        return (label: 'Entregada', color: EmpireColors.successGreen);
      default:
        return (label: 'Autorizada · Por Surtir', color: EmpireColors.infoCyan);
    }
  }

  Widget _buildRequisitionCard(Map<String, dynamic> req) {
    final reqId = req['id']?.toString() ?? '';
    final branch = req['fromBranchName']?.toString() ??
        req['fromBranch']?['name']?.toString() ??
        'Sucursal';
    final status = req['status']?.toString() ?? 'approved';
    final rawItems = req['items'] as List? ?? const [];
    final notes = req['notes']?.toString();
    final createdAt = req['createdAt']?.toString() ?? '';
    final chip = _statusChip(status);
    final shipped = status == 'in_transit' || status == 'delivered';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
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
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(branch,
                            style: const TextStyle(
                              color: EmpireColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            )),
                        Text(
                          '${rawItems.length} insumos • Solicitud: ${createdAt.split('T').first}'
                          '${req['toWarehouseName'] != null ? ' • Bodega: ${req['toWarehouseName']}' : ''}',
                          style: const TextStyle(
                              color: EmpireColors.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: chip.color.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(chip.label,
                        style: TextStyle(
                          color: chip.color,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        )),
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
                  child: Text('Nota de la sucursal: $notes',
                      style: const TextStyle(
                          color: EmpireColors.textSecondary,
                          fontStyle: FontStyle.italic,
                          fontSize: 12)),
                ),
              ],
              const SizedBox(height: 12),
              const Divider(color: Colors.white10),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: rawItems.map((item) {
                  final name = item['productName']?.toString() ?? 'Insumo';
                  final unit = uomLabel(item['unit'] ?? item['uom']);
                  final qty = shipped
                      ? _asDouble(item['quantityDispatched'], 0)
                      : _approvedQty(item);
                  return Chip(
                    backgroundColor: Colors.black45,
                    label: Text('$name: ${_fmtQty(qty)} $unit'.trim(),
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
                  if (status == 'approved') ...[
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
                  ],
                  if (status == 'approved' || status == 'standby')
                    ElevatedButton.icon(
                      onPressed: () => _openRequisitionDispatchDialog(req),
                      icon: const Icon(Icons.send_outlined, size: 16),
                      label: const Text('Surtir y Despachar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: EmpireColors.successGreen,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  if (status == 'in_transit')
                    ElevatedButton.icon(
                      onPressed: () => _markDelivered(reqId, branch),
                      icon: const Icon(Icons.task_alt, size: 16),
                      label: const Text('Marcar Entregada'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: EmpireColors.champagneGold,
                        foregroundColor: Colors.black,
                      ),
                    ),
                  if (status == 'delivered')
                    const Text('La sucursal confirmará lo recibido.',
                        style: TextStyle(
                            color: EmpireColors.textSecondary, fontSize: 12)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _markDelivered(String reqId, String branch) async {
    final notesController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EmpireColors.charcoalSurface,
        title: Text('Entregada en $branch',
            style: const TextStyle(color: EmpireColors.champagneGold)),
        content: TextField(
          controller: notesController,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          decoration: const InputDecoration(
            labelText: 'Nota de entrega (opcional)',
            labelStyle: TextStyle(color: Colors.white54, fontSize: 12),
            hintText: 'Ej. Recibió Juan en cocina',
            hintStyle: TextStyle(color: Colors.white30, fontSize: 12),
            filled: true,
            fillColor: Colors.black26,
            border: OutlineInputBorder(),
          ),
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
                backgroundColor: EmpireColors.champagneGold,
                foregroundColor: Colors.black),
            child: const Text('Confirmar entrega'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isLoading = true);
    final error = await widget.state.deliverRequisition(
        requisitionId: reqId, notes: notesController.text);
    if (!mounted) return;
    setState(() => _isLoading = false);
    _showResult(error, 'Entrega registrada. La sucursal ya puede confirmar lo recibido.');
    if (error == null) _refreshCurrentTab();
  }

  void _showResult(String? error, String success) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor:
            error == null ? EmpireColors.successGreen : EmpireColors.errorRed,
        content: Text(error ?? success),
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
      final unit = uomLabel(item['unit'] ?? item['uom']);
      final qtyApproved = _approvedQty(item);

      rows.add({
        'productId': item['productId'],
        'productName': name,
        'unit': unit,
        'qtyRequested': _asDouble(item['quantityRequested'], 0),
        'qtyApproved': qtyApproved,
        'controller': TextEditingController(text: _fmtQty(qtyApproved)),
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
                            'Verifica los insumos surtidos para "$branch". Al confirmar sale el inventario de la bodega y queda En Camino. Si despachas una cantidad distinta a la autorizada, explica el motivo en las notas.',
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
                            child: Text('Autorizado',
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
                        final reqDisplay = _fmtQty(row['qtyApproved']);
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
                      labelText:
                          'Notas de despacho / Chofer / Motivo de diferencias',
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
                final notes = dispatchNotesController.text.trim();
                final items = rows
                    .map((row) => {
                          'productId': row['productId'],
                          'quantity': _asDouble(
                              (row['controller'] as TextEditingController)
                                  .text
                                  .replaceAll(',', '.'),
                              -1),
                        })
                    .toList();
                final invalid = items.any((i) => (i['quantity'] as double) < 0);
                final adjusted = rows.any((row) =>
                    (_asDouble(
                                (row['controller'] as TextEditingController)
                                    .text
                                    .replaceAll(',', '.'),
                                -1) -
                            (row['qtyApproved'] as double))
                        .abs() >
                    0.0005);
                if (invalid || (adjusted && notes.isEmpty)) {
                  _showResult(
                      invalid
                          ? 'Revisa las cantidades a despachar.'
                          : 'Explica en las notas por qué despachas una cantidad distinta a la autorizada.',
                      '');
                  return;
                }
                if (currentDispatchWarehouseId.isEmpty) {
                  _showResult('Selecciona la bodega de salida.', '');
                  return;
                }
                Navigator.of(dialogCtx).pop();
                setState(() => _isLoading = true);

                final error = await widget.state.dispatchRequisition(
                  requisitionId: reqId,
                  warehouseId: currentDispatchWarehouseId,
                  items: items,
                  notes: notes,
                );

                if (!mounted) return;
                setState(() => _isLoading = false);
                _showResult(error,
                    'Salida registrada: va en camino hacia "$branch".');
                if (error == null) _refreshCurrentTab();
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

    if (confirmed != true) return;
    final reason = notesController.text.trim();
    if (reason.isEmpty) {
      _showResult('Indica el motivo para poner la requisición en espera.', '');
      return;
    }
    setState(() => _isLoading = true);
    final error = await widget.state
        .holdRequisition(requisitionId: reqId, reason: reason);
    if (!mounted) return;
    setState(() => _isLoading = false);
    _showResult(error, 'Requisición colocada en espera.');
    if (error == null) _refreshCurrentTab();
  }

  // ---------------------------------------------------------------------------
  // TAB 3: INVENTARIO DE BODEGA & CÓDIGO DE BARRAS (SIN COSTOS / EMPLEADOS OPERATIVOS)
  // ---------------------------------------------------------------------------
  Future<void> _openStockAdjustmentDialog(Map<String, dynamic> item) async {
    final productId =
        item['productId']?.toString() ?? item['id']?.toString() ?? '';
    final name = item['productName'] ?? item['name'] ?? 'Insumo';
    final sku = item['sku'] ?? 'S/SKU';
    final unit = uomLabel(item['unit'] ?? item['uom']);
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
                    final unit = uomLabel(item['unit'] ?? item['uom']);
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
                PopupMenuButton<String>(
                  icon: const Icon(Icons.settings,
                      color: EmpireColors.champagneGold),
                  tooltip: 'Configuración',
                  color: EmpireColors.onyxSurface,
                  surfaceTintColor: Colors.transparent,
                  offset: const Offset(0, 40),
                  onSelected: (value) {
                    if (value == 'logout') {
                      _logout();
                    } else if (value == 'sync') {
                      _triggerSync();
                    }
                  },
                  itemBuilder: (BuildContext context) => const [
                    PopupMenuItem<String>(
                      value: 'sync',
                      child: Row(children: [
                        Icon(Icons.sync,
                            color: EmpireColors.champagneGold, size: 18),
                        SizedBox(width: 8),
                        Text('Sincronizar Datos',
                            style: TextStyle(
                                color: EmpireColors.textPrimary,
                                fontSize: 13)),
                      ]),
                    ),
                    PopupMenuDivider(height: 1),
                    PopupMenuItem<String>(
                      value: 'logout',
                      child: Row(children: [
                        Icon(Icons.logout,
                            color: EmpireColors.errorRed, size: 18),
                        SizedBox(width: 8),
                        Text('Cerrar Sesión',
                            style: TextStyle(
                                color: EmpireColors.textPrimary,
                                fontSize: 13)),
                      ]),
                    ),
                  ],
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
            label: 'Compras y Entradas',
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
