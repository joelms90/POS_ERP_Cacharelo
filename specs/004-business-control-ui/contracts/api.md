# API Contracts: Sync API Admin Endpoints

This document outlines the JSON request/response payloads for the Express backend endpoints consumed by the Tauri Business Control app.

All endpoint paths are relative to the API base URL: `http://localhost:3000/api`.

---

## 1. POST `/auth/admin`

**Purpose**: Verifies the administrator password and returns a token for session authentication.

### Request Payload
```json
{
  "password": "admin123"
}
```

### Response (Success - 200 OK)
```json
{
  "success": true,
  "token": "admin123"
}
```

### Response (Failure - 401 Unauthorized)
```json
{
  "success": false,
  "error": "Contraseña de administrador incorrecta"
}
```

---

## 2. GET `/users`

**Purpose**: Retrieves the list of all registered employees.
**Headers**: `X-Admin-Token: <token>`

### Response (Success - 200 OK)
```json
[
  {
    "id": "e3b0c442-98fc-1c14-9afb-f4c530224153",
    "name": "Juan (Mesero)",
    "pin": "1111",
    "role": "waiter"
  },
  {
    "id": "f5d2c332-90fc-2b14-9dfb-f4c530224159",
    "name": "Sofia (Cajero)",
    "pin": "2222",
    "role": "cashier"
  }
]
```

### Response (Failure - 401 Unauthorized)
```json
{
  "error": "No autorizado. Se requiere contraseña de administrador."
}
```

---

## 3. POST `/users`

**Purpose**: Registers a new employee.
**Headers**: `X-Admin-Token: <token>`

### Request Payload
```json
{
  "name": "Sofía Castro",
  "pin": "4321",
  "role": "cashier"
}
```

### Response (Success - 201 Created)
```json
{
  "success": true,
  "user": {
    "id": "d7d1f9fb-a74c-47bb-a94f-561b369527fe",
    "name": "Sofía Castro",
    "pin": "4321",
    "role": "cashier"
  }
}
```

### Response (Failure - 400 Bad Request)
- Duplicate PIN:
```json
{
  "error": "Este PIN ya está asignado a otro usuario"
}
```
- Missing fields or invalid PIN format:
```json
{
  "error": "El PIN debe ser un número de exactamente 4 dígitos"
}
```

---

## 4. DELETE `/users/:id`

**Purpose**: Deletes (revokes access for) an employee.
**Headers**: `X-Admin-Token: <token>`

### Response (Success - 200 OK)
```json
{
  "success": true,
  "message": "Usuario eliminado correctamente"
}
```

### Response (Failure - 404 Not Found)
```json
{
  "error": "Usuario no encontrado"
}
```
