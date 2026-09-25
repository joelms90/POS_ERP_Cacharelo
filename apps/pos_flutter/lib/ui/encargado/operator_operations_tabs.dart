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
    if (mounted)
      setState(() {
        _transfers = transfers;
        _loading = false;
      });
  }

  Future<void> _receive(Map<String, dynamic> transfer) async {
    final detail = await widget.state.fetchTransfer(transfer['id'].toString());
    if (!mounted || detail == null) return;
    final items = (detail['items'] as List? ?? const [])
        .map((raw) => Map<String, dynamic>.from(raw as Map))
        .toList();
    final note = TextEditingController();
    final quantities = <String, TextEditingController>{
      for (final item in items)
        item['productId'].toString():
            TextEditingController(text: item['quantity'].toString()),
    };
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: EmpireColors.onyxSurface,
        title: const Text('Recibir productos',
            style: TextStyle(color: EmpireColors.champagneGold)),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text(
                  'Confirma la cantidad realmente recibida. Si hay diferencia, agrega una nota.',
                  style: TextStyle(color: EmpireColors.textSecondary)),
              const SizedBox(height: 12),
              ...items.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: TextField(
                      controller: quantities[item['productId'].toString()],
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: EmpireColors.textPrimary),
                      decoration: InputDecoration(
                          labelText:
                              '${item['productName'] ?? 'Producto'} (enviado: ${item['quantity']})'),
                    ),
                  )),
              TextField(
                controller: note,
                maxLines: 2,
                style: const TextStyle(color: EmpireColors.textPrimary),
                decoration: const InputDecoration(
                    labelText:
                        'Nota de diferencia (obligatoria si falta algo)'),
              ),
            ]),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Aceptar recepción',
                  style: TextStyle(color: EmpireColors.champagneGold))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final received = items
        .map((item) => {
              'productId': item['productId'],
              'quantityReceived': double.tryParse(
                      quantities[item['productId'].toString()]!.text) ??
                  -1,
            })
        .toList();
    final success = await widget.state.receiveTransfer(
        transferId: transfer['id'].toString(),
        items: received,
        note: note.text);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(success
            ? 'Recepción registrada.'
            : 'No se pudo registrar. Revise cantidades y nota.')));
    if (success) _refresh();
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
