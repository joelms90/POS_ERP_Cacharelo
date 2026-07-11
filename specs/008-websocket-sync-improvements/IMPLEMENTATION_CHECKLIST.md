# WebSocket Sync Improvements - Implementation Checklist

## Pre-Implementation

- [ ] Review full specification document
- [ ] Set up test devices (2 devices or simulators)
- [ ] Backup current code: `git checkout -b backup-before-websocket-improvements`
- [ ] Create feature branch: `git checkout -b fix/websocket-sync-improvements`
- [ ] Verify current system works: Manual sync, kitchen screen, waiter flow

---

## Phase 1: Connection Reliability

### ✅ Commit 1: Add welcome message handler
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/pos_flutter/lib/ui/common/sync_socket_service.dart:109-134`
- [ ] Add `if (tipo == 'welcome')` case in `_handleMessage()`
- [ ] Add debug logging
- [ ] Test: `flutter run`, check logs for welcome message
- [ ] Verify: No crashes, manual sync still works
- [ ] Commit: `git commit -m "fix(websocket): add welcome message handler"`

**Time estimate:** 15 minutes

---

### ✅ Commit 2: Update connection state on welcome
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/pos_flutter/lib/ui/common/sync_socket_service.dart:87-102`
- [ ] Remove `_updateState(connected)` from stream listener
- [ ] State now set in `_handleMessage` when welcome received
- [ ] Test: Login, check status bar turns green quickly
- [ ] Verify: Send comanda, kitchen updates fast
- [ ] Commit: `git commit -m "fix(websocket): update state immediately on welcome"`

**Time estimate:** 10 minutes

---

## Phase 2: Error Handling & Retry

### ✅ Commit 3: Add error handling to WebSocket syncs
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/pos_flutter/lib/ui/common/app_state.dart:3145`
- [ ] Wrap `syncKitchenOrders()` in `.catchError()`
- [ ] Set `lastSyncError` for UI display
- [ ] Add debug logging
- [ ] Test: Temporarily break sync, verify error logged
- [ ] Verify: Manual sync unaffected
- [ ] Commit: `git commit -m "fix(websocket): add error handling to broadcast syncs"`

**Time estimate:** 20 minutes

---

### ✅ Commit 4: Add retry mechanism
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/pos_flutter/lib/ui/common/app_state.dart`
- [ ] Add fields: `_kitchenSyncRetryTimer`, `_kitchenSyncRetryCount`
- [ ] Create `_scheduleKitchenSyncFromWebSocket()` method
- [ ] Implement exponential backoff: 2s, 4s, 6s
- [ ] Max 3 retries
- [ ] Update `_handleWebSocketChange` to use new method
- [ ] Clean up timer in `dispose()`
- [ ] Test: Force failures, verify 3 retry attempts
- [ ] Verify: Manual sync has NO retry logic
- [ ] Commit: `git commit -m "fix(websocket): add retry mechanism for broadcast syncs"`

**Time estimate:** 30 minutes

---

## Phase 3: Connection Health

### ✅ Commit 5: Implement client heartbeat
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/pos_flutter/lib/ui/common/sync_socket_service.dart`
- [ ] Add field: `Timer? _heartbeatTimer`
- [ ] Create `_startHeartbeat()` method
- [ ] Send ping every 30 seconds
- [ ] Cancel heartbeat in `dispose()`
- [ ] Test: Leave app idle 2 minutes, check logs
- [ ] Verify: Pings sent regularly, connection stays alive
- [ ] Commit: `git commit -m "fix(websocket): implement client-side heartbeat"`

**Time estimate:** 25 minutes

---

### ✅ Commit 6: Add backend ping handler
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/sync_api/src/modules/sync/sync.gateway.ts`
- [ ] Add `@SubscribeMessage('ping')` handler
- [ ] Send pong response
- [ ] Update Flutter to handle 'pong' message type
- [ ] Test: Start backend, start Flutter, verify ping/pong exchange
- [ ] Verify: Backend logs clean, no errors
- [ ] Commit: `git commit -m "fix(websocket): add backend ping/pong handler"`

**Time estimate:** 15 minutes

---

## Phase 4: Race Conditions & Notifications

