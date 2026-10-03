---
type: "app"
title: "Model Context Protocol (MCP) Server"
description: "Architecture, tools catalogue, setup, and execution for the POS-ERP MCP agent server."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "mcp"
  - "ai-agents"
  - "tools"
  - "apps"
sources:
  - "apps/mcp_server/package.json"
  - "apps/mcp_server/README.md"
---

# Model Context Protocol (MCP) Server

The **MCP Server** (`apps/mcp_server`) exposes the POS-ERP system to autonomous AI assistants, allowing models to query catalog data, Kardex movements, cash shifts, and kitchen states via standard MCP JSON-RPC protocol.

---

## 1. Setup & Configuration

Configure your AI assistant (e.g. Cursor, Claude Desktop, Antigravity) with the following entry:

```json
{
  "mcpServers": {
    "pos-erp": {
      "command": "node",
      "args": ["/absolute/path/to/POS-ERP/apps/mcp_server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3001/api",
        "API_BEARER_TOKEN": "<operator-jwt-token>"
      }
    }
  }
}
```

---

## 2. Tool Categories

1. **Catalog Tools**: `search_products`, `get_product_details`, `update_product_price`, `get_categories`.
2. **Inventory Tools**: `get_stock_alerts`, `get_inventory_existence`, `get_product_kardex`, `get_warehouses`.
3. **Sales Tools**: `get_active_orders`, `simulate_corte_caja`.
4. **POS Tools**: `get_branch_tables`, `update_table_state`, `get_kitchen_tickets`, `update_kitchen_ticket_status`.
5. **Purchasing Tools**: `get_purchase_orders`, `get_branch_requisitions`, `approve_branch_requisition`.
6. **Production Tools**: `get_recipes`, `create_production_run`.
7. **Shift Tools**: `get_active_shift`, `record_cash_movement`.

---

## 3. Operational Commands

```bash
# Verify connectivity to NestJS backend
make mcp-verify
# or
cd apps/mcp_server && pnpm test:verify

# Start MCP stdio server
make mcp-start
# or
cd apps/mcp_server && pnpm start
```
