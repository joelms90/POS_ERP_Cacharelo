/// Display label for a product unit of measure, matching the admin web
/// (`UOM_LABELS`). The API sends the raw value (e.g. `piece`, the default).
String uomLabel(dynamic raw) {
  final value = raw?.toString().trim().toLowerCase() ?? '';
  const labels = {
    'piece': 'pza',
    'pieza': 'pza',
    'pza': 'pza',
    'pack': 'paq',
    'kg': 'kg',
    'g': 'g',
    'l': 'l',
    'ml': 'ml',
  };
  if (value.isEmpty) return 'pza';
  return labels[value] ?? value;
}
