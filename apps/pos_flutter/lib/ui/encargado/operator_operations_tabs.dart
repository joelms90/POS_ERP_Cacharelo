import 'package:flutter/material.dart';

import '../common/app_state.dart';
import '../common/colors.dart';

class InventoryReceiptsTab extends StatefulWidget {
  final AppState state;
  const InventoryReceiptsTab({super.key, required this.state});

  @override
  State<InventoryReceiptsTab> createState() => _InventoryReceiptsTabState();
}

class _InventoryReceiptsTabState extends State<InventoryReceiptsTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _transfers = const [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    final transfers = await widget.state.fetchInboundTransfers();
    if (mounted) {
      setState(() {
        _transfers = transfers;
        _loading = false;
      });
    }
  }

  Future<void> _receive(Map<String, dynamic> transfer) async {
    final detail = await widget.state.fetchTransfer(transfer['id'].toString());
    if (!mounted) return;
    if (detail == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('No se pudo cargar el detalle del traspaso.')));
      return;
    }
    final items = (detail['items'] as List? ?? const [])
        .map((raw) => Map<String, dynamic>.from(raw as Map))
        .toList();

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => ReceiveTransferDialog(
        state: widget.state,
        transfer: transfer,
        initialItems: items,
      ),
    );

    if (confirmed == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Recepción registrada exitosamente.')),
      );
      _refresh();
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: EmpireColors.obsidian,
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(
                    color: EmpireColors.champagneGold))
            : RefreshIndicator(
                onRefresh: _refresh,
                child: _transfers.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 180),
                        Center(
                            child: Text('No hay entregas pendientes',
                                style: TextStyle(
                                    color: EmpireColors.textSecondary)))
                      ])
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _transfers.length,
                        itemBuilder: (context, index) {
                          final transfer = _transfers[index];
                          return Card(
                            color: EmpireColors.onyxSurface,
                            child: ListTile(
                              leading: const Icon(Icons.local_shipping_outlined,
                                  color: EmpireColors.champagneGold),
                              title: Text(
                                  'Entrega ${transfer['id'].toString().substring(0, 8).toUpperCase()}',
                                  style: const TextStyle(
                                      color: EmpireColors.textPrimary)),
                              subtitle: Text(
                                  '${transfer['itemCount'] ?? 0} productos · ${transfer['fromWarehouseName'] ?? transfer['fromBranchName'] ?? 'Origen'}',
                                  style: const TextStyle(
                                      color: EmpireColors.textSecondary)),
                              trailing: ElevatedButton(
                                  onPressed: () => _receive(transfer),
                                  child: const Text('Recibir')),
                            ),
                          );
                        },
                      ),
              ),
      );
}

class DailySalesTab extends StatefulWidget {
  final AppState state;
  const DailySalesTab({super.key, required this.state});
  @override
  State<DailySalesTab> createState() => _DailySalesTabState();
}

class _DailySalesTabState extends State<DailySalesTab> {
  Map<String, dynamic>? _summary;
  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final value = await widget.state.fetchTodaySalesSummary();
    if (mounted) setState(() => _summary = value);
  }

  double _amount(String key) => (_summary?[key] as num?)?.toDouble() ?? 0;
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: EmpireColors.obsidian,
        body: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            const Text('Ventas de hoy',
                style: TextStyle(
                    color: EmpireColors.champagneGold,
                    fontSize: 20,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _SalesCard(
                label: 'Efectivo',
                amount: _amount('cashTotal'),
                icon: Icons.payments_outlined),
            _SalesCard(
                label: 'Tarjeta',
                amount: _amount('cardTotal'),
                icon: Icons.credit_card),
            _SalesCard(
                label: 'Total cobrado',
                amount: _amount('total'),
                icon: Icons.point_of_sale),
            const SizedBox(height: 12),
            Text('Solo incluye ventas de tu sucursal registradas hoy.',
                style: TextStyle(
                    color: EmpireColors.textSecondary.withValues(alpha: 0.8))),
          ]),
        ),
      );
}

class _SalesCard extends StatelessWidget {
  final String label;
  final double amount;
  final IconData icon;
  const _SalesCard(
      {required this.label, required this.amount, required this.icon});
  @override
  Widget build(BuildContext context) => Card(
        color: EmpireColors.onyxSurface,
        child: ListTile(
          leading: Icon(icon, color: EmpireColors.champagneGold),
          title: Text(label,
              style: const TextStyle(color: EmpireColors.textSecondary)),
          trailing: Text('\$${amount.toStringAsFixed(2)}',
              style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold)),
        ),
      );
}

