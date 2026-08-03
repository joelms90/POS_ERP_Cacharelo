# Claude Code Configuration

This directory contains Claude Code configuration files and knowledge bases for the Cacharelo POS-ERP project.

## Contents

### [deployment-agent.md](./deployment-agent.md)
**Comprehensive deployment knowledge base and operations manual**

### [monorepo-branch-strategy.md](./monorepo-branch-strategy.md)
**Multi-session workspace isolation and branch strategy guide**

This document explains how to prevent conflicts when multiple development sessions (terminals/developers/AI assistants) work on different parts of the monorepo simultaneously. Covers:
- App-scoped branch strategy
- Workspace isolation rules
- Shared file modification protocols
- Deployment coordination
- Database migration coordination
- Conflict prevention and resolution

### [workspaces.md](./workspaces.md)
**Active workspace tracking file**

Live tracking of which development sessions (terminals/developers/assistants) are working on which apps/branches. Check this file before starting work to avoid conflicts.

This agent document contains complete knowledge about deploying all components of the Cacharelo POS-ERP system:

- **Infrastructure Overview**: GCP, Firebase, Cloud SQL architecture
- **Production URLs**: All live service endpoints
- **Deployment Commands**: Complete Makefile target reference
- **Deployment Workflows**: Best practices, order of operations, pre/post-deployment checklists
- **Database Operations**: Migrations, backups, production data management
- **Rollback Procedures**: How to revert deployments safely
- **Troubleshooting Guide**: Common issues and solutions
- **Security Considerations**: Secrets management, authentication, HTTPS/TLS
- **Monitoring & Observability**: Logs, metrics, uptime checks
- **Cost Optimization**: Tips for reducing cloud costs

**Use this document when**:
- Deploying backend API to Cloud Run
- Deploying admin dashboard to Firebase Hosting
- Deploying POS web app to Firebase Hosting
- Running production database migrations
- Building Flutter native apps (Android, iOS, macOS, Windows)
- Troubleshooting deployment issues
- Rolling back failed deployments
- Setting up monitoring and alerts

## Quick Start

To deploy the entire system:

```bash
# 1. Database migrations (if schema changed)
make backend-migrate

# 2. Deploy backend API
make backend-deploy-fast

# 3. Deploy admin dashboard
make admin-deploy

# 4. Deploy POS web app
make flutter-web-deploy
```

For detailed instructions, see [deployment-agent.md](./deployment-agent.md).

## Additional Resources

- [Project HANDOFF.md](../HANDOFF.md) - Session handoff documentation
- [AGENTS.md](../AGENTS.md) - Agent guidelines and quick reference
- [Makefile](../Makefile) - All available commands
- [Spec Documents](../specs/) - Feature specifications and implementation plans
