# Business Glossary

Use these terms consistently in screens, APIs, rules, and tests.

| Term | Meaning |
|---|---|
| Business | The tenant that owns its catalogue, stock, suppliers, and rules. |
| Branch / Sucursal | A sales location that may hold stock and request replenishment. |
| Warehouse / Bodega | A storage location, including the virtual **En Tránsito** location used during transfers. |
| Stock ledger | The immutable record of stock movements; the inventory source of truth. |
| Stock level | A location-level read model maintained from ledger movements. |
| Global stock | Sum of a product’s stock across all relevant locations in a business. |
| Branch threshold | Minimum/maximum stock configured for one product at one branch; it overrides the global product threshold. |
| Provider / Proveedor | A supplier business record. |
| Supplier product | A provider-specific product mapping, including cost and conversion factor. |
| Primary provider | The provider directly assigned to `products.providerId` for fast catalogue and alert workflows. |
| Purchase order (PO / OC) | A purchasing document, initially created as a draft for review. |
| Requisition | A request to replenish a branch from a warehouse or other inventory source. |
| KDS | Kitchen Display System: the preparation-ticket display. |
| KDS station | The declared category routing destination: Cocina, Barra, or no station. |
