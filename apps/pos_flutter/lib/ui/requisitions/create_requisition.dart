import 'dart:math';
import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import '../../models/local_requisition.dart';

// Standalone compliants UUID v4 generator
String generateUuidV4() {
  final random = Random.secure();
  final hexDigits = '0123456789abcdef';
  final charCodes = List<int>.generate(36, (index) {
    if (index == 8 || index == 13 || index == 18 || index == 23) {
      return 45; // '-'
    }
    if (index == 14) {
      return 52; // '4'
    }
    final randVal = random.nextInt(16);
    if (index == 19) {
      return hexDigits.codeUnitAt((randVal & 0x3) | 0x8);
    }
    return hexDigits.codeUnitAt(randVal);
  });
  return String.fromCharCodes(charCodes);
}

class RequisitionsScreen extends StatefulWidget {
  final AppState state;

  const RequisitionsScreen({super.key, required this.state});

  @override
  State<RequisitionsScreen> createState() => _RequisitionsScreenState();
}

class _RequisitionsScreenState extends State<RequisitionsScreen> {
  List<LocalBranchRequisition> _requisitions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRequisitions();
  }

  Future<void> _loadRequisitions() async {
    setState(() => _loading = true);
    try {
      final rawList = await widget.state.secureStorageService.getPendingRequisitions();
      setState(() {
        _requisitions = rawList.map((m) => LocalBranchRequisition.fromMap(m)).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      });
    } catch (e) {
      debugPrint('Error loading local requisitions: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _navigateToCreate() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateRequisitionScreen(state: widget.state),
      ),
    );
    if (result == true) {
      _loadRequisitions();
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'approved':
        return EmpireColors.successGreen;
      case 'rejected':
        return EmpireColors.errorRed;
      case 'standby':
        return EmpireColors.warningOrange;
      default:
        return EmpireColors.textSecondary;
    }
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      case 'standby':
        return 'En Espera';
      case 'pending_approval':
      default:
        return 'Pendiente';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: EmpireColors.champagneGold),
            )
          : _requisitions.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.description_outlined,
                        size: 64,
                        color: Colors.grey[600],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Sin Requisiciones',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.grey[400],
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Presione el botón + para solicitar insumos.',
                        style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _requisitions.length,
                  itemBuilder: (context, index) {
                    final req = _requisitions[index];
                    final dateStr =
                        '${req.createdAt.day}/${req.createdAt.month}/${req.createdAt.year} ${req.createdAt.hour.toString().padLeft(2, '0')}:${req.createdAt.minute.toString().padLeft(2, '0')}';
                    
                    return Card(
                      color: EmpireColors.onyxSurface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(
                          color: EmpireColors.agedBronze.withOpacity(0.3),
                          width: 1,
                        ),
                      ),
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'ID: ${req.id.substring(0, 8).toUpperCase()}',
                                  style: const TextStyle(
                                    color: EmpireColors.champagneGold,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _getStatusColor(req.status).withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: _getStatusColor(req.status).withOpacity(0.4),
                                    ),
                                  ),
                                  child: Text(
                                    _getStatusLabel(req.status),
                                    style: TextStyle(
                                      color: _getStatusColor(req.status),
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Fecha: $dateStr',
                              style: const TextStyle(
                                color: EmpireColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            if (req.notes != null && req.notes!.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                'Notas: ${req.notes}',
                                style: const TextStyle(
                                  color: EmpireColors.textPrimary,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                            const Divider(
                              color: EmpireColors.charcoalSurface,
                              height: 24,
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${req.items.length} Insumos solicitados',
                                  style: const TextStyle(
                                    color: EmpireColors.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: req.syncState == 'synced'
                                        ? Colors.green.withOpacity(0.1)
                                        : req.syncState == 'failed'
                                            ? Colors.red.withOpacity(0.1)
                                            : Colors.orange.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    req.syncState == 'synced'
                                        ? 'Sincronizado'
                                        : req.syncState == 'failed'
                                            ? 'Error de Sinc.'
                                            : 'Pendiente de Sinc.',
                                    style: TextStyle(
                                      color: req.syncState == 'synced'
                                          ? Colors.green
                                          : req.syncState == 'failed'
                                              ? Colors.red
                                              : Colors.orange,
                                      fontSize: 11,
                                    ),
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
      floatingActionButton: FloatingActionButton(
        onPressed: _navigateToCreate,
        backgroundColor: EmpireColors.champagneGold,
        foregroundColor: EmpireColors.obsidian,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class CreateRequisitionScreen extends StatefulWidget {
  final AppState state;

  const CreateRequisitionScreen({super.key, required this.state});

  @override
  State<CreateRequisitionScreen> createState() => _CreateRequisitionScreenState();
}

class _CreateRequisitionScreenState extends State<CreateRequisitionScreen> {
  final TextEditingController _notesController = TextEditingController();
  String? _selectedWarehouseId;
  final List<Map<String, dynamic>> _selectedItems = [];

  @override
  void initState() {
    super.initState();
    if (widget.state.cachedWarehouses.isNotEmpty) {
      _selectedWarehouseId = widget.state.cachedWarehouses.first['id'];
    }
  }

  void _showAddProductDialog() {
    if (widget.state.cachedIngredients.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No hay insumos/ingredientes disponibles. Por favor, sincronice.'),
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (context) {
        String? localProductId = widget.state.cachedIngredients.first['id'];
        final qtyController = TextEditingController(text: '1.0');

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: EmpireColors.onyxSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: EmpireColors.agedBronze),
              ),
              title: const Text(
                'Agregar Insumo',
                style: TextStyle(color: EmpireColors.champagneGold, fontSize: 16),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    dropdownColor: EmpireColors.onyxSurface,
                    value: localProductId,
                    decoration: const InputDecoration(
                      labelText: 'Seleccione Insumo',
                      labelStyle: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: EmpireColors.agedBronze),
                      ),
                    ),
                    style: const TextStyle(color: EmpireColors.textPrimary),
                    items: widget.state.cachedIngredients.map((item) {
                      return DropdownMenuItem<String>(
                        value: item['id'],
                        child: Text(
                          item['name'],
                          style: const TextStyle(fontSize: 13),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setDialogState(() {
                        localProductId = val;
                      });
                    },
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: qtyController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(color: EmpireColors.textPrimary),
                    decoration: const InputDecoration(
                      labelText: 'Cantidad Solicitada',
                      labelStyle: TextStyle(color: EmpireColors.textSecondary, fontSize: 13),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: EmpireColors.agedBronze),
                      ),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
                ),
                TextButton(
                  onPressed: () {
                    final qty = double.tryParse(qtyController.text) ?? 0.0;
                    if (qty <= 0.0) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Ingrese una cantidad válida mayor a 0')),
                      );
                      return;
                    }
                    final prod = widget.state.cachedIngredients.firstWhere((p) => p['id'] == localProductId);
                    
                    // Check if already added
                    final alreadyIndex = _selectedItems.indexWhere((i) => i['productId'] == localProductId);
                    setState(() {
                      if (alreadyIndex != -1) {
                        _selectedItems[alreadyIndex]['quantityRequested'] += qty;
                      } else {
                        _selectedItems.add({
                          'productId': localProductId,
                          'name': prod['name'],
                          'quantityRequested': qty,
                        });
                      }
                    });
                    Navigator.pop(context);
                  },
                  child: const Text('Agregar', style: TextStyle(color: EmpireColors.champagneGold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _saveRequisition() async {
    if (widget.state.terminalBranchId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('La terminal no tiene una sucursal configurada')),
      );
      return;
    }
    if (_selectedWarehouseId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Seleccione una bodega de destino')),
      );
      return;
    }
    if (_selectedItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agregue al menos un insumo a la requisición')),
      );
      return;
    }

    final requisitionId = generateUuidV4();
    final localItems = _selectedItems.map((item) {
      return LocalBranchRequisitionItem(
        id: generateUuidV4(),
        requisitionId: requisitionId,
        productId: item['productId'],
        quantityRequested: item['quantityRequested'],
      );
    }).toList();

    final requisition = LocalBranchRequisition(
      id: requisitionId,
      fromBranchId: widget.state.terminalBranchId!,
      toWarehouseId: _selectedWarehouseId!,
      status: 'pending_approval',
      notes: _notesController.text,
      createdAt: DateTime.now(),
      syncState: 'pending',
      items: localItems,
    );

    try {
      final existingRaw = await widget.state.secureStorageService.getPendingRequisitions();
      final updatedList = List<Map<String, dynamic>>.from(existingRaw);
      updatedList.add(requisition.toMap());

      await widget.state.secureStorageService.savePendingRequisitions(updatedList);
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Requisición guardada localmente')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al guardar: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EmpireColors.obsidian,
      appBar: AppBar(
        backgroundColor: EmpireColors.champagneGold,
        title: const Text('Nueva Requisición', style: TextStyle(fontWeight: FontWeight.bold)),
        foregroundColor: EmpireColors.obsidian,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Warehouse Selection
            const Text(
              'Bodega Destino',
              style: TextStyle(
                color: EmpireColors.champagneGold,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: EmpireColors.onyxSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: EmpireColors.agedBronze.withOpacity(0.5)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  dropdownColor: EmpireColors.onyxSurface,
                  value: _selectedWarehouseId,
                  isExpanded: true,
                  style: const TextStyle(color: EmpireColors.textPrimary),
                  hint: const Text('Seleccionar bodega...', style: TextStyle(color: Colors.grey)),
                  items: widget.state.cachedWarehouses.map((wh) {
                    return DropdownMenuItem<String>(
                      value: wh['id'],
                      child: Text(wh['name']),
                    );
                  }).toList(),
                  onChanged: (val) {
                    setState(() {
                      _selectedWarehouseId = val;
                    });
                  },
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Products Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Insumos Solicitados',
                  style: TextStyle(
                    color: EmpireColors.champagneGold,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                TextButton.icon(
                  onPressed: _showAddProductDialog,
                  icon: const Icon(Icons.add, color: EmpireColors.champagneGold, size: 18),
                  label: const Text(
                    'Agregar',
                    style: TextStyle(color: EmpireColors.champagneGold, fontSize: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _selectedItems.isEmpty
                ? Container(
                    padding: const EdgeInsets.all(24),
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: EmpireColors.onyxSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: EmpireColors.charcoalSurface),
                    ),
                    child: const Center(
                      child: Text(
                        'Agregue insumos usando el botón de agregar.',
                        style: TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    ),
                  )
                : Container(
                    decoration: BoxDecoration(
                      color: EmpireColors.onyxSurface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: EmpireColors.charcoalSurface),
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _selectedItems.length,
                      separatorBuilder: (context, index) =>
                          const Divider(color: EmpireColors.charcoalSurface, height: 1),
                      itemBuilder: (context, index) {
                        final item = _selectedItems[index];
                        return ListTile(
                          title: Text(
                            item['name'],
                            style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '${item['quantityRequested']}',
                                style: const TextStyle(
                                  color: EmpireColors.champagneGold,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(width: 12),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: EmpireColors.errorRed),
                                onPressed: () {
                                  setState(() {
                                    _selectedItems.removeAt(index);
                                  });
                                },
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
            const SizedBox(height: 20),

            // Notes Section
            const Text(
              'Notas / Comentarios',
              style: TextStyle(
                color: EmpireColors.champagneGold,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _notesController,
              maxLines: 3,
              style: const TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: EmpireColors.onyxSurface,
                hintText: 'Ingrese observaciones adicionales sobre este pedido...',
                hintStyle: const TextStyle(color: Colors.grey, fontSize: 12),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: EmpireColors.agedBronze.withOpacity(0.5)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: EmpireColors.champagneGold),
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _saveRequisition,
                style: ElevatedButton.styleFrom(
                  backgroundColor: EmpireColors.champagneGold,
                  foregroundColor: EmpireColors.obsidian,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'Enviar Requisición',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
