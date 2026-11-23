/**
 * Spec 019 — tunables of the cash approval chain.
 *
 * C-1 and C-2 are proposals that the owner still has to confirm
 * (specs/019-supervisor-sucursal/spec.md §15.2). Change them here.
 */
export const CASH_APPROVAL_CONFIG = {
  /**
   * C-1 (por confirmar): N1 and N2 of the same Corte Z must be different people.
   * When the supervisor resolved N1 of an OIS-closed corte, N2 is done by the
   * owner or another supervisor assigned to the branch.
   */
  n2MustDifferFromN1: true,

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
