# Feature Specification: Active Sucursal in App Version Badge

**Feature Branch**: `017-sucursal-version`  
**Created**: 2026-11-20  
**Status**: Draft  
**Input**: User description: "Show the active sucursal beside the Flutter POS application version wherever the configured terminal shows the version badge."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identify the Active Sucursal (Priority: P1)

As a POS operator, I can see the sucursal assigned to the terminal next to the displayed application version so I can immediately confirm that I am working in the correct location.

**Why this priority**: Operating in the wrong sucursal can affect inventory, sales, and requisitions. The branch identity must be visible without navigating away from the current screen.

**Independent Test**: Configure a terminal for a known sucursal and open each supported role dashboard; the visible version area identifies that sucursal.

**Acceptance Scenarios**:

1. **Given** a terminal is configured for a sucursal, **When** an operator opens a screen that displays the application version, **Then** the same visual area also identifies the configured sucursal.
2. **Given** the terminal configuration changes to another sucursal, **When** the version area is next displayed, **Then** it identifies the newly configured sucursal rather than the prior one.

---

### User Story 2 - Preserve Setup and Compact Layouts (Priority: P2)

As an operator setting up a terminal or using a narrow device, I can still read the application version without the branch label causing confusion or header overflow.

**Why this priority**: A terminal may not yet be assigned to a sucursal, and POS headers must remain usable on compact displays.

**Independent Test**: Open the setup state and narrow-width role dashboards; confirm the version remains visible and no incorrect or clipped branch information is shown.

**Acceptance Scenarios**:

1. **Given** a terminal has no sucursal assignment, **When** the application version is displayed, **Then** no branch label or placeholder is shown.
2. **Given** a configured sucursal has a long name on a narrow screen, **When** the version area is displayed, **Then** the header remains usable and does not overflow horizontally.

---

### User Story 3 - Accessible Location Context (Priority: P3)

As an operator using assistive technology, I can identify both the application version and active sucursal from the version area.

**Why this priority**: Location context must not depend only on visual decoration or an icon.

**Independent Test**: Inspect the version area with accessibility semantics enabled and confirm that the full sucursal name and version can be identified.

**Acceptance Scenarios**:

1. **Given** a configured terminal, **When** assistive technology focuses the version area, **Then** it exposes the full application version and sucursal name.

### Edge Cases

- A sucursal name is missing, blank, or contains only whitespace: show the version without a branch label.
- A sucursal name is too long for the available header width: keep the layout within the viewport while preserving access to the complete name.
- A role dashboard is opened before terminal configuration finishes loading: do not show stale or placeholder location data.
- The terminal is reconfigured while the application remains open: the next rendered version area reflects the active configuration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display the active configured sucursal alongside the application version on every configured POS screen that currently displays the version.
- **FR-002**: The displayed sucursal MUST be the branch assigned to the current terminal configuration.
- **FR-003**: The system MUST omit the sucursal portion when the terminal is unconfigured or its branch name is unavailable.
- **FR-004**: The version-and-sucursal area MUST remain visually usable at supported narrow and wide viewport sizes without horizontal overflow.
- **FR-005**: The full sucursal name and application version MUST be available to assistive technology, including when the visible branch text is shortened for layout.
- **FR-006**: The feature MUST not require network access to display a sucursal already stored in terminal configuration.
- **FR-007**: The feature MUST not change which sucursal a terminal is assigned to or alter any transaction, inventory, or synchronization behavior.

### Key Entities

- **Terminal configuration**: The locally retained assignment that identifies the business and sucursal used by the POS terminal.
- **Sucursal display name**: The human-readable name of the terminal's assigned sucursal.
- **Application version area**: The compact, reusable visual area that communicates the installed POS version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In configured terminal states, 100% of supported POS screens that show the version also show the assigned sucursal.
- **SC-002**: In unconfigured terminal states, 100% of version displays omit a branch label rather than showing an empty or incorrect location.
- **SC-003**: At supported narrow and desktop viewport sizes, the relevant headers render without horizontal overflow.
- **SC-004**: An accessibility inspection identifies both the application version and full sucursal name for a configured terminal.
- **SC-005**: The sucursal label is available immediately after local terminal configuration loads, without requiring a network request.

## Assumptions

- The terminal configuration already contains the current sucursal name and keeps it available offline.
- The existing application-version area is the intended common location for this context across role dashboards.
- This feature is limited to displaying terminal context; it does not add a sucursal selector or change authorization scope.
