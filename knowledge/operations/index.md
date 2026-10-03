# 🚀 DevOps & Operational Runbooks

This section contains operational playbooks, deployment targets, cloud infrastructure topologies, database proxy procedures, and local development runbooks.

---

## 🛠️ Runbook Index

| Runbook | Focus | Key Targets |
| :--- | :--- | :--- |
| [Deployments Runbook](deployment-runbook.md) | Production Deployments | Cloud Run, Firebase Hosting, Cloud SQL Proxy, Idempotent DDL migrations. |
| [Local Dev & Testing](local-dev-and-testing.md) | Developer Environment | Running local services, dev database setup, port mappings, and testing. |

---

## ⚠️ Pre-Deployment Checklist Reminder

Before initiating any production deployment or database migration, consult [`docs/pre-deployment-checklist.md`](../../docs/pre-deployment-checklist.md) and verify that all necessary data backfills, idempotent migration scripts, and release versions are staged.
