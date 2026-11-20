# Research: Active Sucursal in App Version Badge

## Decision: Reuse the terminal's cached branch name

**Rationale**: The POS application already loads the configured branch name into application state from local terminal configuration. Reusing it keeps the version area accurate offline and avoids a second source of truth.

**Alternatives considered**:

- Fetch the current branch from the server: rejected because a display-only label must remain available offline and would add latency/failure modes.
- Add a separate persisted preference: rejected because it could diverge from terminal assignment.

## Decision: Extend the shared version display rather than each header

**Rationale**: The version visual appears in several role screens. One reusable display rule provides consistent wording, visual treatment, accessibility, and responsive behavior.

**Alternatives considered**:

- Add independent labels to each dashboard: rejected because layouts and accessibility text would drift.

## Decision: Hide unavailable branch data

**Rationale**: Showing a placeholder creates false confidence about terminal assignment. Version-only output is clear during terminal setup or incomplete configuration.

**Alternatives considered**:

- Show “No sucursal”: rejected because setup screens should not imply a usable operational assignment.