### ✅ Commit 7: Fix race condition
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/pos_flutter/lib/ui/common/app_state.dart`
- [ ] Add field: `Set<String> _pendingKitchenStatusUpdates`
- [ ] Update `updateKitchenOrderStatus()` to track pending
- [ ] Modify `syncKitchenOrders()` to preserve pending updates
- [ ] Add 2-second grace period
- [ ] Test: Rapidly change status, verify no flickering
- [ ] Verify: Works for both WebSocket and manual sync
- [ ] Commit: `git commit -m "fix(websocket): prevent race condition in kitchen status updates"`

**Time estimate:** 35 minutes

---

### ✅ Commit 8: Add immediate notifications
**Branch:** `fix/websocket-sync-improvements`

- [ ] Modify `apps/pos_flutter/lib/ui/common/app_state.dart:3144-3146`
- [ ] Add notification logic in broadcast handler
- [ ] Check payload for `status === 'ready'`
- [ ] Add extension `firstWhereOrNull` if needed
- [ ] Prevent duplicate notifications
- [ ] Test: Kitchen marks ready, waiter gets notification <2s
- [ ] Verify: Notification doesn't duplicate
- [ ] Commit: `git commit -m "fix(websocket): add immediate notifications in broadcast handler"`

**Time estimate:** 25 minutes

---

## Phase 5: Testing

### ✅ Commit 9: Test manual sync without WebSocket
**Branch:** `fix/websocket-sync-improvements`

- [ ] Temporarily disable WebSocket init
- [ ] Test: Kitchen manual sync works
- [ ] Test: Waiter manual sync works
- [ ] Test: No retry logic for manual sync
- [ ] Verify: No WebSocket errors
- [ ] Remove test code
- [ ] Document results in test log
- [ ] Commit: `git commit -m "test(websocket): verify manual sync backwards compatibility"`

**Time estimate:** 30 minutes

---

### ✅ Commit 10: Test WebSocket real-time updates
**Branch:** `fix/websocket-sync-improvements`

- [ ] Setup: 2 devices (waiter + kitchen)
- [ ] Test: Waiter → Kitchen flow (<2s)
- [ ] Test: Kitchen → Waiter status updates
- [ ] Test: Kitchen → Waiter notifications (<2s)
- [ ] Test: No race condition (rapid status changes)
- [ ] Measure and document latency
- [ ] Commit: `git commit -m "test(websocket): verify real-time update performance"`

**Time estimate:** 45 minutes

---

### ✅ Commit 11: Test WebSocket reconnection
**Branch:** `fix/websocket-sync-improvements`

- [ ] Test: WiFi disconnect/reconnect
- [ ] Test: Backend restart
- [ ] Test: Slow network (throttling)
- [ ] Test: WebSocket error recovery
- [ ] Verify: Exponential backoff works
- [ ] Verify: Fallback polling activates
- [ ] Document all scenarios
- [ ] Commit: `git commit -m "test(websocket): verify reconnection and error recovery"`

**Time estimate:** 45 minutes

---

### ✅ Commit 12: Performance & stability testing
**Branch:** `fix/websocket-sync-improvements`

- [ ] Test: Heartbeat performance (10 min idle)
- [ ] Test: Multiple simultaneous updates
- [ ] Test: Long-running session (8 hours)
- [ ] Test: Error recovery under load
- [ ] Monitor: CPU, memory, network
- [ ] Document performance metrics
- [ ] Commit: `git commit -m "test(websocket): verify performance and stability"`

**Time estimate:** 2 hours (mostly waiting)

---

## Post-Implementation

### Documentation
- [ ] Update `apps/pos_flutter/README.md`
- [ ] Update `specs/009-websocket-sync-server/`
- [ ] Update `HANDOFF.md`
- [ ] Create `RUNBOOK.md` for operations

### Code Review
- [ ] Self-review all commits
- [ ] Check for TODOs or debug code
- [ ] Verify all tests pass
- [ ] Verify backwards compatibility

### Deployment Preparation
- [ ] Create pull request
- [ ] Add screenshots/videos of improvements
- [ ] Document breaking changes (should be none)
- [ ] Plan deployment schedule

### Merge & Deploy
- [ ] Get approval from tech lead
- [ ] Merge to main: `git checkout main && git merge fix/websocket-sync-improvements`
- [ ] Tag release: `git tag -a v1.x.x -m "WebSocket sync improvements"`
- [ ] Deploy backend first
- [ ] Deploy Flutter app
- [ ] Monitor logs for errors

### Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Collect user feedback
- [ ] Measure success metrics
- [ ] Document lessons learned

---

## Rollback Procedure (if needed)

- [ ] Disable WebSocket via feature flag (if implemented)
- [ ] OR: `git revert` commits in reverse order (12→11→...→1)
- [ ] Rebuild and redeploy
- [ ] Verify manual sync works
- [ ] Document root cause
- [ ] Plan hotfix

---

## Time Estimates

| Phase | Time |
|-------|------|
| Phase 1 (Commits 1-2) | 25 min |
| Phase 2 (Commits 3-4) | 50 min |
| Phase 3 (Commits 5-6) | 40 min |
| Phase 4 (Commits 7-8) | 60 min |
| Phase 5 (Commits 9-12) | 4 hours |
| Documentation | 1 hour |
| **Total** | **~7 hours** |

*Spread over 2-3 days for thorough testing*

---

## Success Checklist

After all commits:

**Functional:**
- [ ] Kitchen screen updates <2s when waiter sends comanda
- [ ] Waiter notification <2s when kitchen marks ready
- [ ] Manual sync button works exactly as before
- [ ] System handles WebSocket disconnections gracefully
- [ ] No UI flickering during status updates
- [ ] WebSocket reconnects automatically
- [ ] Heartbeat keeps connection alive
- [ ] Errors logged and displayed

**Non-Functional:**
- [ ] No performance degradation
- [ ] No memory leaks
- [ ] 100% backwards compatible
- [ ] Code is maintainable
- [ ] Comprehensive logging

**User Acceptance:**
- [ ] System feels faster
- [ ] Connection status is clear
- [ ] No increase in support tickets

---

## Notes

- Each commit should be tested independently before moving to next
- Manual sync must work after EVERY commit
- If any test fails, stop and fix before proceeding
- Document any deviations from spec in commit messages
- Keep backup branch until stable in production (1 week)

---

## Contact

**Questions?** Reference `SPECIFICATION.md` for full details
**Issues?** Create GitHub issue with label `websocket-sync`
