import 'package:flutter/material.dart';
import '../common/colors.dart';

class ZoneTabs extends StatelessWidget {
  final String selectedZone;
  final ValueChanged<String> onZoneChanged;
  final List<String> zones;

  const ZoneTabs({
    super.key,
    required this.selectedZone,
    required this.onZoneChanged,
    this.zones = const ['Salón Principal', 'Terraza', 'Bar'],
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      color: EmpireColors.obsidian,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: zones.map((zone) {
          final isSelected = selectedZone == zone;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: ChoiceChip(
              label: Text(zone.toUpperCase()),
              selected: isSelected,
              onSelected: (selected) {
                if (selected) {
                  onZoneChanged(zone);
                }
              },
              selectedColor: EmpireColors.champagneGold,
              backgroundColor: EmpireColors.onyxSurface,
              labelStyle: TextStyle(
                color: isSelected
                    ? EmpireColors.obsidian
                    : EmpireColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 12,
                letterSpacing: 0.8,
              ),
              side: BorderSide(
                color: isSelected
                    ? EmpireColors.champagneGold
                    : EmpireColors.agedBronzeDark,
                width: 1.2,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
