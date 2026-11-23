CREATE TABLE IF NOT EXISTS owner_copilot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id),
  business_id uuid NOT NULL REFERENCES businesses(id), branch_id uuid REFERENCES branches(id),
  correlation_id varchar(80) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_copilot_conversation_owner_business ON owner_copilot_conversations(owner_id, business_id);
CREATE INDEX IF NOT EXISTS idx_owner_copilot_conversation_correlation ON owner_copilot_conversations(correlation_id);
CREATE TABLE IF NOT EXISTS owner_copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES owner_copilot_conversations(id),
  role varchar(20) NOT NULL, redacted_content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_copilot_message_conversation ON owner_copilot_messages(conversation_id);
CREATE TABLE IF NOT EXISTS owner_copilot_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES owner_copilot_conversations(id),
  tool_name varchar(80) NOT NULL, input_redacted jsonb NOT NULL, output_redacted jsonb,
  status varchar(20) NOT NULL, entity_type varchar(80), entity_id varchar(120), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_copilot_tool_conversation ON owner_copilot_tool_runs(conversation_id);
CREATE TABLE IF NOT EXISTS owner_copilot_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES owner_copilot_conversations(id),
  owner_id uuid NOT NULL REFERENCES users(id), business_id uuid NOT NULL REFERENCES businesses(id), branch_id uuid REFERENCES branches(id),
  action_type varchar(80) NOT NULL, token_hash varchar(128) NOT NULL UNIQUE, payload_redacted jsonb NOT NULL,
  expires_at timestamptz NOT NULL, confirmed_at timestamptz, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
