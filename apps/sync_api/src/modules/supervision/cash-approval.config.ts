/**
 * Spec 019 — tunables of the cash approval chain.
 *
 * C-1 was confirmed by the owner on 2026-11-23. C-2 is still to be confirmed
 * (specs/019-supervisor-sucursal/spec.md §15.2). Change them here.
 */
export const CASH_APPROVAL_CONFIG = {
  /**
   * C-1 (confirmed 2026-11-23): the supervisor who resolved N1 of an OIS-closed
   * corte may also resolve N2 (approve or adjust) without waiting for the owner.
   * Every N1/N2 action stays in the audit log so the owner can review it later.
   * Self-approval (closed_by == actor) remains forbidden.
   */
  n2MustDifferFromN1: false,

  /**
   * C-2 (por confirmar): a Corte Z closed by the OIS (whose N1 is resolved by the
   * supervisor, S-3) also blocks opening the next shift until that N1 is approved.
   * The owner's emergency unblock (P-2) remains the way out.
   */
  oisCloseBlocksOpeningUntilN1: true,
} as const;

/**
 * D-4 opening block is enforced only when this env flag is 'true'. It ships off
 * so that branches can keep opening shifts until every POS terminal runs the
 * version that includes the N1 inbox (plan.md §1.6).
 */
export function isOpenBlockEnforced(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.CASH_APPROVALS_ENFORCE_OPEN_BLOCK === 'true';
}
