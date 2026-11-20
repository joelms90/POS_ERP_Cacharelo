import 'package:flutter/material.dart';
import 'services/remote_logger.dart';
import 'ui/common/app_state.dart';
import 'ui/common/theme.dart';
import 'ui/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize AppState in-memory state manager
  final appState = AppState();

  // Production diagnostics: errors are tagged with the terminal's branch,
  // operator and device so they can be triaged per sucursal.
  RemoteLogger.instance
    ..apiUrlProvider = (() => appState.terminalApiUrl ?? configuredDefaultApiUrl)
    ..contextProvider = () => {
          'businessId': appState.terminalBusinessId,
          'branchId': appState.terminalBranchId,
          'branchName': appState.terminalBranchName,
          'userId': appState.currentUserId,
          'userName': appState.currentUserName.isEmpty ? null : appState.currentUserName,
          'userRole': appState.currentUserRole.name,
          'deviceId': appState.deviceId,
          'appVersion': appState.appVersion,
        };
  RemoteLogger.instance.install();

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
