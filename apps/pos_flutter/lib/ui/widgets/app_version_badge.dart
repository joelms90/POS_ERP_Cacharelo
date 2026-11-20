import 'package:flutter/material.dart';
import '../common/colors.dart';

class AppVersionBadge extends StatelessWidget {
  final String version;
  final String? branchName;

  const AppVersionBadge({super.key, required this.version, this.branchName});

  @override
  Widget build(BuildContext context) {
    final normalizedBranchName = branchName?.trim();
    final hasBranchName =
        normalizedBranchName != null && normalizedBranchName.isNotEmpty;
    final semanticLabel = hasBranchName
        ? 'Versión $version, Sucursal $normalizedBranchName'
        : 'Versión $version';

    return Semantics(
      label: semanticLabel,
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 200),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Container(
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
                  if (hasBranchName) ...[
                    const SizedBox(width: 6),
                    Container(
                      width: 1,
                      height: 12,
                      color: EmpireColors.agedBronze.withValues(alpha: 0.5),
                    ),
                    const SizedBox(width: 6),
                    const Icon(
                      Icons.location_on_outlined,
                      size: 13,
                      color: EmpireColors.champagneGold,
                    ),
                    const SizedBox(width: 3),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 120),
                      child: Text(
                        normalizedBranchName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        softWrap: false,
                        style: const TextStyle(
                          color: EmpireColors.textGold,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
