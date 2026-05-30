# Feature Specification: Grupo Cacharelo Landing Page

**Feature Branch**: `002-landing-page`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "now I want to create a landing page check this draft @[landing] I want to use vite and react to do it with typescipt and taiwlind doing atomic design pattern that will be deployed to gcloud"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explore Brand Identity & Brands (Priority: P1)

As a visitor, I want to experience the brand's cinematic "Empire Noir" atmosphere and explore the four core brands of Grupo Cacharelo, so that I understand their legacy and offering.

**Why this priority**: It establishes the brand identity and showcases the main product offerings, representing the core value proposition of the landing page.

**Independent Test**: A user can navigate to the landing page, view the hero section with its background, and see all four brand cards rendered with their respective visual styles and text descriptions.

**Acceptance Scenarios**:

1. **Given** a visitor lands on the homepage, **When** they view the page, **Then** they experience a deep black background (#0B0B0C), Champagne Gold (#D4AF37) branding, and typographic hierarchy utilizing Bodoni Moda and Inter.
2. **Given** the page is loaded, **When** the visitor scrolls to the "Nuestras Marcas" section, **Then** they see four cards (Pastes y Empanadas, Las Hamburguesas, El Sabor de Antaño, La Excelencia) with thin-stroke icons and bronze-toned borders that transition to gold on hover.

---

### User Story 2 - Interactive Territories & Operations (Priority: P2)

As a visitor, I want to view operational locations, their days, and hours of operations on an interactive map layout, filtered by brands, so that I know where and when I can access Grupo Cacharelo's brands.

**Why this priority**: Helps prospective customers and partners identify physical availability, enhancing utility beyond static marketing.

**Independent Test**: The user can click through the "Todos", "Pastes", "Hamburguesas", "El Sabor de Antaño", and "La Excelencia" tabs, seeing different locations and map representations load correctly.

**Acceptance Scenarios**:

1. **Given** a user is viewing the "LOS TERRITORIOS Y OPERACIONES" section, **When** they click different brand tabs, **Then** the map marker positions and the list of "Puntos de operación" update dynamically to display only the branches offering the selected brand.
2. **Given** the map is displayed, **When** a user clicks a map location pin, **Then** a detailed popup showing the location name, address, working days (e.g. "Lunes a Domingo"), working hours (e.g. "7:00 am - 18:00 pm"), and a "Cómo llegar" Google Maps button becomes visible.

---

### User Story 3 - Suggestions, Complaints & Contact Channels (Priority: P3)

As a visitor or customer, I want to submit inquiries, suggestions, or complaints via a secure contact form and access WhatsApp support, so that I can establish contact immediately.

**Why this priority**: Connects interested users and customers directly with corporate support and provides a structured channel for suggestions/complaints.

**Independent Test**: A user submits the suggestions form. Verify it handles inputs correctly, displays success states, and saves to Firestore.

**Acceptance Scenarios**:

1. **Given** a user wants to submit feedback, **When** they fill the contact form and hit submit, **Then** the message is securely posted to the backend GCF and stored in Firestore.
2. **Given** a user is browsing on mobile or desktop, **When** they click the floating chat button, **Then** they are redirected to a WhatsApp chat channel pre-configured for Grupo Cacharelo support.

---

### Edge Cases

- **No GPS/Map Loading Errors**: If the map layer or images fail to load due to network connection issues, how does the layout degrade? (System MUST display a bronze-themed placeholder or fallback static list).
- **Responsive Layout Collapsing**: On screens smaller than 360px width, does the navigation layout collapse gracefully? (System MUST collapse menu links to a mobile drawer).
- **Tab Switching Speed**: Rapidly tapping tabs should not cause layout shifting or flickering.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render the application using the "Empire Noir" design system (Obsidian backgrounds, Champagne Gold accents, Aged Bronze outlines, Bodoni Moda headers, Inter body text).
- **FR-002**: The application MUST feature a responsive navigation header containing links to Brand, Territories, and Contact, collapsing to a mobile menu toggle on small viewports.
- **FR-003**: The application MUST display a hero section with high-contrast cinematic overlay and primary/secondary call-to-action buttons.
- **FR-004**: The system MUST implement an interactive Tab switcher for the "LOS TERRITORIOS Y OPERACIONES" section with tabs: "Todos", "Pastes", "Hamburguesas", "El Sabor de Antaño", and "La Excelencia".
- **FR-005**: The system MUST render an interactive map component with custom styled pins that display detail popups on click.
- **FR-006**: The system MUST implement a dynamic locations list that highlights the active location when its corresponding list item or map pin is clicked.
- **FR-007**: The system MUST provide accessible direct communication links for WhatsApp channel.
- **FR-008**: The deployment configuration MUST support hosting the landing page on Google Cloud Platform using Google Cloud Storage for static website hosting.
- **FR-009**: The system MUST handle user inquiries, complaints, and suggestions via a fully functional contact form that posts submission data to a Google Cloud Function backend.
- **FR-010**: The map component MUST render location data using Leaflet and OpenStreetMap, styled with CartoDB Dark Matter tiles to match the Empire Noir theme without requiring external API keys.
- **FR-011**: The system MUST load location dataset records from a local JSON file (`src/data/locations.json`) to allow easy configuration of points of operation.

### Key Entities

- **Brand**: Represents a subsidiary brand (e.g. Pastes y Empanadas, Las Hamburguesas) with attributes like name, tagline, icon, and detail description.
- **Location**: Represents an operational branch or transit hub, including name, coordinates (latitude/longitude), address, phone number, workingHours, workingDays, and brand associations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Page loads and becomes interactive (Largest Contentful Paint) in under 1.5 seconds under a simulated 3G connection.
- **SC-002**: The page achieves a 95+ score on Lighthouse Accessibility audits.
- **SC-003**: 100% of links, buttons, and tab switchers are fully accessible via keyboard navigation.
- **SC-004**: The user experience on mobile devices (down to 320px width) maintains visual hierarchy and avoids horizontal overflow.

## Assumptions

- **A-001**: The asset images provided in the draft (e.g. espresso/empanada hero image, stylized city map) are approved for initial implementation.
- **A-002**: Localization is initially in Spanish, as depicted in the draft copy.
- **A-003**: The landing page does not require a customer login system or database backend for content management in version 1.

