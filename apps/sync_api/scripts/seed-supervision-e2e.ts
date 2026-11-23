import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://pos_user:pos_password@localhost:5432/pos_dev';
const BUSINESS_ID =
  process.env.E2E_BUSINESS_ID ?? 'd3b07384-d113-4a0e-a555-e5b12824bf01';
const BRANCH_ID = 'a0e00000-0000-4000-8000-000000000001';
const BRANCH_NAME = 'E2E Supervisión';
const OWNER_ID = 'a0e00000-0000-4000-8000-000000000002';
const SUPERVISOR_ID = 'a0e00000-0000-4000-8000-000000000003';
const CASHIER_ID = 'a0e00000-0000-4000-8000-000000000004';
const OPERATOR_ID = 'a0e00000-0000-4000-8000-000000000005';
const OWNER_EMAIL =
  process.env.E2E_OWNER_EMAIL ?? 'owner.e2e@cacharelo.com';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'owner123';
const SUPERVISOR_EMAIL =
  process.env.E2E_SUPERVISOR_EMAIL ?? 'supervisor.e2e@cacharelo.com';
const SUPERVISOR_PASSWORD =
  process.env.E2E_SUPERVISOR_PASSWORD ?? 'supervisor123';

async function upsertUser(
  client: any,
  user: {
    id: string;
    branchId: string | null;
    name: string;
    email: string | null;
    passwordHash: string | null;
    pinHash: string;
    role: string;
    roles: string[];
  },
) {
  await client.query(
    `INSERT INTO users
       (id, business_id, branch_id, name, email, password_hash, pin, role, roles, version, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 1, NULL)
     ON CONFLICT (id) DO UPDATE SET
       business_id = EXCLUDED.business_id,
       branch_id = EXCLUDED.branch_id,
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       pin = EXCLUDED.pin,
       role = EXCLUDED.role,
       roles = EXCLUDED.roles,
       deleted_at = NULL,
       updated_at = now(),
       version = users.version + 1`,
    [
      user.id,
      BUSINESS_ID,
      user.branchId,
      user.name,
      user.email,
      user.passwordHash,
      user.pinHash,
      user.role,
      JSON.stringify(user.roles),
    ],
  );
}

