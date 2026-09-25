import 'package:flutter/material.dart';
import 'dart:convert';
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
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              // Left: Icon or Image representation (square container)
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: EmpireColors.charcoalSurface,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: EmpireColors.agedBronzeDark.withOpacity(0.5),
                    width: 1,
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: _buildImage(item),
                ),
              ),
              const SizedBox(width: 10),

              // Right: Text details & Action
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Item Name
                    Text(
                      item.name,
                      style: const TextStyle(
                        color: EmpireColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),

                    // Price & Add Button Row
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
                            size: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImage(MenuItem item) {
    final path = item.imagePath.trim();
    if (path.isEmpty) {
      return _buildFallbackIcon(item);
    }

    // 1. Data URI or raw Base64 string
    if (path.startsWith('data:image') || (!path.startsWith('/') && !path.startsWith('http') && !path.contains(' '))) {
      try {
        final base64Str = path.contains(',') ? path.split(',').last : path;
        final bytes = base64Decode(base64Str);
        return Image.memory(
          bytes,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => _buildFallbackIcon(item),
        );
      } catch (_) {
        return _buildFallbackIcon(item);
      }
    }

    // 2. Relative web path (/dishes/...) or Network URL
    try {
      final encodedUrl = Uri.encodeFull(path);
      return Image.network(
        encodedUrl,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _buildFallbackIcon(item),
      );
    } catch (_) {
      return _buildFallbackIcon(item);
    }
  }

  Widget _buildFallbackIcon(MenuItem item) {
    return Center(
      child: Icon(
        _getCategoryIcon(item.category),
        color: EmpireColors.champagneGold,
        size: 24,
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
