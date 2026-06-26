# 06: REST API Conventions & Error Handling

This document specifies the REST standards, request validation, and response envelope structures for all endpoints in the POS backend.

---

## 1. Global Response Envelope

All API responses (success and error) must return a consistent JSON envelope:

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 120
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request body failed input validation rules.",
    "details": [
      {
        "field": "pin",
        "issue": "pin must be exactly 4 digits long."
      }
    ],
    "timestamp": "2026-06-25T22:13:00Z"
  }
}
```

---

## 2. Query Standards (Pagination, Filtering, Sorting)

To keep query code simple for 1-2 developers:
*   **Pagination**: Handled via `page` and `limit` query parameters:
    *   Default `limit`: 50 items. Maximum `limit`: 200 items.
    *   Standard SQL offset logic: `offset = (page - 1) * limit`.
*   **Filtering**: Standard query filters are passed directly (e.g. `GET /products?categoryId=uuid`).
*   **Sorting**: Handled via `sortBy` (field name) and `sortOrder` (`ASC` or `DESC`):
    *   Example: `GET /orders?sortBy=created_at&sortOrder=DESC`.

---

## 3. Global Exception Filter (Error Codes Mapping)

The NestJS application must register a global `ExceptionFilter` to map standard Node/Nest exceptions to custom error codes:

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | Input payload validation failed (via `class-validator`). |
| `401 Unauthorized` | `UNAUTHORIZED` | Invalid or expired JWT access token. |
| `403 Forbidden` | `FORBIDDEN` | The user lacks permissions to perform this action. |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | The requested UUID does not exist. |
| `409 Conflict` | `VERSION_CONFLICT` | OCC version mismatch during concurrent updates. |
| `500 Server Error` | `INTERNAL_SERVER_ERROR` | Unhandled runtime exception in the codebase. |
