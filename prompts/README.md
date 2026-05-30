# Reusable LLM Prompts (prompts/)

This directory stores structured, reusable prompts for AI-assisted development of the POS-ERP project. When prompting an LLM for new tasks, feeding these files as context ensures consistent code style, correct library patterns, and adherence to design principles.

## 🗃️ Available Prompts

1. **[Developer Persona](file:///Users/joelmorales/web/POS-ERP/prompts/developer_persona.md)**: Establishes the background and guidelines for the AI coding assistant as a Senior Fullstack POS Developer.
2. **[Flutter POS Coder](file:///Users/joelmorales/web/POS-ERP/prompts/flutter_pos_coder.md)**: Rules for generating Dart/Flutter code with Isar DB collections, repositories, and UI widgets.
3. **[API Sync Designer](file:///Users/joelmorales/web/POS-ERP/prompts/api_sync_designer.md)**: Design rules for writing TypeScript AWS Lambda APIs connected to RDS Proxy PostgreSQL with strict idempotency and conflict handling.

## 🧩 How to Use
Copy the contents of a prompt file and paste it into your chat session (or feed the file directly if the chat interface supports it) prior to asking the LLM to write code or designs in that specific area.
