# ADR-006: First Expired, First Out (FEFO) Inventory Strategy

## Status
Accepted

## Context
Restaurants and cafeterias handle perishable ingredients (milk, meats, vegetables, bakery items). Using standard FIFO (First In, First Out) does not account for expiration dates, which can result in waste, health policy violations, or selling expired products if batches are received out of chronological order.

## Decision
We enforce a **First Expired, First Out (FEFO)** strategy for all inventory deduction and batch tracking.

## Rationale
1. **Perishability Control**: Ingredients are linked to an `InventoryBatch` containing an explicit `expiration_date`. When a product or recipe is prepared, the stock deduction query automatically prioritizes depletion from active batches with the earliest expiration date.
2. **Cost Accuracy**: Tracks actual batch costs, allowing precise calculation of gross margins using real purchase costs.
3. **Traceability**: If an ingredient is contaminated, the system can trace which batch was used in specific orders, enabling target recalls.

## Consequences
* Every inventory receipt must log the expiration date and batch number of products.
* Nested recipes must query active batches sorted by expiration date to calculate current yield and cost.
