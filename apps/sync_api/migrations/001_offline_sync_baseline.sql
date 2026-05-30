CREATE TABLE IF NOT EXISTS registered_devices (
  device_id uuid PRIMARY KEY,
  branch_id text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cloud_transactions (
  transaction_id uuid PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES registered_devices(device_id),
  branch_id text NOT NULL,
  transaction_type text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  source_created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_receipts (
  receipt_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES cloud_transactions(transaction_id),
  status text NOT NULL CHECK (status IN ('accepted', 'duplicate')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  cloud_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS conflict_records (
  id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL,
  reason text NOT NULL,
  local_payload jsonb,
  cloud_payload jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolution_state text NOT NULL DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_cloud_transactions_device_id
  ON cloud_transactions(device_id);

CREATE INDEX IF NOT EXISTS idx_conflict_records_transaction_id
  ON conflict_records(transaction_id);

