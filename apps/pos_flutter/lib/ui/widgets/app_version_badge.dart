import 'package:flutter/material.dart';
import '../common/colors.dart';

class AppVersionBadge extends StatelessWidget {
  final String version;

  const AppVersionBadge({
    super.key,
    required this.version,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: EmpireColors.charcoalSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: EmpireColors.agedBronze.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.verified,
            size: 11,
            color: EmpireColors.champagneGold,
          ),
          const SizedBox(width: 4),
          Text(
            version,
            style: const TextStyle(
              color: EmpireColors.textGold,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
