# Modules: Catalog & Business Entities

This document specifies the purpose, database schema representation, and rules for managing catalog items and entities.

---

## 1. Businesses Module

### Purpose
Represents the tenant/brand organization (e.g. *Grupo Cacharelo*). All data is partitioned under a Business ID.

### Responsibilities
*   Holds master billing configurations, tenant subscription details, and organizational metadata.

### Database Tables
*   `businesses` (Tenant UUID, name, tax identification code, active status)

---

## 2. Branches Module

### Purpose
Represents a physical establishment operating under a parent Business.

### Responsibilities
*   Maintains the active layout mapping (Tables, Rooms, Stations).
*   Manages distinct local inventory warehouses.

### Database Tables
*   `branches` (Branch UUID, business ID, name, address, phone number)
*   `branch_tables` (Physical layout mapping: table ID, label, capacity, room placement)

---

## 3. Customers Module

### Purpose
Manages customer profiles, loyalty points, and credit limits.

### Database Tables
*   `customers` (Customer UUID, name, email, phone, loyalty points, tax details)

---

## 4. Suppliers Module

### Purpose
Registers raw ingredient suppliers.

### Database Tables
*   `suppliers` (Supplier UUID, company name, contact person, phone, email, address)

---

## 5. Categories Module

### Purpose
Decouples catalog items into operational groupings (e.g. "Entradas", "Bebidas", "Postres").

### Database Tables
*   `categories` (Category UUID, business ID, name, description)

---

## 6. Products Module

### Purpose
Defines sellable items (dishes, canned drinks) and raw catalog ingredients.

### Business Rules
*   Items can be marked as `is_sellable` (menu item) or `is_ingredient` (raw stock item only).
*   Sellable items can link to a Recipe recipe map.

### Database Tables
*   `products` (Product UUID, business ID, category ID, name, sku, barcode, cost, price, is_sellable, is_ingredient)

---

## 7. Modifiers Module

### Purpose
Applies customization options to products during ordering (e.g., "Sin cebolla", "Extra queso").

### Business Rules
*   Modifiers are grouped (e.g., "Término de la carne", "Extras").
*   Modifiers can have an extra charge ($1.50 extra) and raw ingredient deduction rules.

### Database Tables
*   `modifier_groups` (Group UUID, product ID reference, label, min_selection, max_selection)
*   `modifiers` (Modifier UUID, group ID, name, price, ingredient_id, ingredient_qty)

---

## 8. Combos Module

### Purpose
Defines grouped bundles sold at a special price (e.g. "Combo Hamburguesa + Refresco").

### Database Tables
*   `combos` (Combo UUID, name, total_price)
*   `combo_items` (Links products and selectable variants to a combo)

---

## 9. Price Lists Module

### Purpose
Enables branch-specific pricing tiers (e.g. Delivery vs. Dine-in, or VIP events).

### Database Tables
*   `price_lists` (List UUID, business ID, name, active status)
*   `price_list_items` (Maps specific products to prices under a price list)

---

## 10. Taxes Module

### Purpose
Applies tax policies (IVA, IEPS) to product prices automatically.

### Database Tables
*   `taxes` (Tax UUID, name, percentage, active status)
*   `product_taxes` (Maps products to active tax policies)
