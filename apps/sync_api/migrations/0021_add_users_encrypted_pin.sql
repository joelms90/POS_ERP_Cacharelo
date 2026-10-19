ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "encrypted_pin" varchar(255);
