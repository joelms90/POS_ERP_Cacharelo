import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

enum SocketConnectionState {
  disconnected,
  connecting,
  connected,
  degradedRest,
}

class SyncSocketService {
  WebSocketChannel? _channel;
  SocketConnectionState _state = SocketConnectionState.disconnected;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;
  DateTime? _lastPongReceived;
  int _reconnectDelaySeconds = 1;
  
  final String apiUrl;
  final String token;
  final String branchId;
  final String role;
  
  // Callbacks for events
  final Function(Map<String, dynamic> changePayload) onBroadcastChangeReceived;
  final Function(List<dynamic> changes, String serverTime) onResyncChangesReceived;
  final Function(String clientUuid, String versionEn) onAckReceived;
  final Function(SocketConnectionState state) onStateChanged;

  SyncSocketService({
    required this.apiUrl,
    required this.token,
    required this.branchId,
    required this.role,
    required this.onBroadcastChangeReceived,
    required this.onResyncChangesReceived,
    required this.onAckReceived,
    required this.onStateChanged,
  });

  SocketConnectionState get state => _state;

  void _updateState(SocketConnectionState newState) {
    if (_state != newState) {
      _state = newState;
      onStateChanged(_state);
    }
  }

  String _buildWsUrl() {
    // API URL usually looks like: https://hostname/api
    // We want: wss://hostname/sync?token=...&branchId=...&role=...
    String wsUrl = apiUrl.trim();
    
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replaceFirst('https://', 'wss://');
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replaceFirst('http://', 'ws://');
    } else {
      wsUrl = 'wss://$wsUrl';
    }

    if (wsUrl.endsWith('/api')) {
      wsUrl = wsUrl.substring(0, wsUrl.length - 4);
    }
    if (wsUrl.endsWith('/')) {
      wsUrl = wsUrl.substring(0, wsUrl.length - 1);
    }

    wsUrl = '$wsUrl/sync?token=$token&branchId=$branchId&role=$role';
    return wsUrl;
  }

  void connect() {
    if (_state == SocketConnectionState.connected || _state == SocketConnectionState.connecting) {
      return;
    }

    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel();
    _updateState(SocketConnectionState.connecting);
    final wsUrl = _buildWsUrl();
    debugPrint('Connecting to WebSocket: $wsUrl');

    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      
      _channel!.stream.listen(
        (message) {
          _reconnectDelaySeconds = 1; // Reset backoff on successful communication
          _handleMessage(message);
        },
        onError: (error) {
          debugPrint('WebSocket stream error: $error');
          _handleDisconnect();
        },
        onDone: () {
          debugPrint('WebSocket stream closed by server.');
          _handleDisconnect();
        },
        cancelOnError: true,
      );
    } catch (e) {
      debugPrint('WebSocket connection exception: $e');
      _handleDisconnect();
    }
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _lastPongReceived = DateTime.now(); // Initialize on connection
    
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (_state == SocketConnectionState.connected && _channel != null) {
        // 1. Check if we haven't received a pong in a long time (liveness check)
        final timeSinceLastPong = DateTime.now().difference(_lastPongReceived ?? DateTime.now());
        if (timeSinceLastPong.inSeconds > 35) {
          debugPrint('WebSocket: Connection lost (no pong received for ${timeSinceLastPong.inSeconds} seconds). Reconnecting...');
          _handleDisconnect();
          return;
        }

        // 2. Send ping to server
        try {
          final pingMessage = jsonEncode({
            'event': 'ping',
            'data': {},
          });
          _channel!.sink.add(pingMessage);
          debugPrint('WebSocket: Sent ping');
        } catch (e) {
          debugPrint('WebSocket: Ping failed: $e');
          _handleDisconnect();
        }
      } else {
        timer.cancel();
      }
    });
  }

  void _handleMessage(dynamic rawMessage) {
    try {
      final String text = rawMessage.toString();
      final Map<String, dynamic> data = jsonDecode(text);
      final String? tipo = data['tipo'];

      if (tipo == 'welcome') {
        final String? status = data['status'];
        debugPrint('WebSocket: Received welcome handshake (status: $status)');
        if (status == 'connected') {
          _updateState(SocketConnectionState.connected);
          _startHeartbeat(); // Start pinging only after handshake completes
        }
      } else if (tipo == 'pong') {
        _lastPongReceived = DateTime.now();
        debugPrint('WebSocket: Received pong');
      } else if (tipo == 'ack') {
        final String? clientUuid = data['client_uuid'];
        final String? versionEn = data['version_en'];
        final String? status = data['status'];
        if (clientUuid != null && versionEn != null && status == 'success') {
          onAckReceived(clientUuid, versionEn);
        } else {
          debugPrint('WebSocket ACK failed or incomplete: ${data['message']}');
        }
      } else if (tipo == 'cambio') {
        onBroadcastChangeReceived(data);
      } else if (tipo == 'cambios') {
        final List<dynamic> items = data['items'] ?? [];
        final String serverTime = data['server_time'] ?? DateTime.now().toIso8601String();
        onResyncChangesReceived(items, serverTime);
      }
    } catch (e) {
      debugPrint('Error parsing WebSocket message: $e, Raw: $rawMessage');
    }
  }

  void _handleDisconnect() {
    _heartbeatTimer?.cancel();
    _channel = null;
    _updateState(SocketConnectionState.disconnected);
    
    // Exponential backoff reconnect
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(seconds: _reconnectDelaySeconds), () {
      // Step up delay: 1s, 3s, 10s, then stay at 15s
      if (_reconnectDelaySeconds == 1) {
        _reconnectDelaySeconds = 3;
      } else if (_reconnectDelaySeconds == 3) {
        _reconnectDelaySeconds = 10;
      } else if (_reconnectDelaySeconds == 10) {
        _reconnectDelaySeconds = 15;
      }
      
      debugPrint('Reconnecting in $_reconnectDelaySeconds seconds...');
      connect();
    });
  }

  void push(String clientUuid, String entity, Map<String, dynamic> payload) {
    if (_state != SocketConnectionState.connected || _channel == null) {
      debugPrint('WebSocket is offline, cannot push message');
      return;
    }

    try {
      final packet = {
        'event': 'push', // NestJS gateway routing keyword
        'data': {
          'client_uuid': clientUuid,
          'entidad': entity,
          'payload': payload,
        }
      };
      _channel!.sink.add(jsonEncode(packet));
    } catch (e) {
      debugPrint('Error pushing over WebSocket: $e');
    }
  }

  void triggerResync(String sinceIsoString) {
    if (_state != SocketConnectionState.connected || _channel == null) {
      return;
    }

    try {
      final packet = {
        'event': 'resync',
        'data': {
          'desde': sinceIsoString,
        }
      };
      _channel!.sink.add(jsonEncode(packet));
    } catch (e) {
      debugPrint('Error triggering resync over WebSocket: $e');
    }
  }

  void dispose() {
    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel();
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
    _updateState(SocketConnectionState.disconnected);
  }
}
