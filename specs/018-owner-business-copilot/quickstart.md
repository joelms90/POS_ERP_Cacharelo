# Local Verification

1. Start the local backend and admin UI in two terminals:

   ```bash
   make owner-copilot-backend
   make owner-copilot-admin
   ```

2. Sign in as a real owner account and open **Copiloto**. Try a suggested inventory or operational question.
3. Run focused checks:

   ```bash
   make owner-copilot-test
   ```

No production deployment or migration is part of this verification. For a production provider, set `OWNER_COPILOT_PROVIDER_API_KEY` from Secret Manager on the server runtime only.
