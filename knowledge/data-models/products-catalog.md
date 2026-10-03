---
type: "table"
title: "Products & Catalog Tables"
description: "Relational schema definitions for products, categories, branch overrides, recipes, and supplier pricing."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "schema"
  - "products"
  - "catalog"
  - "recipes"
  - "tables"
sources:
  - "apps/sync_api/src/database/schema.ts"
---

# Products & Catalog Tables

These tables model restaurant menu items, raw ingredients, supplier catalogs, and bills of materials (BOM).

---

## 1. `products`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Product identifier. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `category_id` | `uuid` | NO (FK) | Reference to `categories.id`. |
| `provider_id` | `uuid` | YES (FK) | Primary default supplier (`providers.id`). |
| `name` | `varchar(150)`| NO | Display product name. |
| `sku` | `varchar(50)` | YES | Stock keeping unit. |
| `barcode` | `varchar(50)` | YES | EAN/UPC barcode string. |
| `cost` | `decimal(10,2)`| NO | Purchase/manufacturing unit cost. |
| `price` | `decimal(10,2)`| NO | Standard customer retail price. |
| `price_wholesale`| `decimal(10,2)`| NO | Wholesale or bulk customer price. |
| `min_stock` | `decimal(12,3)`| NO | Default global minimum threshold. |
| `max_stock` | `decimal(12,3)`| NO | Default global maximum threshold. |
| `item_type` | `varchar(20)` | NO | `raw_material`, `wip`, `finished_good`, `service`. |
| `production_strategy`| `varchar(20)`| NO | `none`, `backflush`, `work_order`. |
| `uom` | `varchar(10)` | NO | `piece`, `kg`, `g`, `l`, `ml`. |
| `is_sellable` | `boolean` | NO | Available on POS menu screens. |
| `is_ingredient`| `boolean` | NO | Available in recipe bills of materials. |
| `is_active` | `boolean` | NO | Soft-enable flag for catalog display. |

---

## 2. `categories`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Category identifier. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `name` | `varchar(100)`| NO | Category name (e.g. "Bebidas", "Hamburguesas"). |
| `target_station`| `varchar(20)`| YES | KDS station: `cocina`, `barra`, or `null`. |

---

## 3. `branch_products` (Per-Branch Catalog Overrides)

Overrides whether a specific branch can sell an item (e.g., selling coffee beans at retail in one branch, or hiding alcohol from an airport kiosk).

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Row identifier. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `branch_id` | `uuid` | NO (FK) | Reference to `branches.id`. |
| `product_id` | `uuid` | NO (FK) | Reference to `products.id`. |
| `is_sellable` | `boolean` | NO | Branch-specific menu availability. |
| `is_active` | `boolean` | NO | Active state at branch. |

---

## 4. `recipes` (Bill of Materials / BOM)

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Recipe line identifier. |
| `parent_product_id` | `uuid` | NO (FK) | Finished good product ID. |
| `ingredient_product_id`| `uuid` | NO (FK) | Raw material or WIP ingredient product ID. |
| `quantity_needed` | `decimal(12,3)`| NO | Ingredient quantity required per unit produced. |
| `waste_percent` | `decimal(5,2)` | NO | Expected shrinkage/waste percentage. |
