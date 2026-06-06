import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class TableNode extends StatefulWidget {
  final TableModel table;
  final VoidCallback onTap;

  const TableNode({
    super.key,
    required this.table,
    required this.onTap,
  });

  @override
  State<TableNode> createState() => _TableNodeState();
}

class _TableNodeState extends State<TableNode> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    
    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(
        parent: _pulseController,
        curve: Curves.easeInOut,
      ),
    );

    if (widget.table.state == TableState.billing) {
      _pulseController.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(covariant TableNode oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.table.state == TableState.billing) {
      if (!_pulseController.isAnimating) {
        _pulseController.repeat(reverse: true);
      }
    } else {
      _pulseController.stop();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stateColors = {
      TableState.free: Colors.transparent,
      TableState.occupied: EmpireColors.champagneGold,
      TableState.billing: EmpireColors.champagneGold,
      TableState.cleaning: EmpireColors.cleaningGrey.withOpacity(0.3),
    };

    final borderColors = {
      TableState.free: EmpireColors.agedBronze,
      TableState.occupied: EmpireColors.champagneGold,
      TableState.billing: EmpireColors.textGold,
      TableState.cleaning: EmpireColors.cleaningGrey,
    };

    final isCircle = widget.table.shape == TableShape.circle;
    final stateColor = stateColors[widget.table.state]!;
    final borderColor = borderColors[widget.table.state]!;

    Widget tableContainer = Container(
      width: 85,
      height: 85,
      decoration: BoxDecoration(
        shape: isCircle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: isCircle ? null : BorderRadius.circular(10),
        color: widget.table.state == TableState.occupied ? stateColor.withOpacity(0.2) : stateColor,
        border: Border.all(
          color: borderColor,
          width: widget.table.state == TableState.billing ? 2.5 : 1.5,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            _getStateIcon(widget.table.state),
            size: 18,
            color: _getStateTextColor(widget.table.state),
          ),
          const SizedBox(height: 4),
          Text(
            widget.table.label,
            style: TextStyle(
              color: _getStateTextColor(widget.table.state),
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
          if (widget.table.guests > 0) ...[
            const SizedBox(height: 2),
            Text(
              '${widget.table.guests} pax',
              style: TextStyle(
                color: _getStateTextColor(widget.table.state).withOpacity(0.8),
                fontSize: 9,
              ),
            ),
          ],
        ],
      ),
    );

    // If table needs billing, render glowing pulse
    if (widget.table.state == TableState.billing) {
      return ScaleTransition(
        scale: _pulseAnimation,
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: BorderRadius.circular(isCircle ? 50 : 10),
          child: tableContainer,
        ),
      );
    }

    return InkWell(
      onTap: widget.onTap,
      borderRadius: BorderRadius.circular(isCircle ? 50 : 10),
      child: tableContainer,
    );
  }

  IconData _getStateIcon(TableState state) {
    switch (state) {
      case TableState.free:
        return Icons.table_restaurant_outlined;
      case TableState.occupied:
        return Icons.person;
      case TableState.billing:
        return Icons.receipt_long;
      case TableState.cleaning:
        return Icons.cleaning_services_outlined;
    }
  }

  Color _getStateTextColor(TableState state) {
    switch (state) {
      case TableState.free:
        return EmpireColors.textPrimary;
      case TableState.occupied:
        return EmpireColors.champagneGold;
      case TableState.billing:
        return EmpireColors.textGold;
      case TableState.cleaning:
        return EmpireColors.textSecondary;
    }
  }
}
