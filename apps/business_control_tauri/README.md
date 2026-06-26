# Cacharelo Consola de Administración (Tauri Webview Client)

Este subproyecto es la consola de administración de escritorio del sistema POS-ERP de **Cacharelo**, construida en **Tauri v2 + React 19 + TypeScript + Vite**. Consume la API REST del backend (`apps/sync_api`) para la gestión de usuarios (PINs) y el monitoreo de conectividad del sistema.

## 🛠️ Requisitos de Desarrollo

Para ejecutar y compilar este proyecto, necesitas:
- **Node.js**: v20 o superior.
- **PNPM**: Gestor de paquetes recomendado.
- **Rust / Cargo**: Compilador nativo de Rust (requerido para empaquetar Tauri).
- **Herramientas de compilación de OS**:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
  - **Windows**: Visual Studio Build Tools con la opción de desarrollo de C++ instalada.

---

## 🎨 Paleta de Diseño: "Empire Noir"

El diseño visual del panel sigue la guía de estilo unificada del ecosistema POS:
- **Fondo Base**: Obsidian (`#0B0B0C`)
- **Paneles y Tarjetas**: Onyx (`#121214`) y Charcoal (`#1E1E22`)
- **Accentos e Interactivos**: Champagne Gold (`#D4AF37`) y Champagne Gold Light (`#E5C158`)
- **Bordes e Hilos**: Aged Bronze (`#8C7853`) y Aged Bronze Dark (`#5A4E36`)
- **Tipografías**: *Bodoni Moda* (para encabezados de marca) e *Inter* (para controles y datos de interfaz).

---

## 📂 Organización de Código (Atomic Strategy)

```text
src/
├── components/
│   ├── atoms/          # Componentes puros de estilo (Button, Input, Badge, Heading)
│   ├── molecules/      # Componentes combinados (FormField, StatusIndicator, ToastNotification)
│   ├── organisms/      # Módulos de lógica (LoginForm, UserForm, UsersGrid)
│   └── templates/      # Envolturas de pantallas (AdminLayout)
├── context/
│   └── AuthContext.tsx # Contexto global de sesión administrativa
├── hooks/
│   └── useAuth.ts      # Atajo para hooks de sesión
├── pages/
│   ├── LoginPage.tsx   # Pantalla de bloqueo de credenciales
│   └── DashboardPage.tsx # Panel de control de personal y salud
├── services/
│   └── api.ts          # Cliente REST para llamadas al backend NestJS
├── index.css           # Directivas Tailwind v4 y animaciones CSS
└── main.tsx            # Punto de entrada de React con cargadores globales
```

---

## 🚀 Comandos Rápidos

Asegúrate de estar en el directorio raíz del espacio de trabajo o directamente en este subproyecto:

### 1. Instalar Dependencias
```bash
pnpm install
```

### 2. Levantar Entorno de Desarrollo (Hot Reload)
Tauri levantará una ventana nativa de escritorio que se recargará automáticamente al editar el código web:
```bash
pnpm tauri dev
```

### 3. Compilar Todo (TypeScript + Vite Bundling)
Valida que todos los archivos web estén libres de errores de tipos antes del empaquetado final:
```bash
pnpm build
```

### 4. Compilar Paquete Nativo de Escritorio (Producción)
Compila el ejecutable nativo (ej. `.app` para macOS, o `.msi`/`.exe` para Windows):
```bash
pnpm tauri build
```

---

## 🔒 Seguridad e Integración API

- **Token Administrativo**: La consola envía la cabecera `X-Admin-Token` en cada llamada a la API protegida del roster.
- **Configuración de Host**: El cliente lee la variable de entorno `VITE_API_URL` para conectarse con el servidor de sincronización. Si no se provee, usará el fallback predeterminado de `http://localhost:3000/api`.