class _ReceiptItemEntry {
  final String productId;
  final String productName;
  final String? sku;
  final double quantityShipped;
  final bool isOriginal;
  final TextEditingController controller;

  _ReceiptItemEntry({
    required this.productId,
    required this.productName,
    this.sku,
    required this.quantityShipped,
    required this.isOriginal,
    required this.controller,
  });

  void dispose() {
    controller.dispose();
  }
}

class ReceiveTransferDialog extends StatefulWidget {
  final AppState state;
  final Map<String, dynamic> transfer;
  final List<Map<String, dynamic>> initialItems;

  const ReceiveTransferDialog({
    super.key,
    required this.state,
    required this.transfer,
    required this.initialItems,
  });

  @override
  State<ReceiveTransferDialog> createState() => _ReceiveTransferDialogState();
}

class _ReceiveTransferDialogState extends State<ReceiveTransferDialog> {
  late final TextEditingController _noteController;
  final List<_ReceiptItemEntry> _items = [];
  final Set<String> _originalProductIds = {};
  final Map<String, double> _originalQuantities = {};
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _noteController = TextEditingController();
    for (final raw in widget.initialItems) {
      final pId = raw['productId']?.toString() ?? '';
      if (pId.isEmpty) continue;
      final name = raw['productName']?.toString() ?? 'Producto';
      final sku = raw['sku']?.toString() ?? raw['internalCode']?.toString();
      final qty = double.tryParse(raw['quantity']?.toString() ?? '0') ?? 0.0;
      _originalProductIds.add(pId);
      _originalQuantities[pId] = qty;
      _items.add(_ReceiptItemEntry(
        productId: pId,
        productName: name,
        sku: sku,
        quantityShipped: qty,
        isOriginal: true,
        controller: TextEditingController(
          text: qty > 0
              ? (qty % 1 == 0 ? qty.toInt().toString() : qty.toString())
              : '0',
        ),
      ));
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  void _removeItem(int index) {
    setState(() {
      final removed = _items.removeAt(index);
      removed.dispose();
    });
  }

  Future<void> _openAddProductSearch() async {
    final seenIds = <String>{};
    final List<Map<String, dynamic>> catalog = [];

    for (final ing in widget.state.cachedIngredients) {
      final id = ing['id']?.toString() ?? '';
      if (id.isNotEmpty && seenIds.add(id)) {
        catalog.add({
          'id': id,
          'name': ing['name']?.toString() ?? 'Sin nombre',
          'sku': ing['sku']?.toString() ?? '',
          'internalCode': ing['internalCode']?.toString() ?? '',
          'code': ing['code']?.toString() ?? '',
        });
      }
    }

    for (final m in AppState.menu) {
      final id = m.id;
      if (id.isNotEmpty && seenIds.add(id)) {
        catalog.add({
          'id': id,
          'name': m.name,
          'sku': '',
          'internalCode': '',
          'code': '',
        });
      }
    }

    if (catalog.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('No hay productos en el catálogo. Por favor sincronice.'),
        ),
      );
      return;
    }

