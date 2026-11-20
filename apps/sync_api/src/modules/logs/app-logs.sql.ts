/** DDL for the production diagnostics table. Idempotent. */
export const APP_LOGS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    source varchar(20) NOT NULL,
    level varchar(10) NOT NULL,
    message text NOT NULL,
    stack text,
    fingerprint varchar(32) NOT NULL,
    business_id varchar(64),
    branch_id varchar(64),
    branch_name varchar(200),
    user_id varchar(64),
    user_name varchar(200),
    user_role varchar(50),
    device_id varchar(100),
    app_version varchar(50),
    platform varchar(50),
    route text,
    http_method varchar(10),
    http_status integer,
    context jsonb,
    breadcrumbs jsonb,
    user_agent varchar(300)
  );
  CREATE INDEX IF NOT EXISTS app_logs_occurred_at_idx ON app_logs (occurred_at DESC);
  CREATE INDEX IF NOT EXISTS app_logs_branch_occurred_idx ON app_logs (branch_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS app_logs_fingerprint_idx ON app_logs (fingerprint, occurred_at DESC);
`;
