---
type: "concept"
title: "POS-ERP Business & Technical Glossary"
description: "Canonical definitions and standard terminology used across frontends, backend, database models, and documentation."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "glossary"
  - "terminology"
  - "concepts"
---

# POS-ERP Business & Technical Glossary

Use these definitions consistently across UI text, code variables, API contracts, database schemas, and developer discussions.

| Term | Meaning |
| :--- | :--- |
| **Business (Empresa/Negocio)** | The top-level multi-tenant entity that owns its catalog, locations, users, and business settings. |
| **Branch (Sucursal)** | A physical store or restaurant location where point-of-sale transactions and customer dining occur. |
| **Warehouse (Almacén/Bodega)** | A physical or virtual storage location that holds raw materials, WIP, or finished goods inventory. |
| **En Tránsito (Transit Warehouse)** | A virtual warehouse used to hold inventory while moving between an origin and destination location. |
| **Stock Ledger (`stock_ledger`)** | The immutable, append-only journal of all physical stock movements. Single source of inventory truth. |
| **Stock Level (`stock_levels`)** | A read model/cache representing current on-hand quantity per product and location, derived from ledger sums. |
| **Global Stock** | The aggregated inventory count of a product across all warehouses and branches within a business tenant. |
| **Branch Threshold (`branch_stock_thresholds`)** | Minimum and maximum stock quantities configured for a specific product at a specific branch; overrides global thresholds. |
| **Global Threshold (`products.minStock/maxStock`)** | Default business-wide inventory minimum and maximum levels for a product. |
| **Purchase Order (PO / Orden de Compra)** | A legal procurement document issued to external suppliers, initialized in `draft` status for operator approval. |
| **Branch Requisition (Requisición)** | An internal replenishment request submitted by a branch operator requesting stock from a warehouse. |
| **Stock Transfer (Traspaso)** | The physical shipment of goods from an origin location to a destination location via transit. |
| **Kitchen Display System (KDS)** | Digital order display screen in food preparation areas showing live tickets sorted by time and urgency. |
| **Target Station (`target_station`)** | Category classification determining where order items route: `cocina` (kitchen), `barra` (bar), or `null` (no station). |
| **Corte X (X-Report)** | Partial cashier shift audit summarizing current cash drawer balance, card totals, and expected amounts without closing the shift. |
| **Corte Z (Z-Report)** | Final end-of-shift closing audit that records counted physical cash denominations, registers discrepancies, and closes the drawer. |
| **Work Order / Production Run (OP)** | A manufacturing assembly process that converts raw material ingredients into finished food or batch items according to a recipe (BOM). |
