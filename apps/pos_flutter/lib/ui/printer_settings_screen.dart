import 'package:flutter/material.dart';

class PrinterSettingsScreen extends StatelessWidget {
  const PrinterSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Printers')),
      body: const ListTile(
        title: Text('Thermal printer adapters'),
        subtitle: Text('Windows USB, Android Bluetooth and Android network'),
      ),
    );
  }
}

