import 'package:flutter/material.dart';

import 'ui/offline_sale_screen.dart';

void main() {
  runApp(const PosErpApp());
}

class PosErpApp extends StatelessWidget {
  const PosErpApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS ERP',
      theme: ThemeData(useMaterial3: true),
      home: const OfflineSaleScreen(),
    );
  }
}

