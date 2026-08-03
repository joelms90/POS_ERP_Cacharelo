# Feature Specification: Purchase Orders & Inventory Requisitions Module

**Feature Branch**: `011-purchase-orders-requisitions`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Purchase Orders & Inventory Requisitions Module"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Purchase Order Creation & Supplier Management (Priority: P1)

Inventory administrators can create and manage Purchase Orders (Órdenes de Compra) to formally request stock from providers.

**Why this priority**: Foundational requirement for tracking supplier purchases and expected inventory arrivals.

**Independent Test**: Can be tested by creating a Purchase Order for a specific provider and product, saving it as a draft, updating it, and marking it as "sent" to the supplier.

**Acceptance Scenarios**:
1. **Given** a registered provider and products in the catalog, **When** the inventory admin creates a purchase order with estimated costs and quantities, **Then** the system saves it in `draft` status and generates a unique PO number (e.g., OC-0001).
2. **Given** a draft purchase order, **When** the admin reviews and marks it as sent, **Then** the status transitions to `sent`, and it becomes read-only (except for notes and expected delivery date).

---

### User Story 2 - Inventory Reception & Average Cost Recalculation (Priority: P1)

When orders arrive at the warehouse, the warehouse operator retrieves the Purchase Order, adjusts the actual quantities received and unit costs, and the system updates the average cost of the product.

**Why this priority**: Critical for accurate stock levels, financial tracking, and correct calculation of margins based on average costs.

**Independent Test**: Can be tested by receiving a PO with a unit cost different from the current product cost, and verifying that the product cost is updated to the weighted average cost.

**Acceptance Scenarios**:
1. **Given** a purchase order in `sent` status, **When** the shipment arrives at the warehouse, the operator retrieves the PO, enters the actual quantities received (which can differ from ordered), and inputs the actual unit cost.
2. **Given** actual received quantities and costs, **When** the operator completes the reception, **Then** the system:
   - Increments the stock levels at the destination warehouse/branch.
   - Calculates the new average cost: `New Cost = (Current Stock * Current Cost + Received Qty * Actual Cost) / (Current Stock + Received Qty)`.
   - Updates `products.cost` with the new average cost.
   - Logs `inventory_movements` with type `receipt`.
   - Transitions the PO status to `received` (or `partially_received` if some items are missing).
3. **Given** incorrect or defective items in the shipment, **When** the operator specifies a rejection or returns, **Then** the system marks those specific items as cancelled/returned, doesn't increment stock for them, and logs the return details.

---

### User Story 3 - Branch Requisitions & Transfer Workflow (Priority: P2)

Branches (e.g., Chef or kitchen staff) can request stock from the warehouse. The warehouse can approve, reject, or place requests in standby before executing the physical transfer.

**Why this priority**: Required to coordinate stock distribution between central warehouses and retail branches, preventing unauthorized stock depletion.

**Independent Test**: Can be tested by creating a branch requisition, moving it through approval and standby states, and executing the final stock transfer.

**Acceptance Scenarios**:
1. **Given** a branch user, **When** they create a requisition for a list of products from a warehouse, **Then** a requisition is created in `pending_approval` status.
2. **Given** a pending requisition, **When** the warehouse manager reviews it, **Then** they can:
   - **Accept** it: Transitions status to `approved` and creates a `stock_transfers` record in `pending` status.
   - **Reject** it: Transitions status to `rejected` with rejection notes.
   - **Stand-by**: Transitions status to `standby` for later review.
3. **Given** an approved transfer, **When** the transfer is completed, **Then** the system decrements stock at the origin warehouse, increments stock at the destination branch, and logs the corresponding `inventory_movements` (`transfer_out` and `transfer_in`).

---

### Edge Cases

- **Negative Stock Levels**: What happens when the formula recalculates average cost but the current stock is negative or zero?
  - *Resolution*: If current stock is <= 0, the new average cost defaults to the actual receipt unit cost.
- **Cost Increases on Pending Transfers**: If the average cost of a product changes while a stock transfer is pending, does the transfer item unit cost update?
  - *Resolution*: Stock transfers use the product's average cost at the exact moment the transfer is completed/dispatched.
- **Offline Mode during Requisitions**: Can a branch create a requisition offline?
  - *Resolution*: Yes, requisitions can be created offline on the POS terminal. They are queued as local sync operations and synced as `pending_approval` once the connection is restored.
- **Partial Requisition Approvals**: Can a warehouse manager approve only a partial quantity of a requisition?
  - *Resolution*: Yes, the manager can adjust the approved quantities before acceptance. The remaining quantity is marked as cancelled or left in standby.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support creating Purchase Orders with a unique autogenerated number, associated provider, destination (warehouse/branch), and list of items (product, ordered quantity, estimated unit cost).
- **FR-002**: System MUST support Purchase Order statuses: `draft`, `sent`, `partially_received`, `received`, and `cancelled`.
- **FR-003**: System MUST support registering an inventory reception linked to a Purchase Order, allowing adjustment of received quantities and actual unit costs.
- **FR-004**: System MUST recalculate the weighted average cost of a product upon completing a reception and update the `products.cost` field.
- **FR-005**: System MUST log all receptions as `receipt` inventory movements and all transfers as `transfer_out`/`transfer_in` inventory movements in `inventory_movements`.
- **FR-006**: System MUST support creating Branch Requisitions with status: `pending_approval`, `approved`, `standby`, `rejected`, and `completed`.
- **FR-007**: System MUST allow warehouse managers to approve, reject, or place requisitions in standby, and automatically generate stock transfers for approved items.
- **FR-008**: System MUST support offline creation of requisitions on POS terminals, syncing them to the server when connection is re-established.

### Key Entities *(include if feature involves data)*

- **PurchaseOrder**: Represents a purchase request to a supplier. Attributes: `id`, `businessId`, `providerId`, `warehouseId`, `branchId`, `poNumber`, `status`, `orderDate`, `expectedDeliveryDate`, `actualDeliveryDate`, `subtotal`, `tax`, `total`, `notes`.
- **PurchaseOrderItem**: A line item in a Purchase Order. Attributes: `id`, `poId`, `productId`, `quantityOrdered`, `quantityReceived`, `unitCostEstimated`, `unitCostActual`.
- **BranchRequisition**: Represents a request for inventory from a branch to a warehouse. Attributes: `id`, `businessId`, `fromBranchId`, `toWarehouseId`, `status`, `notes`, `createdById`, `createdAt`.
- **BranchRequisitionItem**: A line item in a requisition. Attributes: `id`, `requisitionId`, `productId`, `quantityRequested`, `quantityApproved`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Warehouse operators can process a purchase order reception and update stock levels in under 3 clicks once the PO is retrieved.
- **SC-002**: Average cost calculations must be accurate to 2 decimal places and reflect immediately in the product catalog upon reception.
- **SC-003**: Requisitions created on the POS while offline must successfully sync within 10 seconds of network reconnection.
- **SC-004**: 100% of inventory receipts and transfers must generate corresponding entries in `inventory_movements` for audit compliance.

## Assumptions

- **A-001**: Average cost is business-wide (or per warehouse/branch if multi-location average cost is desired). Default is business-wide since `products.cost` is currently a single field on the `products` table.
- **A-002**: The POS terminal only needs to create requisitions (not approve them). Approvals are handled by the Business Control Web Admin portal.
- **A-003**: Requisition and purchase order workflows will reuse the existing `providers`, `products`, `warehouses`, and `branches` tables.
