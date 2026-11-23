import 'package:flutter/material.dart';

import '../common/app_state.dart';
import '../common/colors.dart';

/// Who is looking at the cash approvals.
enum ApprovalsViewMode {
  /// Operador integral de sucursal: resolves N1 of the branch's cashiers and
  /// sees every corte of the branch.
  operator,

  /// Cajero: sees the review state of their own cortes and recounts rejections.
  cashier,
}

/// Spec 019 — "Por aprobar" (OIS) and "Mis cortes" (cajero).
///
/// The server decides every permission (`canAct`); this view never approves
/// locally and requires a connection.
class PendingApprovalsView extends StatefulWidget {
  final AppState state;
  final ApprovalsViewMode mode;

  /// Compact mode renders nothing while there is nothing to show (cashier panel).
  final bool compact;

  const PendingApprovalsView({
    super.key,
    required this.state,
    this.mode = ApprovalsViewMode.operator,
    this.compact = false,
  });

  @override
  State<PendingApprovalsView> createState() => _PendingApprovalsViewState();
}

class _PendingApprovalsViewState extends State<PendingApprovalsView> {
  bool _loading = false;
  List<Map<String, dynamic>> _cortes = [];
  List<Map<String, dynamic>> _movements = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    final result = await widget.state.fetchCashApprovals();
    if (!mounted) return;
    setState(() {
      _loading = false;
      _cortes = result?['cortes'] ?? [];
      _movements = result?['movements'] ?? [];
    });
  }

  String? get _me => widget.state.currentUserId;

  double _money(dynamic value) =>
      double.tryParse(value?.toString() ?? '') ?? 0.0;

  String _fmt(dynamic value) => '\$${_money(value).toStringAsFixed(2)}';

  bool _isRejected(Map<String, dynamic> corte) =>
      corte['reviewStatus'] == 'rechazado_n1' ||
      corte['reviewStatus'] == 'rechazado_n2';

  /// Who may record a recount (the server enforces the same rule).
  bool _canRecount(Map<String, dynamic> corte) {
    final author = corte['closedBy'] ?? corte['cashierId'];
    if (corte['reviewStatus'] == 'rechazado_n1') return author == _me;
    if (corte['reviewStatus'] == 'rechazado_n2') {
      return corte['cashierId'] == _me ||
          widget.mode == ApprovalsViewMode.operator;
    }
    return false;
  }

  List<Map<String, dynamic>> get _actionableCortes =>
      _cortes.where((c) => c['canAct'] == true && !_isRejected(c)).toList();

  List<Map<String, dynamic>> get _actionableMovements =>
      _movements.where((m) => m['canAct'] == true).toList();

  List<Map<String, dynamic>> get _recountCortes =>
      _cortes.where((c) => _isRejected(c) && _canRecount(c)).toList();

  List<Map<String, dynamic>> get _statusCortes {
    final shown = {
      ..._actionableCortes.map((c) => c['id']),
      ..._recountCortes.map((c) => c['id']),
    };
    return _cortes.where((c) {
      if (shown.contains(c['id'])) return false;
      if (widget.mode == ApprovalsViewMode.cashier) {
        return c['cashierId'] == _me || c['closedBy'] == _me;
      }
      return true;
    }).toList();
  }

  List<Map<String, dynamic>> get _myPendingMovements => _movements
      .where((m) => m['createdBy'] == _me && m['canAct'] != true)
      .toList();

  Future<void> _resolve({
    required String kind,
    required Map<String, dynamic> item,
    required bool approve,
  }) async {
    final reason = await _askReason(
      title: approve
          ? (kind == 'corte'
              ? 'Aprobar Corte Z (nivel 1)'
              : 'Aprobar movimiento')
          : (kind == 'corte' ? 'Rechazar Corte Z' : 'Rechazar movimiento'),
      impact: approve
          ? (kind == 'corte'
              ? 'El Corte Z pasará al supervisor (nivel 2). Si bloqueaba la apertura de caja, la sucursal podrá abrir el siguiente turno.'
              : 'El movimiento queda aprobado; ya cuenta en caja desde que se registró.')
          : (kind == 'corte'
              ? 'Quien hizo el Corte Z deberá recontar. La apertura del siguiente turno seguirá bloqueada mientras tanto.'
              : 'Se registrará un asiento de reverso: el movimiento deja de contar y, si el dinero sí salió, aparecerá como faltante en el Corte Z.'),
      required: !approve,
    );
    if (reason == null) return;
    final ok = await widget.state.resolveCashApproval(
      kind: kind,
      id: item['id'].toString(),
      version: (item['version'] as num?)?.toInt() ?? 1,
      approve: approve,
      reason: reason,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: ok ? EmpireColors.successGreen : EmpireColors.errorRed,
      content: Text(ok
          ? (approve ? 'Aprobado.' : 'Rechazado.')
          : (widget.state.lastApprovalError ?? 'No se pudo registrar.')),
    ));
    await _load();
  }

  Future<String?> _askReason({
    required String title,
    required String impact,
    required bool required,
  }) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final valid = !required || controller.text.trim().length >= 3;
          return AlertDialog(
            backgroundColor: EmpireColors.obsidian,
            title: Text(title,
                style: const TextStyle(color: EmpireColors.champagneGold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(impact,
                    style: const TextStyle(color: EmpireColors.textPrimary)),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  maxLength: 500,
                  maxLines: 2,
                  onChanged: (_) => setDialogState(() {}),
                  style: const TextStyle(color: EmpireColors.textPrimary),
                  decoration: InputDecoration(
                    labelText:
                        required ? 'Motivo (obligatorio)' : 'Motivo (opcional)',
                    labelStyle:
                        const TextStyle(color: EmpireColors.textSecondary),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('CANCELAR'),
              ),
              ElevatedButton(
                onPressed: valid
                    ? () => Navigator.of(context).pop(controller.text.trim())
                    : null,
                child: const Text('CONFIRMAR'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _recount(Map<String, dynamic> corte) async {
    final amountController = TextEditingController();
    final notesController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          final amount = double.tryParse(amountController.text.trim());
          return AlertDialog(
            backgroundColor: EmpireColors.obsidian,
            title: const Text('Recontar Corte Z',
                style: TextStyle(color: EmpireColors.champagneGold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  corte['reviewStatus'] == 'rechazado_n2'
                      ? 'El nuevo conteo regresa directo al supervisor (nivel 2).'
                      : 'El nuevo conteo regresa al operador de sucursal (nivel 1).',
                  style: const TextStyle(color: EmpireColors.textPrimary),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => setDialogState(() {}),
                  style: const TextStyle(color: EmpireColors.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Efectivo contado',
                    labelStyle: TextStyle(color: EmpireColors.textSecondary),
                  ),
                ),
                TextField(
                  controller: notesController,
                  maxLength: 500,
                  style: const TextStyle(color: EmpireColors.textPrimary),
                  decoration: const InputDecoration(
                    labelText: 'Notas',
                    labelStyle: TextStyle(color: EmpireColors.textSecondary),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('CANCELAR'),
              ),
              ElevatedButton(
                onPressed: amount != null && amount >= 0
                    ? () => Navigator.of(context).pop(true)
                    : null,
                child: const Text('ENVIAR RECONTEO'),
              ),
            ],
          );
        },
      ),
    );
    if (confirmed != true) return;
    final ok = await widget.state.recountShift(
      corte['id'].toString(),
      double.parse(amountController.text.trim()),
      notes: notesController.text,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: ok ? EmpireColors.successGreen : EmpireColors.errorRed,
      content: Text(ok
          ? 'Reconteo enviado.'
          : (widget.state.lastApprovalError ?? 'No se pudo enviar.')),
    ));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final isOperator = widget.mode == ApprovalsViewMode.operator;
    final sections = <Widget?>[
      if (isOperator)
        _section(
          'Cortes Z por aprobar',
          _actionableCortes.map((c) => _corteCard(c, actions: true)).toList(),
          empty: 'No hay Cortes Z pendientes de tu aprobación.',
        ),
      if (isOperator)
        _section(
          'Ingresos / egresos por aprobar',
          _actionableMovements.map(_movementCard).toList(),
          empty: 'No hay movimientos pendientes de tu aprobación.',
        ),
      if (_recountCortes.isNotEmpty || isOperator)
        _section(
          'Cortes por recontar',
          _recountCortes.map((c) => _corteCard(c, recount: true)).toList(),
          empty: 'No hay cortes rechazados.',
        ),
      if (_statusCortes.isNotEmpty)
        _section(
          isOperator
              ? 'Cortes de la sucursal en revisión'
              : 'Mis cortes en revisión',
          _statusCortes.map((c) => _corteCard(c)).toList(),
        ),
      if (!isOperator && _myPendingMovements.isNotEmpty)
        _section(
          'Mis movimientos pendientes',
          _myPendingMovements.map(_movementCard).toList(),
        ),
    ].whereType<Widget>().toList();

    final rejectedOffline = widget.state.rejectedCashJobs;
    if (widget.compact &&
        rejectedOffline.isEmpty &&
        _recountCortes.isEmpty &&
        _statusCortes.isEmpty &&
        _myPendingMovements.isEmpty) {
      return const SizedBox.shrink();
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        shrinkWrap: widget.compact,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  isOperator ? 'Por aprobar' : 'Mis cortes de caja',
                  style: const TextStyle(
                    color: EmpireColors.champagneGold,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (_loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                IconButton(
                  tooltip: 'Actualizar',
                  icon: const Icon(Icons.refresh,
                      color: EmpireColors.champagneGold),
                  onPressed: _load,
                ),
            ],
          ),
          if (widget.state.lastApprovalError != null && !_loading)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                widget.state.lastApprovalError!,
                style: const TextStyle(color: EmpireColors.errorRed),
              ),
            ),
          if (rejectedOffline.isNotEmpty)
            _rejectedOfflineBanner(rejectedOffline),
          ...sections,
        ],
      ),
    );
  }

  /// D-5: operations saved without connection that the server rejected.
  Widget _rejectedOfflineBanner(List<Map<String, dynamic>> jobs) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.errorRed.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EmpireColors.errorRed),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Operaciones sin conexión rechazadas por el servidor',
            style: TextStyle(
                color: EmpireColors.errorRed, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          ...jobs.map((job) {
            final payload =
                job['payload'] is Map ? job['payload'] as Map : const {};
            final what = job['kind'] == 'close'
                ? 'Corte Z'
                : '${payload['type'] == 'cash-in' ? 'Ingreso' : 'Retiro'} de ${_fmt(payload['amount'])}';
            return Text('• $what: ${job['error'] ?? ''}',
                style: const TextStyle(color: EmpireColors.textPrimary));
          }),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () async {
                await widget.state.dismissRejectedCashJobs();
                if (mounted) setState(() {});
              },
              child: const Text('ENTENDIDO'),
            ),
          ),
        ],
      ),
    );
  }

  Widget? _section(String title, List<Widget> children, {String? empty}) {
    if (children.isEmpty && empty == null) return null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: EmpireColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          if (children.isEmpty)
            Text(empty!,
                style: const TextStyle(
                    color: EmpireColors.textSecondary,
                    fontStyle: FontStyle.italic))
          else
            ...children,
        ],
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color),
      ),
      child: Text(label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Color _reviewColor(String? status) {
    switch (status) {
      case 'aprobado':
      case 'aprobado_con_ajuste':
        return EmpireColors.successGreen;
      case 'rechazado_n1':
      case 'rechazado_n2':
        return EmpireColors.errorRed;
      default:
        return EmpireColors.champagneGold;
    }
  }

  Widget _corteCard(Map<String, dynamic> corte,
      {bool actions = false, bool recount = false}) {
    final status = corte['reviewStatus']?.toString();
    final difference = corte['cashDifference'];
    final closedAt = DateTime.tryParse(corte['closedAt']?.toString() ?? '');
    return Card(
      color: EmpireColors.charcoalSurface,
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  corte['cashierName']?.toString() ?? 'Cajero',
                  style: const TextStyle(
                      color: EmpireColors.textPrimary,
                      fontWeight: FontWeight.bold),
                ),
                _statusChip(
                    AppState.shiftReviewLabel(status), _reviewColor(status)),
                if (corte['openBlocking'] == true)
                  _statusChip('Bloquea apertura', EmpireColors.errorRed),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Contado ${_fmt(corte['counted'])} · Diferencia ${difference == null ? '—' : _fmt(difference)}'
              '${closedAt == null ? '' : ' · ${closedAt.toLocal().toString().substring(0, 16)}'}',
              style: const TextStyle(color: EmpireColors.textSecondary),
            ),
            if (actions || (recount && _canRecount(corte)))
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(
                  spacing: 8,
                  children: [
                    if (actions) ...[
                      ElevatedButton(
                        onPressed: () =>
                            _resolve(kind: 'corte', item: corte, approve: true),
                        child: const Text('APROBAR'),
                      ),
                      OutlinedButton(
                        onPressed: () => _resolve(
                            kind: 'corte', item: corte, approve: false),
                        child: const Text('RECHAZAR'),
                      ),
                    ],
                    if (recount)
                      ElevatedButton.icon(
                        onPressed: () => _recount(corte),
                        icon: const Icon(Icons.calculate_outlined, size: 16),
                        label: const Text('RECONTAR'),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _movementCard(Map<String, dynamic> movement) {
    final isIn = movement['type'] == 'cash-in';
    final canAct =
        movement['canAct'] == true && widget.mode == ApprovalsViewMode.operator;
    return Card(
      color: EmpireColors.charcoalSurface,
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  '${isIn ? '+' : '−'}${_fmt(movement['amount'])}',
                  style: TextStyle(
                    color: isIn
                        ? EmpireColors.successGreen
                        : EmpireColors.errorRed,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                _statusChip(
                    AppState.movementStatusLabel(
                        movement['approvalStatus']?.toString()),
                    EmpireColors.champagneGold),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${movement['authorName'] ?? 'Operador'} · ${movement['reason'] ?? ''}',
              style: const TextStyle(color: EmpireColors.textSecondary),
            ),
            if (canAct)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(
                  spacing: 8,
                  children: [
                    ElevatedButton(
                      onPressed: () => _resolve(
                          kind: 'movement', item: movement, approve: true),
                      child: const Text('APROBAR'),
                    ),
                    OutlinedButton(
                      onPressed: () => _resolve(
                          kind: 'movement', item: movement, approve: false),
                      child: const Text('RECHAZAR'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
