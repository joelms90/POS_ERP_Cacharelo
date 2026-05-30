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

As a visitor, I want to view operational locations and 24-hour schedules on a tabbed, interactive layout, so that I know where and when I can access Grupo Cacharelo's brands.

**Why this priority**: Helps prospective customers and franchise partners identify physical availability, enhancing utility beyond static marketing.

**Independent Test**: The user can click through the "En La Ciudad", "En Tránsito", and "Operaciones 24 Horas" tabs, seeing different locations and map representations load correctly.

**Acceptance Scenarios**:

1. **Given** a user is viewing the "Los Territorios" section, **When** they click different tabs, **Then** the map marker positions and the list of "Puntos de Operación" update dynamically to match the selected category.
2. **Given** the map is displayed, **When** a user hovers over a map location pin, **Then** a detailed tooltip/card showing the location name and office details (e.g. "Sucursal Reforma") becomes visible.

---

### User Story 3 - Safe Line & Contact Channels (Priority: P3)

As a visitor or franchise prospect, I want to access official communication channels, such as a direct phone line ("Línea Segura"), office numbers, and WhatsApp, so that I can establish contact immediately.

**Why this priority**: Connects interested users directly with corporate office support, security reporting, or franchise inquiries.

**Independent Test**: A user clicks on the "Línea Segura" number or the floating WhatsApp button and is prompted to call or message the official channels.

**Acceptance Scenarios**:

1. **Given** a user wants to contact the business, **When** they tap the large "Línea Segura" number, **Then** their device initiates a phone call to `55 9244 9939`.
2. **Given** a user is browsing on mobile or desktop, **When** they click the floating chat button, **Then** they are redirected to a chat channel (WhatsApp) pre-configured for Grupo Cacharelo support.

---

### Edge Cases

- **No GPS/Map Loading Errors**: If the map layer or images fail to load due to network connection issues, how does the layout degrade? (System MUST display a bronze-themed placeholder or fallback static list).
- **Responsive Layout Collapsing**: On screens smaller than 360px width, does the navigation layout collapse gracefully? (System MUST collapse menu links to a mobile drawer).
- **Tab Switching Speed**: Rapidly tapping tabs should not cause layout shifting or flickering.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render the application using the "Empire Noir" design system (Obsidian backgrounds, Champagne Gold accents, Aged Bronze outlines, Bodoni Moda headers, Inter body text).
- **FR-002**: The application MUST feature a responsive navigation header containing links to Brand, Territories, Línea Segura, and Contact, collapsing to a mobile menu toggle on small viewports.
- **FR-003**: The application MUST display a hero section with high-contrast cinematic overlay and primary/secondary call-to-action buttons.
- **FR-004**: The system MUST implement an interactive Tab switcher for the "Los Territorios" section with three tabs: "En La Ciudad", "En Tránsito", and "Operaciones 24 Horas".
- **FR-005**: The system MUST render an interactive map component with custom styled pins that display detail tooltips on hover or click.
- **FR-006**: The system MUST implement a dynamic locations list that highlights the active location when its corresponding map pin is clicked/hovered.
- **FR-007**: The system MUST provide accessible direct communication links for telephone and WhatsApp channels.
- **FR-008**: The deployment configuration MUST support hosting the landing page on Google Cloud Platform using Google Cloud Storage for static website hosting.
- **FR-009**: The system MUST handle user inquiries via a fully functional contact form that posts submission data to a simple Google Cloud Function backend.
- **FR-010**: The map component MUST render location data using Leaflet and OpenStreetMap, styled with CartoDB Dark Matter tiles to match the Empire Noir theme without requiring external API keys.

### Key Entities

- **Brand**: Represents a subsidiary brand (e.g. Pastes y Empanadas, Las Hamburguesas) with attributes like name, tagline, icon, and detail description.
- **Location**: Represents an operational branch or transit hub, including name, coordinates (latitude/longitude), address, phone number, category (City, Transit, 24 Hours), and operating hours.

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
