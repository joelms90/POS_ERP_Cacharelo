# Modules: System & Synchronization

This document specifies the purpose, endpoints, and data patterns for synchronization, reports, and system notifications.

---

## 1. Synchronization Module

### Purpose
Exposes endpoints for bidirectional sync, mapping offline database states with the cloud PostgreSQL database.

### Responsibilities
*   Authenticates registered device UUIDs.
*   Enforces idempotency on pushed payloads using client-generated UUID keys.
*   Validates and merges client-side tables with cloud tables.

### Endpoints
*   `POST /sync/push` (Receives client operations list: orders, shifts, payments)
*   `POST /sync/pull` (Sends updated cloud records since client's last sync checkpoint)
*   `POST /sync/ack` (Confirms client successfully applied pull records, updating device checkpoints)

### Database Tables
*   `device_sync_checkpoints` (Tracks device ID, table name, last successful sync version sequence ID, timestamp)

---

## 2. Reports Module

### Purpose
Compiles sales summaries, cost analyses, inventory valuation, and tax reports.

### Responsibilities
*   Runs optimized read-only queries against historical transaction logs.

### Endpoints
*   `GET /reports/sales-summary` (Sales summary grouped by category, payment method)
*   `GET /reports/inventory-valuation` (Inventory valuation using FIFO/FEFO costs)
*   `GET /reports/near-expiration` (Lists active batches expiring within 30 days)

---

## 3. Notifications Module

### Purpose
Sends alerts between KDS, waiters, and cashiers in real time.

### Responsibilities
*   Pushes events to active clients (via WebSockets or SSE when online).

### Database Tables
*   `system_notifications` (Stores notification UUID, recipient branch, recipient role, message, status [unread, read])