    await showDialog(
      context: context,
      builder: (ctx) {
        String? selectedProductId;
        String query = '';
        final qtyController = TextEditingController(text: '1.0');

        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            final filtered = catalog.where((item) {
              final searchable = [
                item['name'],
                item['sku'],
                item['internalCode'],
                item['code'],
              ].map((v) => v?.toString().toLowerCase() ?? '').join(' ');
              return query.isEmpty || searchable.contains(query);
            }).toList();

            return AlertDialog(
              backgroundColor: EmpireColors.onyxSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: EmpireColors.agedBronze),
              ),
              title: const Text(
                'Buscar Producto / Insumo',
                style:
                    TextStyle(color: EmpireColors.champagneGold, fontSize: 16),
              ),
              content: SizedBox(
                width: 440,
                height: 380,
                child: Column(
                  children: [
                    TextField(
                      autofocus: true,
                      style: const TextStyle(color: EmpireColors.textPrimary),
                      onChanged: (val) =>
                          setDialogState(() => query = val.trim().toLowerCase()),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search,
                            color: EmpireColors.champagneGold),
                        hintText: 'Buscar por nombre, SKU o código',
                        hintStyle: TextStyle(color: EmpireColors.textSecondary),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: filtered.isEmpty
                          ? const Center(
                              child: Text(
                                'No se encontraron productos',
                                style: TextStyle(
                                    color: EmpireColors.textSecondary),
                              ),
                            )
                          : ListView.separated(
                              itemCount: filtered.length,
                              separatorBuilder: (_, __) => const Divider(
                                color: EmpireColors.charcoalSurface,
                                height: 1,
                              ),
                              itemBuilder: (context, idx) {
                                final item = filtered[idx];
                                final isSelected =
                                    item['id'] == selectedProductId;
                                final code = item['sku'] ??
                                    item['internalCode'] ??
                                    item['code'];
                                return ListTile(
                                  dense: true,
                                  selected: isSelected,
                                  selectedTileColor: EmpireColors.champagneGold
                                      .withValues(alpha: 0.12),
                                  title: Text(
                                    item['name']?.toString() ?? 'Sin nombre',
                                    style: const TextStyle(
                                        color: EmpireColors.textPrimary),
                                  ),
                                  subtitle: code == null ||
                                          code.toString().isEmpty
                                      ? null
                                      : Text(
                                          code.toString(),
                                          style: const TextStyle(
                                              color: EmpireColors.textSecondary,
                                              fontSize: 12),
                                        ),
                                  trailing: isSelected
                                      ? const Icon(Icons.check_circle,
                                          color: EmpireColors.champagneGold)
                                      : null,
                                  onTap: () => setDialogState(() =>
                                      selectedProductId =
                                          item['id']?.toString()),
                                );
                              },
                            ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: qtyController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: EmpireColors.textPrimary),
                      decoration: const InputDecoration(
                        labelText: 'Cantidad recibida',
                        labelStyle:
                            TextStyle(color: EmpireColors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancelar'),
                ),
                TextButton(
                  onPressed: () {
                    final qty = double.tryParse(qtyController.text) ?? 0.0;
                    if (selectedProductId == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Seleccione un producto')),
                      );
                      return;
                    }
                    if (qty <= 0.0) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('La cantidad debe ser mayor a 0')),
                      );
                      return;
                    }

                    final product = catalog
                        .firstWhere((p) => p['id'] == selectedProductId);
                    final existingIdx = _items.indexWhere(
                        (i) => i.productId == selectedProductId);

                    setState(() {
                      if (existingIdx >= 0) {
                        final currentVal = double.tryParse(
                                _items[existingIdx].controller.text) ??
                            0.0;
                        final newVal = currentVal + qty;
                        _items[existingIdx].controller.text = newVal % 1 == 0
                            ? newVal.toInt().toString()
                            : newVal.toString();
                      } else {
                        final isOrig =
                            _originalProductIds.contains(selectedProductId);
                        final origQty =
                            _originalQuantities[selectedProductId] ?? 0.0;
                        _items.add(_ReceiptItemEntry(
                          productId: selectedProductId!,
                          productName:
                              product['name']?.toString() ?? 'Producto',
                          sku: product['sku']?.toString(),
                          quantityShipped: origQty,
                          isOriginal: isOrig,
                          controller: TextEditingController(
                            text: qty % 1 == 0
                                ? qty.toInt().toString()
                                : qty.toString(),
                          ),
                        ));
                      }
                    });
                    Navigator.pop(ctx);
                  },
                  child: const Text(
                    'Agregar',
                    style: TextStyle(color: EmpireColors.champagneGold),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  bool _hasDiscrepancy() {
    for (final item in _items) {
      final qty = double.tryParse(item.controller.text) ?? 0.0;
      if (qty != item.quantityShipped) {
        return true;
      }
    }
    for (final origId in _originalProductIds) {
      if (!_items.any((i) => i.productId == origId)) {
        return true;
      }
    }
    if (_items.any((i) => !i.isOriginal)) {
      return true;
    }
    return false;
  }

  Future<void> _submitReceipt() async {
    if (_items.isEmpty && _originalProductIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay productos para recibir.')),
      );
      return;
    }

    for (final item in _items) {
      final qty = double.tryParse(item.controller.text);
      if (qty == null || qty < 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Cantidad inválida para ${item.productName}')),
        );
        return;
      }
    }

    final hasDiff = _hasDiscrepancy();
    final noteText = _noteController.text.trim();

    if (hasDiff && noteText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Hay diferencias con el envío original. Registra una nota de diferencia obligatoria.'),
          backgroundColor: EmpireColors.errorRed,
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    final List<Map<String, dynamic>> receivedPayload = [];

    for (final item in _items) {
      final qty = double.tryParse(item.controller.text) ?? 0.0;
      receivedPayload.add({
        'productId': item.productId,
        'quantityReceived': qty,
      });
    }

    for (final origId in _originalProductIds) {
      if (!_items.any((i) => i.productId == origId)) {
        receivedPayload.add({
          'productId': origId,
          'quantityReceived': 0.0,
        });
      }
    }

    final success = await widget.state.receiveTransfer(
      transferId: widget.transfer['id'].toString(),
      items: receivedPayload,
      note: noteText.isNotEmpty ? noteText : null,
    );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (success) {
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'No se pudo registrar la recepción. Revise las cantidades y notas.'),
          backgroundColor: EmpireColors.errorRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final transferFolio =
        widget.transfer['id'].toString().substring(0, 8).toUpperCase();

    return AlertDialog(
      backgroundColor: EmpireColors.onyxSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: EmpireColors.agedBronze),
      ),
      title: Row(
        children: [
          const Icon(Icons.local_shipping_outlined,
              color: EmpireColors.champagneGold, size: 24),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Recibir productos',
                  style: TextStyle(
                      color: EmpireColors.champagneGold,
                      fontSize: 18,
                      fontWeight: FontWeight.bold),
                ),
                Text(
                  'Traspaso #$transferFolio',
                  style: const TextStyle(
                      color: EmpireColors.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
      content: SizedBox(
        width: 500,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Confirma las cantidades recibidas físicamente. Puedes agregar productos adicionales o quitar los no entregados.',
                style:
                    TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Productos (${_items.length})',
                    style: const TextStyle(
                      color: EmpireColors.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _openAddProductSearch,
                    icon: const Icon(Icons.add,
                        size: 18, color: EmpireColors.champagneGold),
                    label: const Text(
                      'Agregar producto',
                      style: TextStyle(
                          color: EmpireColors.champagneGold, fontSize: 13),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              if (_items.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: EmpireColors.charcoalSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: EmpireColors.agedBronze.withValues(alpha: 0.3)),
                  ),
                  child: const Center(
                    child: Text(
                      'No hay productos en la recepción.\nUsa "Agregar producto" para añadir lo recibido.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: EmpireColors.textSecondary, fontSize: 13),
                    ),
                  ),
                )
              else
                ..._items.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final item = entry.value;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: EmpireColors.charcoalSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: !item.isOriginal
                            ? EmpireColors.champagneGold
                                .withValues(alpha: 0.5)
                            : EmpireColors.agedBronze.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.productName,
                                style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                item.isOriginal
                                    ? 'Enviado: ${item.quantityShipped % 1 == 0 ? item.quantityShipped.toInt() : item.quantityShipped}${item.sku != null && item.sku!.isNotEmpty ? ' · ${item.sku}' : ''}'
                                    : 'Producto extra agregado${item.sku != null && item.sku!.isNotEmpty ? ' · ${item.sku}' : ''}',
                                style: TextStyle(
                                  color: item.isOriginal
                                      ? EmpireColors.textSecondary
                                      : EmpireColors.champagneGold,
                                  fontSize: 12,
                                  fontWeight: item.isOriginal
                                      ? FontWeight.normal
                                      : FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 85,
                          child: TextField(
                            controller: item.controller,
                            keyboardType:
                                const TextInputType.numberWithOptions(
                                    decimal: true),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: EmpireColors.textPrimary, fontSize: 14),
                            decoration: const InputDecoration(
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 8),
                              labelText: 'Recibido',
                              labelStyle: TextStyle(
                                  color: EmpireColors.textSecondary,
                                  fontSize: 11),
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: const Icon(Icons.delete_outline,
                              color: EmpireColors.errorRed, size: 20),
                          tooltip: 'Quitar producto',
                          onPressed: () => _removeItem(idx),
                        ),
                      ],
                    ),
                  );
                }),
              const SizedBox(height: 12),
              TextField(
                controller: _noteController,
                maxLines: 2,
                style: const TextStyle(color: EmpireColors.textPrimary),
                decoration: const InputDecoration(
                  labelText:
                      'Nota de diferencia (obligatoria si falta o sobra algo)',
                  labelStyle: TextStyle(
                      color: EmpireColors.textSecondary, fontSize: 13),
                  hintText: 'Ej. Faltaron 2 piezas por merma en transporte...',
                  hintStyle: TextStyle(
                      color: EmpireColors.textSecondary, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: _submitting ? null : _submitReceipt,
          style: ElevatedButton.styleFrom(
            backgroundColor: EmpireColors.champagneGold,
            foregroundColor: EmpireColors.obsidian,
          ),
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: EmpireColors.obsidian),
                )
              : const Text('Aceptar recepción',
                  style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}
