---
type: "architecture"
title: "Model Context Protocol (MCP) Server Architecture"
description: "Architecture of the POS-ERP Model Context Protocol server exposing ERP domain capabilities, tools, and read models to AI agents."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "mcp"
  - "ai-agents"
  - "tools"
  - "architecture"
sources:
  - "apps/mcp_server/README.md"
  - "apps/mcp_server/package.json"
---

# Model Context Protocol (MCP) Server Architecture

The **POS-ERP MCP Server** (`apps/mcp_server`) exposes the business logic and database queries of the POS-ERP ecosystem to AI assistants and autonomous coding agents using the open **Model Context Protocol (MCP)**.

---

## 1. Protocol Architecture & Connection

- **Transport**: Standard Input/Output (`stdio`) JSON-RPC messaging conforming to `@modelcontextprotocol/sdk`.
- **Target Environments**: Cursor IDE, Claude Desktop, Antigravity CLI, Windsurf, or automated conversational agents.
- **Backend Link**: Connects to the NestJS sync API either locally (`http://localhost:3001/api`) or directly against the Cloud Run production API.

```text
┌───────────────────────┐
│ AI Assistant / Agent  │
│ (Claude, Antigravity) │
└───────────┬───────────┘
            │ stdio JSON-RPC
┌───────────▼───────────┐
│    MCP Server Daemon  │
│  (`apps/mcp_server`)  │
└───────────┬───────────┘
            │ HTTP / Auth Bearer
┌───────────▼───────────┐
│     NestJS API /      │
│     PostgreSQL DB     │
└───────────────────────┘
```

---

## 2. Seven Tool Domains

The MCP server provides tools organized across 7 distinct operational domains:

1. **Catalog & Menu** (`catalog.tools.ts`): Search products, inspect technical sheets, update retail prices, inspect KDS station categories.
2. **Inventory & Kardex** (`inventory.tools.ts`): Fetch low-stock desabasto alerts, inspect warehouse on-hand quantities, retrieve product kardex audit logs.
3. **Sales & Cash Cuts** (`sales.tools.ts`): Query active open orders, generate simulated Corte X and Corte Z cash drawer audits.
4. **POS & Kitchen Operation** (`pos.tools.ts`): Inspect table availability status, update table occupancy/cleaning states, view active KDS kitchen tickets, advance ticket readiness.
5. **Purchases & Requisitions** (`purchases.tools.ts`): Query pending purchase orders, list branch stock requisitions, approve requisitions.
6. **Production & Assembly (OP)** (`production.tools.ts`): Query recipe bills of materials (BOM), create and execute production runs.
7. **Shifts & Cash Management** (`shifts.tools.ts`): Check active cashier drawer shifts, register cash-in / cash-out drawer movements.
