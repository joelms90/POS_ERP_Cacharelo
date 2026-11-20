# Version Badge UI Contract

## Inputs

| Input | Required | Behavior |
|---|---|---|
| Application version | Yes | Display in the compact version area. |
| Active sucursal name | No | Display alongside the version only when it is available and non-empty. |

## Output Rules

- The displayed location identifies the terminal's configured sucursal.
- The version remains visible if no sucursal is available.
- Long visible location text must not force header overflow.
- Assistive technology receives the complete version and sucursal context.

## Non-Goals

- Selecting or changing a sucursal.
- Loading a sucursal from the network.
- Altering transaction, inventory, or sync scope.
