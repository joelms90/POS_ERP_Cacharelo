# Business Rules Catalogue

This directory is the versioned source of truth for business rules that are
important enough to need shared understanding, test coverage, or traceability
across applications. It deliberately lives beside the code, not in a separate
document repository.

## What belongs here

A business rule is a declarative constraint or decision that can be evaluated
as true/false. Examples: “stock movements must be ledger-backed” and “a
category without a KDS station is not routed to KDS.”

Workflows are documented in feature specifications and describe *how* work is
performed. For example, “send an order to preparation” is a workflow that uses
the KDS routing rules.

Do not catalogue framework configuration, rendering details, retry behavior,
or other implementation mechanics unless they express a business constraint.

## Rule format

Use stable, domain-scoped IDs: `BR-KDS-001`, `BR-INV-001`, and `BR-PO-001`.
Never recycle an ID. A retired rule remains in the catalogue with its status
and replacement, so historical code, tests, and audit records remain readable.

Every rule contains:

- **Statement** — one declarative, testable sentence.
- **Scope and owner** — who decides it and where it applies.
- **Authority** — the backend module, database constraint, or service that
  makes the final decision.
- **Examples / verification** — acceptance examples and their automated-test
  location when available.
- **Implementation references** — only the decision boundaries that enforce
  the rule; do not annotate every implementation line.

## Traceability convention

Code and tests may reference a rule ID where a decision is made:

```ts
// BR-KDS-001: an explicit no-station category is excluded from KDS routing.
if (targetStation === null) return null;
```

Test names should include the ID when the test proves a rule:

```ts
it('BR-KDS-001 excludes a category without a KDS station', () => { /* ... */ });
```

The backend is authoritative for inventory, purchasing, KDS routing, and other
shared rules. Admin and POS clients can provide early validation, but must not
be their only enforcement.

## Change checklist

When a rule changes, update the rule entry, its examples/tests, all enforcing
decision boundaries, and any data migration or API contract affected. Review
the decision table when the rule belongs to a set of mutually exclusive inputs.

Start catalogue coverage with high-risk domains rather than attempting to tag
the entire codebase: inventory ledger, replenishment/purchasing, and KDS
routing are the initial set.

## Related documentation
- [Canonical OKF Business Rules Bundle](../../knowledge/business-rules/index.md)
- [Glossary](glossary.md)
- [KDS routing rules](kds-routing.md)
- [Inventory rules](inventory.md)
- [Purchasing rules](purchasing.md)
- [Inventory architecture](../../INVENTORY_ARCHITECTURE.md)
