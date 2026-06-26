# 00: Overview & Project Goals

## 1. Executive Summary
This document defines the Software Architecture Specification for the Point of Sale (POS) & Enterprise Resource Planning (ERP) backend system. The system is designed specifically for restaurants, cafeterias, and bars that require high-speed local checkout operations, offline robustness, kitchen workflow visibility, and cloud-synchronized enterprise administration.

---

## 2. Core Project Goals

*   **Offline-First Autonomy**: Waiters, kitchen displays, and cashier screens must remain fully functional during internet outages. Local clients read and write to local databases (e.g., Isar) and queue operations.
*   **Bidirectional Synchronization**: Automatically uploads queued operations (orders, checkouts, cash shifts) and downloads updated catalog details (menu, prices, table layouts) once internet connectivity is restored.
*   **Modular Monolith Architecture**: Decouples business logic into separate features (modules) to allow 1–2 developers to build, test, and deploy without microservice operational complexity, while preserving clean paths to decouple modules into standalone services in the future.
*   **Movement-Based Inventory**: Tracks ingredient inventory through explicit audit movements (sales, purchases, waste, transfers) rather than raw direct value updates.
*   **Batch & Expiration (FEFO) Support**: Ensures recipes deplete ingredients from inventory batches sorted by the earliest expiration date to control quality and reduce waste.
*   **Scalable Multi-Tenant Design**: Scaffolds business and branch models from Day 1 to support franchise chains, multi-branch operations, and multi-tenant setups without major database structure rewrites.

---

## 3. Core Domain Definitions

*   **Negocio (Business/Tenant)**: The top-level legal entity or brand (e.g., *Grupo Cacharelo*). Holds settings, master catalogs, and user directory.
*   **Sucursal (Branch)**: A physical location under a business (e.g., *Sucursal Reforma*). Maintains its own table layout, active cash drawer shifts, and local inventory stock.
*   **Turno de Caja (Cash Shift)**: An active period of cashier operations started by a float (fondo fijo) and closed by a Corte Z.
*   **Comanda (Order / Kitchen Ticket)**: A list of items requested for a table, routed to kitchen KDS screens or bar screens.
*   **Receta (Recipe)**: The bill of materials (BOM) linking a menu item to its constituent raw ingredients and quantity depletion rates.
*   **Lote / Batch**: A specific delivery of ingredients from a supplier with an expiration date and purchase cost.
