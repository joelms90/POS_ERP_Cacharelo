# Data Model: Waiter and Cashier Application Screens

This document outlines the UI-facing models and runtime entities used to manage state on the waiter and cashier screens.

---

## 1. DiningZone

**Purpose**: Represents a physical area of the restaurant containing a collection of tables (e.g. Salón, Terraza).

**Fields**:
- `id`: String (e.g., "salon_principal").
- `name`: String (e.g., "Salón Principal").
- `tables`: List of `TableNode` models.

---

## 2. TableNode

**Purpose**: Represents a dining table on the coordinate-based floor plan layout.

**Fields**:
- `id`: String (stable identifier, maps to physical table label).
- `number`: Int (e.g., 3).
- `shape`: Enum (`circle`, `square`).
- `seatsCount`: Int (e.g., 4).
- `posX`: Double (normalized coordinates `0.0` to `1.0` on the zone layout).
- `posY`: Double (normalized coordinates `0.0` to `1.0` on the zone layout).
- `status`: Enum (`free`, `occupied`, `billing`, `cleaning`).
- `activeTransactionId`: Nullable UUID string of the active `LocalTransaction`.
- `elapsedMinutes`: Int (minutes since the first item was ordered).

---

## 3. CartSelection

**Purpose**: Temporary in-memory state of an order currently being placed by a waiter.

**Fields**:
- `tableId`: String.
- `items`: List of cart item rows.
- `specialInstructions`: String.

**Validation Rules**:
- Cannot be committed unless it contains at least 1 item.
- Modifiers must satisfy the selected product's modifier rules (e.g., maximum choice constraints).

---

## 4. UI SplitBillModel

**Purpose**: Represents a subset of an order split for checkout.

**Fields**:
- `originalTransactionId`: UUID string.
- `splitIndex`: Int.
- `selectedItemIds`: List of item identifiers.
- `calculatedSubtotal`: Double.
- `calculatedTax`: Double.
- `calculatedTotal`: Double.
- `paymentMethod`: Enum (`cash`, `card`).
- `paymentReference`: Nullable String.

**Validation Rules**:
- Checked payment reference is mandatory when `paymentMethod` is `card`.
