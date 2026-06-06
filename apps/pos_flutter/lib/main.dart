import 'package:flutter/material.dart';
import 'ui/common/app_state.dart';
import 'ui/common/theme.dart';
import 'ui/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize AppState in-memory state manager
  final appState = AppState();
  
  runApp(MyApp(state: appState));
}

class MyApp extends StatelessWidget {
  final AppState state;

  const MyApp({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Empire POS & ERP',
      debugShowCheckedModeBanner: false,
      theme: EmpireTheme.darkTheme,
      home: LoginScreen(state: state),
    );
  }
}
