import 'package:flutter/material.dart';

class OfflineSaleScreen extends StatelessWidget {
  const OfflineSaleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('POS Offline')),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Offline sale mode'),
            SizedBox(height: 8),
            Text('Cash sales can be confirmed locally and synced later.'),
          ],
        ),
      ),
    );
  }
}

