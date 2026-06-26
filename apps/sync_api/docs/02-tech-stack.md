# 02: Technology Stack & Technical Rationale

This document details the selected technologies for the POS backend and the architectural reasons behind each choice.

---

## 1. Core Framework & Language

*   **Node.js LTS (v20+)**: Selected for its extensive ecosystem, performance, and stability.
*   **TypeScript (v5+)**: Enforces compile-time type-safety across DTOs, controllers, services, and database models.
*   **NestJS (v10+)**:
    *   *Why*: Provides an opinionated structure (Dependency Injection, Controllers, Providers, Modules, Guards) that ensures code consistency for small teams.
    *   *Comparison*: Traditional Express projects easily degrade into unstructured files. NestJS provides the structure of enterprise frameworks while running on top of Node.js.

---

## 2. Database & Storage

*   **PostgreSQL**:
    *   *Why*: Unmatched ACID transaction reliability, JSONB columns for flexible syncing metadata, native partitioning for scaling audit logs, and strong standard compliance.
*   **Drizzle ORM**:
    *   *Why*: A lightweight, typescript-first SQL tool. It represents database tables as direct TypeScript schemas.
    *   *Comparison*: Heavy ORMs (Prisma, TypeORM) introduce performance overhead and construct unoptimized SQL queries for complex joins. Drizzle acts as type-safe SQL, keeping developers close to database reality.
*   **Google Cloud SQL (PostgreSQL)**: Fully managed, highly available database engine in GCP with automatic backups and scaling capabilities.
*   **Google Cloud Storage (GCS)**: Used to store static assets such as product menu images, backup database dumps, and exported reports.

---

## 3. Communication, Authentication & Tooling

*   **REST API / OpenAPI (Swagger)**:
    *   *Why*: Highly standard, easily consumed by mobile (Flutter) clients, and natively supported in NestJS. Swagger generates interactive documentation directly from NestJS annotations, keeping documentation synchronized with the code.
*   **JWT (JSON Web Tokens)**:
    *   *Why*: Stateless authorization. Enables tablets to make authenticated API requests without requiring the server to lookup sessions in the database for every single sync packet.
*   **Jest**: The standard testing framework for NestJS, used for unit and integration testing.
*   **Docker**: Standardizes runtime environments between local development (Mac/Windows) and Google Cloud Run containers.
*   **npm**: Native package manager for Node.js.

---

## 4. Technology Matrix & Versioning

| Component | Technology | Version / Spec |
| :--- | :--- | :--- |
| Runtime | Node.js | LTS (20.x or 22.x) |
| Language | TypeScript | 5.x |
| Framework | NestJS | 10.x |
| Database | PostgreSQL | 15.x / 16.x |
| ORM | Drizzle ORM | Latest Stable |
| Sync API | REST | OpenAPI 3.0 |
| Auth | JWT | HS256 / RS256 |
| Container | Docker | Multi-stage |
