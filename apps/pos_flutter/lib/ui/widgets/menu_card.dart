import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';

class MenuCard extends StatelessWidget {
  final MenuItem item;
  final VoidCallback onTap;

  const MenuCard({super.key, required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: EmpireColors.onyxSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: const BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Icon representation by category
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: EmpireColors.charcoalSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: EmpireColors.agedBronzeDark.withOpacity(0.5),
                      width: 1,
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      _getCategoryIcon(item.category),
                      color: EmpireColors.champagneGold,
                      size: 28,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Item Name
              Text(
                item.name,
                style: const TextStyle(
                  color: EmpireColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),

              // Item Price & Add indicator
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '\$${item.price.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: EmpireColors.textGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: EmpireColors.champagneGold,
                    ),
                    child: const Icon(
                      Icons.add,
                      color: EmpireColors.obsidian,
                      size: 14,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'pastas':
        return Icons.dinner_dining;
      case 'hamburguesas':
        return Icons.lunch_dining;
      case 'postres':
        return Icons.cake;
      case 'bebidas':
        return Icons.local_bar;
      default:
        return Icons.restaurant;
    }
  }
}