async function main() {
  const host = new URL(DATABASE_URL).hostname;
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal && process.env.E2E_ALLOW_REMOTE_DB !== '1') {
    throw new Error(
      `Refusing to seed ${host}: this script deletes E2E cash shifts. Set E2E_ALLOW_REMOTE_DB=1 to override.`,
    );
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const business = await client.query(
      'SELECT id FROM businesses WHERE id = $1',
      [BUSINESS_ID],
    );
    if (business.rowCount === 0) {
      throw new Error(
        `Business ${BUSINESS_ID} does not exist. Run the seed/migrations first or set E2E_BUSINESS_ID.`,
      );
    }

    const [ownerPassword, supervisorPassword, cashierPin, operatorPin] =
      await Promise.all([
        bcrypt.hash(OWNER_PASSWORD, 10),
        bcrypt.hash(SUPERVISOR_PASSWORD, 10),
        bcrypt.hash('9090', 10),
        bcrypt.hash('9091', 10),
      ]);

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO branches (id, business_id, name, address, version)
       VALUES ($1, $2, $3, 'E2E local', 1)
       ON CONFLICT (id) DO UPDATE SET
         business_id = EXCLUDED.business_id,
         name = EXCLUDED.name,
         deleted_at = NULL,
         updated_at = now(),
         version = branches.version + 1`,
      [BRANCH_ID, BUSINESS_ID, BRANCH_NAME],
    );

    await upsertUser(client, {
      id: OWNER_ID,
      branchId: null,
      name: 'Owner E2E',
      email: OWNER_EMAIL,
      passwordHash: ownerPassword,
      pinHash: cashierPin,
      role: 'owner',
      roles: ['owner'],
    });
    await upsertUser(client, {
      id: SUPERVISOR_ID,
      branchId: null,
      name: 'Supervisor E2E',
      email: SUPERVISOR_EMAIL,
      passwordHash: supervisorPassword,
      pinHash: operatorPin,
      role: 'branch_supervisor',
      roles: ['branch_supervisor'],
    });
    await upsertUser(client, {
      id: CASHIER_ID,
      branchId: BRANCH_ID,
      name: 'Cajero E2E',
      email: null,
      passwordHash: null,
      pinHash: cashierPin,
      role: 'cashier',
      roles: ['cashier'],
    });
    await upsertUser(client, {
      id: OPERATOR_ID,
      branchId: BRANCH_ID,
      name: 'Operador E2E',
      email: null,
      passwordHash: null,
      pinHash: operatorPin,
      role: 'branch_operator',
      roles: ['branch_operator'],
    });

    for (const [userId, role] of [
      [OWNER_ID, 'owner'],
      [SUPERVISOR_ID, 'branch_supervisor'],
    ] as const) {
      await client.query(
        `INSERT INTO admin_business_access (user_id, business_id, role, version)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id, business_id) WHERE deleted_at IS NULL
         DO UPDATE SET
           role = EXCLUDED.role,
           updated_at = now(),
           version = admin_business_access.version + 1`,
        [userId, BUSINESS_ID, role],
      );
    }

    await client.query(
      `INSERT INTO supervisor_branch_assignments (business_id, user_id, branch_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, branch_id) WHERE revoked_at IS NULL DO NOTHING`,
      [BUSINESS_ID, SUPERVISOR_ID, BRANCH_ID, OWNER_ID],
    );

    await client.query(
      "SELECT set_config('app.allow_cash_ledger_purge', 'on', true)",
    );
    await client.query('DELETE FROM cashier_debts WHERE branch_id = $1', [
      BRANCH_ID,
    ]);
    await client.query('DELETE FROM notifications WHERE branch_id = $1', [
      BRANCH_ID,
    ]);
    await client.query(
      `DELETE FROM cash_transactions
       WHERE shift_id IN (SELECT id FROM cash_shifts WHERE branch_id = $1)`,
      [BRANCH_ID],
    );
    await client.query('DELETE FROM cash_shifts WHERE branch_id = $1', [
      BRANCH_ID,
    ]);

    const now = Date.now();
    const openedAt = new Date(now - 2 * 60 * 60 * 1000);
    const movementAt = new Date(now - 60 * 60 * 1000);
    const closedAt = new Date(now - 10 * 60 * 1000);
    const shiftId = randomUUID();
    const movementId = randomUUID();
    const movementReason = `E2E ingreso ${randomUUID().slice(0, 8)}`;
    const closeSnapshot = {
      summary: {
        expectedCash: 1200,
        actualCash: 1200,
        cashDifference: 0,
      },
      generatedAt: closedAt.toISOString(),
      closeNotes: 'E2E local',
    };

    await client.query(
      `INSERT INTO cash_shifts
         (id, cashier_id, branch_id, initial_float, cash_drawer_amount, status,
          opened_at, closed_at, close_notes, close_snapshot, review_status,
          closed_by, n1_resolver_role, version)
       VALUES ($1, $2, $3, 1000.00, 1200.00, 'closed', $4, $5, 'E2E local', $6::jsonb, 'pendiente_n1', $7, 'branch_supervisor', 1)`,
      [
        shiftId,
        CASHIER_ID,
        BRANCH_ID,
        openedAt,
        closedAt,
        JSON.stringify(closeSnapshot),
        OPERATOR_ID,
      ],
    );

    await client.query(
      `INSERT INTO cash_transactions
         (id, shift_id, type, amount, reason, created_at, client_uuid, created_by,
          category, entry_kind, approval_status, device_id, version)
       VALUES ($1, $2, 'cash-in', 200.00, $3, $4, $5, $6, 'otro_ingreso', 'movimiento', 'pendiente_n1', 'e2e-seed', 1)`,
      [
        movementId,
        shiftId,
        movementReason,
        movementAt,
        `e2e-${movementId}`,
        OPERATOR_ID,
      ],
    );

    await client.query('COMMIT');

    console.log(
      JSON.stringify({
        businessId: BUSINESS_ID,
        branchId: BRANCH_ID,
        branchName: BRANCH_NAME,
        ownerId: OWNER_ID,
        ownerEmail: OWNER_EMAIL,
        ownerPassword: OWNER_PASSWORD,
        supervisorId: SUPERVISOR_ID,
        supervisorEmail: SUPERVISOR_EMAIL,
        supervisorPassword: SUPERVISOR_PASSWORD,
        shiftId,
        movementId,
        movementReason,
      }),
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
