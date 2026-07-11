# WebSocket Synchronization Improvements Specification

**Version:** 1.0
**Date:** 2026-07-09
**Author:** System Analysis
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Problems Identified](#problems-identified)
4. [Proposed Solution](#proposed-solution)
5. [Implementation Plan](#implementation-plan)
6. [Testing Strategy](#testing-strategy)
7. [Backwards Compatibility](#backwards-compatibility)
8. [Success Criteria](#success-criteria)
9. [Rollback Plan](#rollback-plan)

---

## 1. Executive Summary

### Problem
Users report that kitchen screens don't update when waiters send comandas, and waiters don't receive notifications when kitchen staff mark dishes as ready. This causes operational delays and miscommunication.

### Root Cause
The WebSocket synchronization system between the Flutter POS app and NestJS backend has several reliability issues:
- Missing connection confirmation handler
- No error handling for broadcast-triggered syncs
- Race conditions causing UI flickering
- Lack of connection health monitoring
- Delayed notifications to waiters

### Solution
Implement incremental improvements to the WebSocket layer while maintaining full backwards compatibility with manual sync functionality. All changes will gracefully degrade if WebSocket is unavailable.

### Impact
- Reduce kitchen screen update latency from 15 seconds (polling) to <2 seconds (real-time)
- Improve waiter notification delivery from 0-15 seconds to <2 seconds
- Eliminate UI flickering from race conditions
- Maintain 100% backwards compatibility with manual sync button

---

## 2. Current State Analysis

### 2.1 Architecture Overview

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│  Flutter App    │◄──────────────────────────►│  NestJS Backend  │
│  (POS Client)   │         /sync path         │  (Sync API)      │
└─────────────────┘                            └──────────────────┘
         │                                              │
         │ Fallback: REST API polling (15s)            │
         └──────────────────────────────────────────────┘
                    /kitchen/active endpoint
```

### 2.2 Current Data Flow

#### Flow 1: Waiter sends comanda
```
1. Waiter → submitOrder()
2. Flutter → _pushOpenOrderToCloud()
3. Flutter → POST /kitchen/orders/{orderId}/send
4. Backend → sendOrderToKitchen()
5. Backend → broadcastChange(branchId, {tipo: 'cambio', changes: [{entity: 'kitchenOrders'}]})
6. Kitchen client receives broadcast
7. Kitchen → syncKitchenOrders()
8. Kitchen → GET /kitchen/active
9. Kitchen screen updates
```

**Current latency:** 1-3 seconds (WebSocket) or 0-15 seconds (polling fallback)

#### Flow 2: Kitchen updates status
```
1. Kitchen → updateKitchenOrderStatus(orderId, 'ready')
2. Kitchen → PATCH /kitchen/tickets/{id}/status
3. Backend → updateTicketStatus()
4. Backend → broadcastChange(branchId, {tipo: 'cambio', changes: [{entity: 'kitchenOrders'}]})
5. Waiter client receives broadcast
6. Waiter → syncKitchenOrders()
7. Waiter → GET /kitchen/active
8. Waiter screen updates (notification added in syncKitchenOrders)
```

**Current latency:** 1-3 seconds (WebSocket) or 0-15 seconds (polling fallback)

### 2.3 Current Code Locations

| Component | File | Lines |
|-----------|------|-------|
| WebSocket Client | `apps/pos_flutter/lib/ui/common/sync_socket_service.dart` | 1-205 |
| WebSocket Gateway | `apps/sync_api/src/modules/sync/sync.gateway.ts` | 1-216 |
| App State Handler | `apps/pos_flutter/lib/ui/common/app_state.dart` | 3055-3213 |
| Kitchen Service | `apps/sync_api/src/modules/kitchen/kitchen.service.ts` | 1-52 |
| Kitchen Dashboard | `apps/pos_flutter/lib/ui/kitchen/kitchen_dashboard_screen.dart` | 1-582 |

---

## 3. Problems Identified

### 3.1 Critical Issues (High Priority)

#### Issue #1: Missing Welcome Message Handler
**Location:** `sync_socket_service.dart:109-134`

**Problem:**
- Backend sends `{tipo: 'welcome', status: 'connected'}` on connection (sync.gateway.ts:62)
- Client doesn't handle this message type
- Client state changes to `connected` only after receiving the FIRST data message
- Creates a window where broadcasts can be missed

**Impact:**
- Potential missed broadcasts during initial connection
- Unreliable connection state detection
- Users may send comandas before connection is fully established

**Evidence:**
```dart
// Current handler only checks: 'ack', 'cambio', 'cambios'
void _handleMessage(dynamic rawMessage) {
  final String? tipo = data['tipo'];

  if (tipo == 'ack') {
    // ...
  } else if (tipo == 'cambio') {
    // ...
  } else if (tipo == 'cambios') {
    // ...
  }
  // Missing: } else if (tipo == 'welcome') {
}
```

---

#### Issue #2: No Error Handling in Broadcast Sync
**Location:** `app_state.dart:3145`

**Problem:**
- When WebSocket broadcast received, `syncKitchenOrders()` is called with `unawaited()`
- Errors are silently swallowed with no retry mechanism
- If the REST API call fails (timeout, network issue), kitchen orders don't update

**Impact:**
- Silent failures leave kitchen screens out of sync
- No user feedback when sync fails
- No automatic recovery

**Evidence:**
```dart
} else if (entity == 'kitchenOrders') {
  unawaited(syncKitchenOrders()); // Fire-and-forget, errors ignored
}
```

**Frequency:** Happens whenever network is unstable or API is slow

---

#### Issue #3: Race Condition in Kitchen Order Updates
**Location:** `app_state.dart:2360-2376`, `app_state.dart:1197-1240`

**Problem:**
1. Kitchen updates status locally (optimistic update)
2. Backend API call is made asynchronously
3. Backend broadcasts change to all clients (including originating client)
4. Kitchen receives its own broadcast
5. `syncKitchenOrders()` fetches from REST API
6. Entire `kitchenOrders` list is replaced
7. If broadcast arrives before API call completes, local update is overwritten

**Impact:**
- UI flickers (status changes then reverts briefly)
- User confusion ("I just clicked preparing, why is it pending again?")
- Loss of user trust in the system

**Evidence:**
```dart
void updateKitchenOrderStatus(String orderId, String newStatus) {
  kitchenOrders[index].status = newStatus; // Local update
  unawaited(_updateCloudKitchenTicketStatus(orderId, newStatus)); // Async
  notifyListeners();
}

// Later, broadcast arrives:
Future<bool> syncKitchenOrders() async {
  // ...
  kitchenOrders = newOrders; // Replaces entire list, loses local changes
}
```

---

### 3.2 Important Issues (Medium Priority)

#### Issue #4: Delayed Waiter Notifications
**Location:** `app_state.dart:1231-1238`

**Problem:**
- Notification logic ONLY exists inside `syncKitchenOrders()`
- Notifications only trigger when REST API is called
- With WebSocket, this means notification depends on broadcast → REST API roundtrip
- If REST API call fails, no notification is shown

**Impact:**
- Waiter may not know food is ready
- Delays service delivery
- Customer satisfaction decreases

**Current flow:**
```
Kitchen marks ready → Broadcast sent → Waiter receives broadcast →
syncKitchenOrders() called → REST API fetched → Notification added
```

**Desired flow:**
```
Kitchen marks ready → Broadcast sent → Waiter receives broadcast →
Notification added immediately
```

---

#### Issue #5: No Connection Health Monitoring
**Location:** `sync_socket_service.dart` (missing functionality)

**Problem:**
- No ping/pong heartbeat mechanism
- Long idle periods can cause connection to timeout
- Mobile OS (especially iOS) may kill idle WebSocket connections
- Load balancers may timeout idle connections (typically 60-120 seconds)
- Client doesn't detect stale connections until next message attempt

**Impact:**
- "Ghost connections" where client thinks it's connected but isn't
- Broadcasts are lost
- Users think system is working but updates don't arrive

**Industry standard:** 30-60 second heartbeat intervals

---

### 3.3 Minor Issues (Low Priority)

#### Issue #6: Duplicate Kitchen Order Creation
**Location:** `app_state.dart:1733-1741`

**Problem:**
- Local `KitchenOrder` created with timestamp-based ID
- Backend creates kitchen tickets with database-generated UUIDs
- `syncKitchenOrders()` replaces local order with backend version
- IDs don't match

**Impact:**
- Minor UI flicker
- Confusion in debugging (IDs change)
- Not user-facing in most cases

---

## 4. Proposed Solution

### 4.1 Design Principles

1. **Graceful Degradation:** All features must work with or without WebSocket
2. **Backwards Compatibility:** Manual sync button must continue to work exactly as before
3. **Fail-Safe:** System should never be worse than current state
4. **Observable:** All state changes must be logged for debugging
5. **Testable:** Each improvement can be tested independently

### 4.2 Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Flutter App State                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐         ┌────────────────────────┐ │
│  │  WebSocket Layer    │         │   Manual Sync Layer    │ │
│  │  (Real-time)        │         │   (On-demand)          │ │
│  ├─────────────────────┤         ├────────────────────────┤ │
│  │ - Welcome handler   │         │ - Direct REST calls    │ │
│  │ - Error handling    │         │ - No retry logic       │ │
│  │ - Auto-retry (3x)   │         │ - User-initiated       │ │
│  │ - Heartbeat (30s)   │         │ - Unchanged behavior   │ │
│  │ - Race protection   │         │ - Same protection      │ │
│  └─────────────────────┘         └────────────────────────┘ │
│            │                              │                  │
│            └──────────────┬───────────────┘                  │
│                           ▼                                  │
│              ┌──────────────────────────┐                    │
│              │   syncKitchenOrders()    │                    │
│              │   (Shared function)      │                    │
│              └──────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │     NestJS Backend       │
              │   - Sync Gateway         │
              │   - Kitchen Service      │
              └──────────────────────────┘
```

### 4.3 Technical Approach

#### 4.3.1 Connection Reliability
- Add `'welcome'` message type handler
- Update connection state immediately on handshake
- Log all state transitions for debugging

#### 4.3.2 Error Handling
- Wrap WebSocket-triggered syncs in error handlers
- Log errors with context (WebSocket vs manual)
- Set `lastSyncError` state for UI display

#### 4.3.3 Retry Logic
- Implement exponential backoff for WebSocket syncs only: 2s, 4s, 6s
- Maximum 3 retry attempts
- Separate code path from manual sync (no retry)
- Clear retry state on success

#### 4.3.4 Connection Health
- Client sends `ping` every 30 seconds
- Backend responds with `pong`
- Client disconnects and reconnects if pong not received within 5 seconds
- Leverages existing reconnection logic

#### 4.3.5 Race Condition Fix
- Track pending status updates in `Set<String>`
- Preserve local state during sync if update is pending
- Clear pending flag after 2-second grace period
- Works for both WebSocket and manual sync

#### 4.3.6 Immediate Notifications
- Check broadcast payload for `status === 'ready'`
- Add notification directly in broadcast handler
- Still add in `syncKitchenOrders()` as backup

---

## 5. Implementation Plan

### 5.1 Phase Breakdown

| Phase | Commits | Scope | Risk | Dependencies |
|-------|---------|-------|------|--------------|
| 1 | 1-2 | Connection reliability | Low | None |
| 2 | 3-4 | Error handling & retry | Low | Phase 1 |
| 3 | 5-6 | Connection health | Low | Phase 1 |
| 4 | 7-8 | Race conditions & notifications | Medium | Phase 2 |
| 5 | 9-12 | Integration testing | Low | All phases |

### 5.2 Detailed Commit Plan

---

#### **Commit 1: Add welcome message handler**

**Objective:** Handle server handshake message to detect full connection

**Files Modified:**
- `apps/pos_flutter/lib/ui/common/sync_socket_service.dart`

**Changes:**
```dart
void _handleMessage(dynamic rawMessage) {
  try {
    final String text = rawMessage.toString();
    final Map<String, dynamic> data = jsonDecode(text);
    final String? tipo = data['tipo'];

    // NEW: Handle welcome message
    if (tipo == 'welcome') {
      final String? status = data['status'];
      debugPrint('WebSocket: Received welcome handshake (status: $status)');
      if (status == 'connected') {
        _updateState(SocketConnectionState.connected);
      }
    } else if (tipo == 'ack') {
      // existing code...
```

**Testing:**
1. Run Flutter app: `flutter run`
2. Login as any role
3. Check debug console for: `"WebSocket: Received welcome handshake"`
4. Verify app doesn't crash

**Acceptance Criteria:**
- ✅ Console shows welcome message log
- ✅ No breaking changes
- ✅ Manual sync still works

**Rollback:** Revert commit, no database changes

---

#### **Commit 2: Update connection state on welcome**

**Objective:** Set connection state immediately on handshake, not on first data message

**Files Modified:**
- `apps/pos_flutter/lib/ui/common/sync_socket_service.dart`

**Changes:**
```dart
_channel!.stream.listen(
  (message) {
    _reconnectDelaySeconds = 1;
    // REMOVED: _updateState(SocketConnectionState.connected);
    // Now handled in _handleMessage when 'welcome' received
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
```

**Testing:**
1. Login as waiter
2. Observe `OfflineStatusBar` widget
3. Verify status changes to green "Online" within 1 second
4. Send comanda, verify kitchen updates quickly

**Acceptance Criteria:**
- ✅ Status bar shows green within 1 second of login
- ✅ No delay in connection detection
- ✅ Backwards compatible

**Rollback:** Revert commit, no side effects

---

#### **Commit 3: Add error handling to WebSocket syncs**

**Objective:** Catch and log errors when WebSocket broadcasts trigger syncs

**Files Modified:**
- `apps/pos_flutter/lib/ui/common/app_state.dart`

**Changes:**
```dart
void _handleWebSocketChange(Map<String, dynamic> data) {
  final changes = data['changes'] as List<dynamic>?;
  if (changes == null) return;

  bool stateChanged = false;
  for (final change in changes) {
    if (change is! Map<String, dynamic>) continue;
    final entity = change['entity']?.toString();
    final entityId = change['entityId']?.toString();
    final payload = change['payload'];

    // ... existing branchTables and orders handling ...

    // MODIFIED: Add error handling
    } else if (entity == 'kitchenOrders') {
      syncKitchenOrders().catchError((e) {
        debugPrint('❌ WebSocket-triggered kitchen sync failed: $e');
        lastSyncError = 'Kitchen sync error: ${e.toString().substring(0, 100)}';
        notifyListeners();
        // Note: Don't rethrow - graceful degradation
      });
    }
  }

  if (stateChanged) {
    notifyListeners();
  }

  // Background pull sync to ensure operational data is 100% up to date
  unawaited(syncActiveOrders(notify: false));
  unawaited(syncTableStates(notify: false));
}
```

**Testing:**
1. Temporarily add `throw Exception('Test error')` in `syncKitchenOrders()`
2. Send comanda from waiter
3. Check console shows error message
4. Check kitchen screen shows error banner
5. Remove test exception

**Acceptance Criteria:**
- ✅ Errors are logged with context
- ✅ `lastSyncError` is set for UI display
- ✅ App doesn't crash
- ✅ Manual sync unaffected

**Rollback:** Revert commit, no side effects

---

#### **Commit 4: Add retry mechanism for WebSocket syncs**

**Objective:** Automatically retry failed WebSocket-triggered syncs up to 3 times

**Files Modified:**
- `apps/pos_flutter/lib/ui/common/app_state.dart`

**Changes:**
```dart
class AppState extends ChangeNotifier {
  // ... existing fields ...

  // NEW: Retry tracking for WebSocket syncs only
  Timer? _kitchenSyncRetryTimer;
  int _kitchenSyncRetryCount = 0;

  // ... existing methods ...

  void _handleWebSocketChange(Map<String, dynamic> data) {
    // ... existing code ...

    } else if (entity == 'kitchenOrders') {
      _scheduleKitchenSyncFromWebSocket(); // NEW: Use retry-enabled method
    }
  }

  // NEW: WebSocket-specific sync with retry logic
  void _scheduleKitchenSyncFromWebSocket() {
    _kitchenSyncRetryTimer?.cancel();

    syncKitchenOrders().then((success) {
      if (success) {
        _kitchenSyncRetryCount = 0; // Reset on success
        lastSyncError = null;
      } else {
        throw Exception('syncKitchenOrders returned false');
      }
    }).catchError((e) {
      debugPrint('❌ WebSocket kitchen sync failed (attempt ${_kitchenSyncRetryCount + 1}/3): $e');

      if (_kitchenSyncRetryCount < 3) {
        // Exponential backoff: 2s, 4s, 6s
        final delay = Duration(seconds: 2 * (_kitchenSyncRetryCount + 1));
        debugPrint('⏳ Retrying kitchen sync in ${delay.inSeconds}s...');

        _kitchenSyncRetryTimer = Timer(delay, () {
          _kitchenSyncRetryCount++;
          _scheduleKitchenSyncFromWebSocket(); // Recursive retry
        });
      } else {
        // Max retries exceeded
        debugPrint('⛔ Kitchen sync failed after 3 retries, giving up');
        lastSyncError = 'Kitchen sync failed after 3 retries';
        _kitchenSyncRetryCount = 0;
        notifyListeners();
      }
    });
  }

  @override
  void dispose() {
    _kitchenSyncRetryTimer?.cancel();
    // ... existing dispose code ...
    super.dispose();
  }
}
```

**Testing:**
1. Temporarily make `syncKitchenOrders()` fail for first 2 attempts
2. Send comanda
3. Check console shows:
   - "attempt 1/3"
   - "Retrying in 2s"
   - "attempt 2/3"
   - "Retrying in 4s"
   - "attempt 3/3"
   - Success on 3rd attempt
4. Remove test failure

**Acceptance Criteria:**
- ✅ Retry happens with correct delays (2s, 4s, 6s)
- ✅ Stops after 3 attempts
- ✅ Resets counter on success
- ✅ Manual sync has NO retry logic (unchanged)

**Rollback:** Revert commit, timers are cleaned up

---

#### **Commit 5: Implement client-side heartbeat**

**Objective:** Keep WebSocket connection alive with periodic ping messages

**Files Modified:**
- `apps/pos_flutter/lib/ui/common/sync_socket_service.dart`

**Changes:**
```dart
class SyncSocketService {
  WebSocketChannel? _channel;
  SocketConnectionState _state = SocketConnectionState.disconnected;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer; // NEW
  int _reconnectDelaySeconds = 1;

  // ... existing code ...

  void connect() {
    if (_state == SocketConnectionState.connected ||
        _state == SocketConnectionState.connecting) {
      return;
    }

    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel(); // NEW: Cancel old heartbeat
    _updateState(SocketConnectionState.connecting);
    final wsUrl = _buildWsUrl();
    debugPrint('Connecting to WebSocket: $wsUrl');

    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));

      _channel!.stream.listen(
        (message) {
          _reconnectDelaySeconds = 1;
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

      // NEW: Start heartbeat after connection established
      _startHeartbeat();
    } catch (e) {
      debugPrint('WebSocket connection exception: $e');
      _handleDisconnect();
    }
  }

  // NEW: Heartbeat mechanism
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();

    _heartbeatTimer = Timer.periodic(Duration(seconds: 30), (timer) {
      if (_state == SocketConnectionState.connected && _channel != null) {
        try {
          final pingMessage = jsonEncode({'event': 'ping'});
          _channel!.sink.add(pingMessage);
          debugPrint('WebSocket: Sent ping');
        } catch (e) {
          debugPrint('WebSocket: Ping failed: $e');
          _handleDisconnect();
        }
      } else {
        // Not connected, stop heartbeat
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
        debugPrint('WebSocket: Received welcome handshake');
        _updateState(SocketConnectionState.connected);
      } else if (tipo == 'pong') {
        // NEW: Handle pong response
        debugPrint('WebSocket: Received pong');
      } else if (tipo == 'ack') {
        // existing code...
```

**Testing:**
1. Login and leave app idle for 2 minutes
2. Check debug console every 30 seconds
3. Verify "Sent ping" appears regularly
4. Send comanda to verify connection still works

**Acceptance Criteria:**
- ✅ Ping sent every 30 seconds
- ✅ Connection stays alive during idle periods
- ✅ No performance impact
- ✅ Heartbeat stops when disconnected

**Rollback:** Revert commit, timers are cleaned up

---

#### **Commit 6: Add backend ping/pong handler**

**Objective:** Respond to client ping messages to keep connection alive

**Files Modified:**
- `apps/sync_api/src/modules/sync/sync.gateway.ts`

**Changes:**
```typescript
@WebSocketGateway({ path: '/sync' })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SyncGateway.name);

  @WebSocketServer()
  server: any;

  private activeClients = new Map<string, Set<any>>();

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
  ) {}

  // ... existing handleConnection, handleDisconnect, broadcastChange ...

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: any) {
    // Simple pong response to keep connection alive
    try {
      client.send(JSON.stringify({ tipo: 'pong' }));
    } catch (error) {
      this.logger.warn(`Failed to send pong to client: ${error}`);
    }
  }

  @SubscribeMessage('push')
  async handlePush(@ConnectedSocket() client: any, @MessageBody() data: any) {
    // ... existing code ...
  }

  @SubscribeMessage('resync')
  async handleResync(@ConnectedSocket() client: any, @MessageBody() data: any) {
    // ... existing code ...
  }
}
```

**Testing:**
1. Start backend: `cd apps/sync_api && npm run start:dev`
2. Start Flutter app
3. Check both logs:
   - Flutter: "Sent ping"
   - Backend: (optional log) "Received ping"
   - Flutter: "Received pong"
4. Verify every 30 seconds

**Acceptance Criteria:**
- ✅ Backend responds to ping with pong
- ✅ No errors in backend logs
- ✅ Connection stays alive
- ✅ Minimal performance impact

**Rollback:** Revert commit, no database changes

---

#### **Commit 7: Fix race condition with pending updates**

**Objective:** Prevent local status updates from being overwritten by broadcast syncs

**Files Modified:**
- `apps/pos_flutter/lib/ui/common/app_state.dart`

**Changes:**
```dart
class AppState extends ChangeNotifier {
  // ... existing fields ...

  // NEW: Track pending kitchen order status updates
  final Set<String> _pendingKitchenStatusUpdates = {};

  // ... existing methods ...

  void updateKitchenOrderStatus(String orderId, String newStatus) {
    final index = kitchenOrders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      // Optimistic update
      kitchenOrders[index].status = newStatus;

      // NEW: Track as pending to prevent overwrite
      _pendingKitchenStatusUpdates.add(orderId);
      debugPrint('Kitchen: Marked order $orderId as pending (status: $newStatus)');

      _updateCloudKitchenTicketStatus(orderId, newStatus).then((_) {
        // Keep in pending set for 2 more seconds to allow broadcast to arrive
        Future.delayed(Duration(seconds: 2), () {
          _pendingKitchenStatusUpdates.remove(orderId);
          debugPrint('Kitchen: Cleared pending flag for order $orderId');
        });
      }).catchError((e) {
        // If API call failed, remove immediately
        _pendingKitchenStatusUpdates.remove(orderId);
        debugPrint('Kitchen: API update failed for order $orderId: $e');
      });

      if (newStatus == 'ready') {
        final String notificationText =
            '¡Pedido listo para la ${kitchenOrders[index].tableLabel}!';
        readyNotifications.add(notificationText);
      }
      notifyListeners();
    }
  }

  Future<bool> syncKitchenOrders() async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-api.cacharelo.com/api';
      final response = await http
          .get(Uri.parse('$baseUrl/kitchen/active?branchId=$terminalBranchId'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint('syncKitchenOrders status error: ${response.statusCode}');
        return false;
      }

      final Map<String, String> oldStatuses = {
        for (final o in kitchenOrders) o.id: o.status,
      };

      final List<dynamic> tickets = jsonDecode(response.body);
      final List<KitchenOrder> newOrders = [];
      for (final rawTicket in tickets) {
        final ticket = Map<String, dynamic>.from(rawTicket);
        newOrders.add(KitchenOrder(
          id: ticket['id']?.toString() ?? '',
          tableLabel: ticket['tableLabel']?.toString() ?? 'Mesa',
          items: _itemsFromCloud(ticket['items']),
          timestamp:
              DateTime.tryParse(ticket['createdAt']?.toString() ?? '') ??
              DateTime.now(),
          status: ticket['status']?.toString() ?? 'pending',
        ));
      }

      // NEW: Preserve local changes for pending updates
      final List<KitchenOrder> finalOrders = [];
      for (final newOrder in newOrders) {
        if (_pendingKitchenStatusUpdates.contains(newOrder.id)) {
          // Keep local version to prevent race condition
          final localOrder = kitchenOrders.firstWhere(
            (o) => o.id == newOrder.id,
            orElse: () => newOrder, // Fallback to new order if not found
          );
          finalOrders.add(localOrder);
          debugPrint('Kitchen: Preserved local state for pending order ${newOrder.id}');
        } else {
          finalOrders.add(newOrder);
        }
      }

      // Trigger notification if status changed to 'ready'
      for (final order in finalOrders) {
        final oldStatus = oldStatuses[order.id];
        if (order.status == 'ready' && oldStatus != 'ready') {
          final String notificationText =
              '¡Pedido listo para la ${order.tableLabel}!';
          if (!readyNotifications.contains(notificationText)) {
            readyNotifications.add(notificationText);
          }
        }
      }

      kitchenOrders = finalOrders;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error syncing kitchen orders: $e');
      return false;
    }
  }
}
```

**Testing:**
1. Kitchen screen: Select order, click "EMPEZAR PREPARACIÓN"
2. Observe status changes to "PREPARANDO"
3. Wait 2 seconds
4. Verify status doesn't flicker back to "PENDIENTE"
5. Check console logs for "Preserved local state"

**Acceptance Criteria:**
- ✅ No UI flickering when updating status
- ✅ Local changes preserved during sync
- ✅ Works for both WebSocket and manual sync
- ✅ Pending flag cleared after grace period

**Rollback:** Revert commit, no database changes

---

#### **Commit 8: Add immediate notifications in broadcast handler**

**Objective:** Notify waiters immediately when kitchen marks order ready (don't wait for REST sync)

**Files Modified:**
- `apps/pos_flutter/lib/ui/common/app_state.dart`

**Changes:**
```dart
void _handleWebSocketChange(Map<String, dynamic> data) {
  final changes = data['changes'] as List<dynamic>?;
  if (changes == null) return;

  bool stateChanged = false;
  for (final change in changes) {
    if (change is! Map<String, dynamic>) continue;
    final entity = change['entity']?.toString();
    final entityId = change['entityId']?.toString();
    final payload = change['payload'];

    if (entity == 'branchTables' && payload is Map) {
      // ... existing code ...
    } else if (entity == 'orders' && payload is Map) {
      // ... existing code ...
    } else if (entity == 'kitchenOrders') {
      // NEW: Check for ready status in broadcast payload
      if (payload is Map) {
        final ticketId = payload['id']?.toString();
        final newStatus = payload['status']?.toString();
        final tableLabel = payload['tableLabel']?.toString();

        // Immediate notification if status changed to ready
        if (newStatus == 'ready' && ticketId != null && tableLabel != null) {
          // Find existing order to check if this is a status change
          final existingOrder = kitchenOrders.firstWhereOrNull(
            (o) => o.id == ticketId
          );

          if (existingOrder != null && existingOrder.status != 'ready') {
            // Status just changed to ready - notify immediately
            final notificationText = '¡Pedido listo para la $tableLabel!';
            if (!readyNotifications.contains(notificationText)) {
              readyNotifications.add(notificationText);
              debugPrint('⚡ Immediate notification: $notificationText');
              stateChanged = true;
            }
          }
        }
      }

      // Still trigger full sync as backup
      _scheduleKitchenSyncFromWebSocket();
    }
  }

  if (stateChanged) {
    notifyListeners();
  }

  // Background pull sync to ensure operational data is 100% up to date
  unawaited(syncActiveOrders(notify: false));
  unawaited(syncTableStates(notify: false));
}
```

**Note:** Add extension for `firstWhereOrNull`:
```dart
// Add to app_state.dart
extension IterableExtension<T> on Iterable<T> {
  T? firstWhereOrNull(bool Function(T element) test) {
    for (var element in this) {
      if (test(element)) return element;
    }
    return null;
  }
}
```

**Testing:**
1. Two devices: Device A (waiter), Device B (kitchen)
2. Waiter creates order
3. Kitchen marks as "PREPARANDO"
4. Kitchen marks as "LISTO"
5. Check Device A (waiter) immediately shows notification
6. Measure time between button click and notification (should be <2s)

**Acceptance Criteria:**
- ✅ Notification appears within 2 seconds
- ✅ Notification doesn't duplicate (check not in list first)
- ✅ Works only when status changes TO ready (not already ready)
- ✅ Fallback to sync still works

**Rollback:** Revert commit, no database changes

---

### 5.3 Testing Phase (Commits 9-12)

#### **Commit 9: Test manual sync without WebSocket**

**Objective:** Verify backwards compatibility - manual sync works when WebSocket disabled

**Test Plan:**
```
Setup:
1. Modify code to prevent WebSocket initialization:
   // In app_state.dart, _initWebSocket()
   void _initWebSocket() {
     debugPrint('WebSocket initialization DISABLED for testing');
     return; // Exit early
   }

2. Rebuild app: flutter run

Test Cases:
TC1: Kitchen manual sync
  - Login as kitchen
  - Kitchen screen shows "disconnected" status
  - Waiter sends comanda on another device
  - Click manual sync button on kitchen screen
  - ✅ Verify: Order appears
  - ✅ Verify: No WebSocket errors in console

TC2: Waiter manual sync
  - Login as waiter
  - Kitchen marks order ready on another device
  - Click manual sync button on waiter screen
  - ✅ Verify: Notification appears
  - ✅ Verify: Order status updates

TC3: No retry logic for manual sync
  - Temporarily break API (wrong URL)
  - Click manual sync button
  - ✅ Verify: Error shown immediately
  - ✅ Verify: No retry attempts (check console logs)
  - ✅ Verify: User can retry manually

Cleanup:
1. Remove test code blocking WebSocket
2. Rebuild app
```

**Acceptance Criteria:**
- ✅ All manual sync features work exactly as before
- ✅ No WebSocket-related crashes
- ✅ No performance degradation
- ✅ UI clearly shows disconnected state

---

#### **Commit 10: Test WebSocket real-time updates**

**Objective:** Verify WebSocket provides fast updates (<2s)

**Test Plan:**
```
Setup:
1. Two devices or simulators
2. Device A: Login as waiter
3. Device B: Login as kitchen

Test Cases:
TC1: Waiter → Kitchen flow
  - Device A: Create order, add items, submit
  - Start timer
  - Device B: Observe kitchen screen
  - Stop timer when order appears
  - ✅ Verify: Order appears in <2 seconds
  - ✅ Check logs: WebSocket broadcast received
  - ✅ Check logs: syncKitchenOrders() called

TC2: Kitchen → Waiter flow (status updates)
  - Device B: Mark order as "PREPARANDO"
  - Device A: Observe waiter screen
  - ✅ Verify: Status updates in <2 seconds (optional, depends on UI)

TC3: Kitchen → Waiter flow (notifications)
  - Device B: Mark order as "LISTO"
  - Start timer
  - Device A: Observe waiter screen notification area
  - Stop timer when notification appears
  - ✅ Verify: Notification in <2 seconds
  - ✅ Check logs: "⚡ Immediate notification" appears

TC4: No race condition
  - Device B: Mark order as "PENDIENTE" → "PREPARANDO" → "LISTO" quickly
  - ✅ Verify: Status doesn't flicker or revert
  - ✅ Check logs: "Preserved local state" appears
```

**Acceptance Criteria:**
- ✅ Updates consistently <2 seconds
- ✅ No UI flickering
- ✅ Logs show WebSocket broadcasts
- ✅ Notifications immediate

---

#### **Commit 11: Test WebSocket reconnection**

**Objective:** Verify graceful handling of connection failures

**Test Plan:**
```
Setup:
1. Single device
2. Login as waiter

Test Cases:
TC1: WiFi disconnect/reconnect
  - Observe status bar shows "Online" (green)
  - Disable WiFi
  - ✅ Verify: Status changes to "Offline" (red)
  - ✅ Check logs: "WebSocket stream closed"
  - Wait 5 seconds
  - ✅ Check logs: Reconnection attempts with backoff (1s, 3s, 10s)
  - ✅ Verify: Fallback polling activated
  - Re-enable WiFi
  - ✅ Verify: Status returns to "Online"
  - ✅ Check logs: "WebSocket: Received welcome handshake"

TC2: Backend restart
  - App running with WebSocket connected
  - Restart sync_api backend: Ctrl+C, npm run start:dev
  - ✅ Verify: App detects disconnect
  - ✅ Verify: App reconnects automatically
  - ✅ Verify: No data loss

TC3: Slow network
  - Use network throttling (Chrome DevTools or iOS Simulator)
  - Send comanda
  - ✅ Verify: Retry logic triggers if sync fails
  - ✅ Verify: Eventually succeeds
  - ✅ Check logs: Retry attempts logged

TC4: WebSocket error recovery
  - Force WebSocket error (backend returns 500)
  - ✅ Verify: Client switches to fallback polling
  - ✅ Verify: System continues working
  - Fix backend
  - ✅ Verify: WebSocket reconnects
```

**Acceptance Criteria:**
- ✅ All reconnection scenarios handled gracefully
- ✅ No data loss
- ✅ Fallback polling works
- ✅ User sees clear connection status

---

#### **Commit 12: Performance & stability testing**

**Objective:** Verify system performs well under realistic load

**Test Plan:**
```
Test Cases:
TC1: Heartbeat doesn't impact performance
  - Login, leave app idle for 10 minutes
  - Monitor CPU/memory usage
  - ✅ Verify: No memory leaks
  - ✅ Verify: CPU usage <5% during idle
  - ✅ Check logs: Pings sent regularly (every 30s)

TC2: Multiple simultaneous updates
  - Waiter sends 5 comandas rapidly
  - Kitchen updates 3 orders to ready simultaneously
  - ✅ Verify: All updates processed
  - ✅ Verify: No duplicate notifications
  - ✅ Verify: No missing orders

TC3: Long-running session
  - Login in morning
  - Use app intermittently throughout day (8 hours)
  - ✅ Verify: WebSocket stays connected
  - ✅ Verify: No crashes
  - ✅ Verify: No degraded performance

TC4: Error recovery under load
  - Simulate poor network (packet loss)
  - Send multiple comandas
  - ✅ Verify: All eventually sync
  - ✅ Verify: Retry logic doesn't overwhelm backend
  - ✅ Check logs: Proper backoff delays
```

**Acceptance Criteria:**
- ✅ System stable under realistic load
- ✅ No performance degradation over time
- ✅ Graceful handling of edge cases

---

## 6. Testing Strategy

### 6.1 Test Levels

| Level | Scope | Tools | Responsibility |
|-------|-------|-------|----------------|
| Unit | Individual functions | Dart test | Developer |
| Integration | WebSocket flow | Manual testing | Developer + QA |
| System | Full POS workflow | Manual testing | QA |
| Acceptance | Real restaurant scenario | Field testing | Product + Customer |

### 6.2 Test Environments

1. **Development**: Local machine with Flutter & NestJS
2. **Staging**: Cloud-deployed backend + test devices
3. **Production**: Live restaurant with monitoring

### 6.3 Regression Testing

Before each commit:
- ✅ Manual sync button works
- ✅ Kitchen screen refreshes
- ✅ Waiter can send comandas
- ✅ Cashier can close sales
- ✅ No crashes on startup

### 6.4 Performance Benchmarks

| Metric | Current | Target | Test Method |
|--------|---------|--------|-------------|
| Comanda → Kitchen latency | 0-15s | <2s | Stopwatch |
| Kitchen → Waiter notification | 0-15s | <2s | Stopwatch |
| WebSocket reconnect time | Variable | <10s | Disconnect WiFi test |
| Heartbeat overhead | N/A | <5% CPU | Activity Monitor |

---

## 7. Backwards Compatibility

### 7.1 Compatibility Matrix

| Scenario | Before | After | Status |
|----------|--------|-------|--------|
| Manual sync (no WebSocket) | Works | Works | ✅ Preserved |
| WebSocket connected | Works (slow) | Works (fast) | ✅ Improved |
| WebSocket disconnected | Fallback polling | Fallback polling | ✅ Preserved |
| Offline mode | Manual sync | Manual sync | ✅ Preserved |
| Kitchen status update | May flicker | No flicker | ✅ Improved |

### 7.2 Migration Strategy

**No database migrations required** - all changes are in application logic.

**Deployment steps:**
1. Deploy backend changes (Commit 6 - ping/pong handler)
2. Test backend with old Flutter clients (should be no-op)
3. Deploy Flutter changes incrementally (Commits 1-8)
4. Monitor logs for errors
5. Rollback if issues detected

### 7.3 Feature Flags

Consider adding feature flag for WebSocket:
```dart
// In app_state.dart
static const bool ENABLE_WEBSOCKET = true; // Can be toggled remotely

void _initWebSocket() {
  if (!ENABLE_WEBSOCKET) {
    debugPrint('WebSocket disabled by feature flag');
    return;
  }
  // ... normal WebSocket init
}
```

This allows:
- Gradual rollout (enable for 10% of users first)
- Quick disable if issues found
- A/B testing to measure impact

---

## 8. Success Criteria

### 8.1 Functional Requirements

- ✅ F1: Kitchen screen updates within 2 seconds when waiter sends comanda
- ✅ F2: Waiter receives notification within 2 seconds when kitchen marks order ready
- ✅ F3: Manual sync button continues to work exactly as before
- ✅ F4: System gracefully handles WebSocket disconnections
- ✅ F5: No UI flickering during status updates
- ✅ F6: WebSocket reconnects automatically with exponential backoff
- ✅ F7: Heartbeat keeps connection alive during idle periods
- ✅ F8: Errors are logged and displayed to users

### 8.2 Non-Functional Requirements

- ✅ NF1: No performance degradation (<5% CPU increase)
- ✅ NF2: No memory leaks (stable memory usage over 8 hours)
- ✅ NF3: 100% backwards compatible (manual sync works)
- ✅ NF4: Code maintainability (clear separation of WebSocket vs manual sync)
- ✅ NF5: Observable (comprehensive logging for debugging)

### 8.3 User Acceptance Criteria

- ✅ UA1: Restaurant staff report faster kitchen screen updates
- ✅ UA2: Waiters get timely notifications for ready orders
- ✅ UA3: No increase in support tickets related to sync issues
- ✅ UA4: System feels "snappier" and more responsive
- ✅ UA5: Connection status is clear (users know if online/offline)

### 8.4 Metrics to Track

**Before deployment:**
- Average comanda → kitchen latency: ~7.5 seconds (0-15s polling)
- Notification delivery time: ~7.5 seconds
- Support tickets for sync issues: X per week

**After deployment (measure after 1 week):**
- Average comanda → kitchen latency: <2 seconds (target)
- Notification delivery time: <2 seconds (target)
- Support tickets for sync issues: ≤X per week (no increase)

---

## 9. Rollback Plan

### 9.1 Rollback Decision Criteria

Rollback if any of:
- Critical bug affecting sales (can't close orders)
- >10% increase in app crashes
- WebSocket prevents manual sync from working
- Performance degradation >20%
- Negative feedback from >3 restaurants

### 9.2 Rollback Procedure

**Phase 1: Immediate (within 5 minutes)**
1. Disable WebSocket via feature flag (if implemented)
2. System falls back to manual sync + polling
3. Monitor for stability

**Phase 2: Code rollback (within 30 minutes)**
1. `git revert` commits in reverse order (8→7→6→...→1)
2. Rebuild Flutter app: `flutter build apk --release`
3. Redistribute to affected devices
4. Restart backend: `pm2 restart sync-api`

**Phase 3: Root cause analysis (within 24 hours)**
1. Collect logs from affected devices
2. Reproduce issue in development
3. Create hotfix if possible
4. Document lessons learned

### 9.3 Rollback Testing

Before rollback:
- ✅ Verify manual sync still works
- ✅ Verify no database corruption
- ✅ Verify user data intact

After rollback:
- ✅ Verify system returns to previous behavior
- ✅ Verify no data loss
- ✅ Verify all roles (waiter, kitchen, cashier) functional

---

## 10. Documentation

### 10.1 Code Documentation

Each commit must include:
- Clear commit message following conventional commits
- Inline code comments for complex logic
- Updated JSDoc/Dartdoc for modified functions

Example commit message:
```
fix(websocket): add welcome message handler to detect full connection

- Handle 'welcome' message type from server
- Update connection state immediately on handshake
- Add debug logging for connection events

Closes #XXX
```

### 10.2 User Documentation

Update these docs:
- `apps/pos_flutter/README.md` - Add WebSocket architecture section
- `specs/009-websocket-sync-server/` - Update with improvements
- `HANDOFF.md` - Add troubleshooting section for WebSocket issues

### 10.3 Runbook for Operations

Create `specs/008-websocket-sync-improvements/RUNBOOK.md`:
```markdown
# WebSocket Sync Troubleshooting Runbook

## Common Issues

### Issue: Kitchen screen not updating
**Symptoms:** Comanda sent but doesn't appear on kitchen screen
**Diagnosis:**
1. Check status bar - is it green (online)?
2. Check backend logs: `pm2 logs sync-api`
3. Check Flutter logs: `flutter logs`

**Resolution:**
- If offline: Check WiFi, click manual sync button
- If online but slow: Check WebSocket connection in logs
- If error shown: Share error message with support

### Issue: Waiter not getting notifications
**Symptoms:** Kitchen marks ready, waiter doesn't see notification
**Diagnosis:**
1. Check if notification appears after manual sync
2. Check WebSocket broadcast logs
3. Check syncKitchenOrders logs for errors

**Resolution:**
- If manual sync works: WebSocket issue, check connection
- If manual sync fails: Backend issue, check API
```

---

## 11. Appendix

### 11.1 Related Specifications

- [Spec 009: WebSocket Sync Server](/specs/009-websocket-sync-server/)
- [Spec 006: Fiscal Ticket Config](/specs/006-fiscal-ticket-config/)
- [API Documentation](/apps/sync_api/README.md)

### 11.2 Glossary

| Term | Definition |
|------|------------|
| Comanda | Order ticket sent to kitchen |
| WebSocket | Bidirectional persistent connection protocol |
| Broadcast | Server pushing data to all connected clients |
| Race condition | Conflict when local and remote changes overlap |
| Heartbeat | Periodic ping to keep connection alive |
| Exponential backoff | Increasing delay between retry attempts |
| Graceful degradation | System continues working when feature unavailable |

### 11.3 References

- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)
- [Flutter WebSocket Client](https://pub.dev/packages/web_socket_channel)
- [NestJS WebSocket Gateway](https://docs.nestjs.com/websockets/gateways)

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-09 | System Analysis | Initial specification |

---

## Sign-off

**Author:** ___________________ Date: ___________
**Tech Lead:** ___________________ Date: ___________
**Product Owner:** ___________________ Date: ___________
