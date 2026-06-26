# Modules: Inventory & Recipe Management

This document specifies the database representation, business rules, and structures for the movement-based inventory system and recipes.

---

## 1. Inventory Module

### Purpose
Maintains current stock levels across branches through auditable, movement-based records.

### Responsibilities
*   Computes current stock dynamically.
*   Enforces movement-only updates (stock values are never overwritten directly).

### Database Tables
*   `inventory_stocks` (Warehouse cache: branch ID, product ID, current_stock_qty, min_stock, max_stock)

---

## 2. Inventory Movements Module

### Purpose
Logs every physical stock change (purchase, sale, waste, transfer, adjustment) to ensure absolute traceability.

### Business Rules
*   Every stock change must be logged as a movement type:
    *   `purchase`: Stock increase from supplier receipt.
    *   `sale`: Stock decrease from customer checkout.
    *   `waste`: Stock decrease from expired or damaged items.
    *   `transfer`: Decreases stock in branch A and increases stock in branch B.
    *   `adjustment`: Physical audit correction.

### Database Tables
*   `inventory_movements` (Movement UUID, branch ID, product ID, type, quantity, reference_id, user_id, timestamp)

---

## 3. Inventory Batches Module

### Purpose
Tracks product delivery batches, supplier costs, and expiration dates.

### Business Rules
*   Every batch is linked to a product, has an explicit `expiration_date`, and follows the **FEFO** depletion policy.

### Database Tables
*   `inventory_batches` (Batch UUID, product ID, batch_number, cost_price, expiration_date, original_qty, remaining_qty)

---

## 4. Purchase Orders & Receipts Module

### Purpose
Manages raw material requests (Purchase Orders) and records supplier deliveries (Purchase Receipts).

### Business Rules
*   When a Purchase Receipt is verified, the system automatically:
    *   Increases inventory stocks in the branch.
    *   Creates new `inventory_batches` with cost and expiration dates.
    *   Logs an `inventory_movement` of type `purchase`.

### Database Tables
*   `purchase_orders` (Order UUID, supplier ID, branch ID, status [pending, completed], total_cost)
*   `purchase_receipts` (Receipt UUID, purchase_order_id, supplier_invoice_number, received_at)
*   `purchase_items` (Links products, quantities, costs, and expiration dates to orders/receipts)

---

## 5. Recipes Module

### Purpose
Defines the ingredients consumed during the preparation of menu items.

### Business Rules
*   Each recipe consists of multiple ingredient lines with specific quantities and units.
*   When a menu item is ordered and processed, the system recursively breaks down the recipe and deducts the corresponding ingredient quantities from active `inventory_batches` using the **FEFO** policy.
*   Recipes support version control (`version` column) and substitution ingredients (e.g. use Ingredient B if Ingredient A is out of stock).

### Database Tables
*   `recipes` (Recipe UUID, product_id [menu item], yield_quantity, yield_unit, version, active)
*   `recipe_ingredients` (Ingredient UUID, recipe_id, ingredient_product_id, quantity, unit, is_optional, substitution_product_id)
