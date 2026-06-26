# ADR-001: Adoption of NestJS for POS Backend

## Status
Accepted

## Context
The POS system is a mission-critical backend that handles user management, cashier shifts, catalog syncing, and offline client synchronization. The backend must be maintainable by a small team (1-2 developers) while ensuring clean separation of concerns, easy testing, and clear coding standards. Express (which the prototype uses) lacks built-in architecture conventions, leading to maintainability issues as the codebase grows.

## Decision
We will adopt **NestJS** as the main backend framework. NestJS provides an out-of-the-box modular architecture, solid dependency injection, and a strongly opinionated design pattern based on Angular concepts.

## Rationale
1. **Out-of-the-box Structure**: NestJS enforces modular structures (`@Module`), controllers, and services. This aligns perfectly with our "Modular Monolith" approach.
2. **Dependency Injection**: Facilitates writing unit tests and mock replacements for testing features like synchronization and printing.
3. **TypeScript First**: NestJS is built with TypeScript natively, ensuring type safety from DTO schemas down to database repositories.
4. **Active Ecosystem**: It integrates smoothly with OpenAPI (Swagger) and Jest, keeping toolchain overhead low.

## Consequences
* Developer onboarding requires understanding NestJS modules, providers, guards, and interceptors.
* Slightly higher boilerplate code compared to pure Express, but highly offset by long-term consistency.
