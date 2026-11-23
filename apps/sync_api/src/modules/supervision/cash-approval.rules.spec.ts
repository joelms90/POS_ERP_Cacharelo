import {
  ApprovalActor,
  ApprovalRuleError,
  assertCanCancelOrAdjust,
  assertCanResolveN1,
  assertCanResolveN2,
  assertNoPendingMovements,
  assertShiftLedgerOpen,
  cashEffect,
  debtAmountFor,
  groupMovements,
  isOpeningBlockedBy,
  n1ResolverRoleFor,
  nextMovementStatus,
  nextShiftStatus,
  normalizeRoles,
  reconciliationStatus,
  requireReason,
} from './cash-approval.rules';
import { isOpenBlockEnforced } from './cash-approval.config';

const actor = (over: Partial<ApprovalActor> = {}): ApprovalActor => ({
  id: 'u-actor',
  roles: [],
  branchId: null,
  assignedBranchIds: [],
  isOwner: false,
  ...over,
});
const ois = actor({ id: 'ois-1', roles: ['branch_operator'], branchId: 'b1' });
const otherOis = actor({ id: 'ois-2', roles: ['branch_operator'], branchId: 'b1' });
const foreignOis = actor({ id: 'ois-3', roles: ['branch_operator'], branchId: 'b2' });
const supervisor = actor({ id: 'sup-1', roles: ['branch_supervisor'], assignedBranchIds: ['b1', 'b3'] });
const otherSupervisor = actor({ id: 'sup-2', roles: ['branch_supervisor'], assignedBranchIds: ['b1'] });
const unassignedSupervisor = actor({ id: 'sup-3', roles: ['branch_supervisor'], assignedBranchIds: ['b2'] });
const owner = actor({ id: 'owner-1', roles: ['owner'], isOwner: true });

const expectRule = (fn: () => unknown, kind: ApprovalRuleError['kind']) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApprovalRuleError);
    expect((error as ApprovalRuleError).kind).toBe(kind);
    return;
  }
  throw new Error(`expected ApprovalRuleError(${kind})`);
};

describe('cash approval rules', () => {
  describe('roles', () => {
    it('normalizes legacy encargado/responsable to branch_operator', () => {
      expect(normalizeRoles(['encargado', 'cashier'])).toEqual(['branch_operator', 'cashier']);
      expect(normalizeRoles([], 'responsable')).toEqual(['branch_operator']);
    });

    it('S-3: OIS-authored items are resolved at N1 by the supervisor, cashier items by the OIS', () => {
      expect(n1ResolverRoleFor(['branch_operator'])).toBe('branch_supervisor');
      expect(n1ResolverRoleFor(['cashier'])).toBe('branch_operator');
    });
  });

  describe('N1', () => {
    const cashierItem = { branchId: 'b1', authorId: 'cashier-1', n1ResolverRole: 'branch_operator' };
    const oisItem = { branchId: 'b1', authorId: 'ois-1', n1ResolverRole: 'branch_supervisor' };

    it('lets the OIS of the branch resolve a cashier item', () => {
      expect(() => assertCanResolveN1(ois, cashierItem)).not.toThrow();
    });

    it('rejects an OIS from another branch', () => {
      expectRule(() => assertCanResolveN1(foreignOis, cashierItem), 'forbidden');
    });

    it('S-6: supervisor and owner do not replace the OIS on cashier items', () => {
      expectRule(() => assertCanResolveN1(supervisor, cashierItem), 'forbidden');
      expectRule(() => assertCanResolveN1(owner, cashierItem), 'forbidden');
    });

    it('nobody resolves their own item', () => {
      expectRule(() => assertCanResolveN1(ois, { ...cashierItem, authorId: 'ois-1' }), 'forbidden');
    });

    it('S-3: the assigned supervisor resolves N1 of OIS items; another OIS and the owner cannot', () => {
      expect(() => assertCanResolveN1(supervisor, oisItem)).not.toThrow();
      expectRule(() => assertCanResolveN1(otherOis, oisItem), 'forbidden');
      expectRule(() => assertCanResolveN1(owner, oisItem), 'forbidden');
      expectRule(() => assertCanResolveN1(unassignedSupervisor, oisItem), 'forbidden');
    });
  });

  describe('N2', () => {
    const shift = { branchId: 'b1', closedBy: 'cashier-1', operatorReviewedBy: 'ois-1' };

    it('allows the assigned supervisor and the owner', () => {
      expect(() => assertCanResolveN2(supervisor, shift)).not.toThrow();
      expect(() => assertCanResolveN2(owner, shift)).not.toThrow();
    });

    it('rejects the OIS and unassigned supervisors', () => {
      expectRule(() => assertCanResolveN2(ois, shift), 'forbidden');
      expectRule(() => assertCanResolveN2(unassignedSupervisor, shift), 'forbidden');
    });

    it('rejects approving your own corte', () => {
      expectRule(() => assertCanResolveN2(owner, { ...shift, closedBy: 'owner-1' }), 'forbidden');
    });

    it('C-1: N2 must differ from the N1 approver (configurable)', () => {
      const oisShift = { branchId: 'b1', closedBy: 'ois-1', operatorReviewedBy: 'sup-1' };
      expectRule(() => assertCanResolveN2(supervisor, oisShift), 'forbidden');
      expect(() => assertCanResolveN2(otherSupervisor, oisShift)).not.toThrow();
      expect(() => assertCanResolveN2(owner, oisShift)).not.toThrow();
      expect(() =>
        assertCanResolveN2(supervisor, oisShift, { n2MustDifferFromN1: false, oisCloseBlocksOpeningUntilN1: true }),
      ).not.toThrow();
    });
  });

  it('only the assigned supervisor or the owner cancel/adjust movements', () => {
    expect(() => assertCanCancelOrAdjust(supervisor, 'b1')).not.toThrow();
    expect(() => assertCanCancelOrAdjust(owner, 'b1')).not.toThrow();
    expectRule(() => assertCanCancelOrAdjust(ois, 'b1'), 'forbidden');
    expectRule(() => assertCanCancelOrAdjust(unassignedSupervisor, 'b1'), 'forbidden');
  });

  describe('Corte Z state machine', () => {
    it.each([
      ['pendiente_n1', 'approve_n1', 'pendiente_n2'],
      ['pendiente_n1', 'reject_n1', 'rechazado_n1'],
      ['rechazado_n1', 'recount', 'pendiente_n1'],
      ['pendiente_n2', 'approve_n2', 'aprobado'],
      ['pendiente_n2', 'adjust_n2', 'aprobado_con_ajuste'],
      ['pendiente_n2', 'reject_n2', 'rechazado_n2'],
      ['rechazado_n2', 'recount', 'pendiente_n2'], // S-5: straight back to N2
      ['rechazado_n2', 'adjust_n2', 'aprobado_con_ajuste'],
      ['aprobado', 'reopen', 'pendiente_n2'],
      ['aprobado_con_ajuste', 'reopen', 'pendiente_n2'],
    ] as const)('%s --%s--> %s', (from, action, to) => {
      expect(nextShiftStatus(from, action)).toBe(to);
    });

    it.each([
      ['pendiente_n1', 'approve_n2'], // N2 cannot skip N1
      ['pendiente_n2', 'approve_n1'],
      ['aprobado', 'reject_n2'],
      ['no_aplica', 'approve_n1'],
      ['pendiente_n1', 'reopen'],
      ['pendiente_n2', 'recount'],
    ] as const)('rejects %s --%s--> (409)', (from, action) => {
      expectRule(() => nextShiftStatus(from, action), 'conflict');
    });
  });

  describe('movement state machine (S-1: N1 only)', () => {
    it.each([
      ['pendiente_n1', 'approve', 'aprobado'],
      ['pendiente_n1', 'reject', 'rechazado'],
      ['pendiente_n1', 'cancel', 'cancelado'],
      ['aprobado', 'cancel', 'cancelado'],
      ['aprobado_historico', 'adjust', 'ajustado'],
    ] as const)('%s --%s--> %s', (from, action, to) => {
      expect(nextMovementStatus(from, action)).toBe(to);
    });

    it.each([
      ['aprobado', 'approve'],
      ['rechazado', 'cancel'],
      ['cancelado', 'adjust'],
      ['ajustado', 'reject'],
    ] as const)('rejects %s --%s--> (409)', (from, action) => {
      expectRule(() => nextMovementStatus(from, action), 'conflict');
    });

    it('MV-04: a shift with final approval no longer accepts reversals', () => {
      expectRule(() => assertShiftLedgerOpen('aprobado'), 'conflict');
      expectRule(() => assertShiftLedgerOpen('aprobado_con_ajuste'), 'conflict');
      expect(() => assertShiftLedgerOpen('pendiente_n2')).not.toThrow();
    });

    it('CZ-06: pending movements block corte approval (422)', () => {
      expectRule(() => assertNoPendingMovements([{ entryKind: 'movimiento', approvalStatus: 'pendiente_n1' }]), 'unprocessable');
      expect(() =>
        assertNoPendingMovements([
          { entryKind: 'movimiento', approvalStatus: 'aprobado' },
          { entryKind: 'reverso', approvalStatus: 'no_aplica' },
        ]),
      ).not.toThrow();
    });
  });

  describe('ledger (S-4)', () => {
    it('computes signed effects, reversals negate the original', () => {
      expect(cashEffect({ type: 'cash-in', amount: '200.00', entryKind: 'movimiento' })).toBe(200);
      expect(cashEffect({ type: 'cash-out', amount: '80.50', entryKind: 'movimiento' })).toBe(-80.5);
      expect(cashEffect({ type: 'cash-out', amount: '80.50', entryKind: 'reverso' })).toBe(80.5);
      expect(cashEffect({ type: 'cash-in', amount: '10', entryKind: undefined })).toBe(10);
    });

    it('groups approved, pending, reverted and adjusted movements with a correct net', () => {
      const entries = [
        { id: 'a', type: 'cash-in', amount: '100', entryKind: 'movimiento', approvalStatus: 'aprobado' },
        { id: 'p', type: 'cash-out', amount: '40', entryKind: 'movimiento', approvalStatus: 'pendiente_n1' },
        { id: 'r', type: 'cash-out', amount: '800', entryKind: 'movimiento', approvalStatus: 'rechazado' },
        { id: 'r-rev', type: 'cash-out', amount: '800', entryKind: 'reverso', approvalStatus: 'no_aplica', reversesTransactionId: 'r' },
        { id: 'j', type: 'cash-out', amount: '300', entryKind: 'movimiento', approvalStatus: 'ajustado' },
        { id: 'j-rev', type: 'cash-out', amount: '300', entryKind: 'reverso', approvalStatus: 'no_aplica', reversesTransactionId: 'j' },
        { id: 'j-new', type: 'cash-out', amount: '250', entryKind: 'ajuste', approvalStatus: 'no_aplica', replacesTransactionId: 'j' },
      ];
      const grouped = groupMovements(entries);
      expect(grouped.aprobados.map((e) => e.id)).toEqual(['a']);
      expect(grouped.pendientes.map((e) => e.id)).toEqual(['p']);
      expect(grouped.revertidos.map((e) => e.id)).toEqual(['r']);
      expect(grouped.ajustados.map((e) => e.id)).toEqual(['j', 'j-new']);
      // +100 −40 (−800 +800) (−300 +300 −250) = −190
      expect(grouped.totals).toEqual({ grossIn: 100, grossOut: 1390, reversals: 1100, net: -190, pending: -40 });
    });

    it('the spec example: rejecting an $800 expense after close turns a balanced corte into an $800 shortage', () => {
      const initialFloat = 1000;
      const cashSales = 5000;
      const counted = 5200;
      const atClose = groupMovements([{ id: 'g', type: 'cash-out', amount: '800', entryKind: 'movimiento', approvalStatus: 'pendiente_n1' }]);
      expect(initialFloat + cashSales + atClose.totals.net - counted).toBe(0);
      const afterReject = groupMovements([
        { id: 'g', type: 'cash-out', amount: '800', entryKind: 'movimiento', approvalStatus: 'rechazado' },
        { id: 'g-rev', type: 'cash-out', amount: '800', entryKind: 'reverso', approvalStatus: 'no_aplica' },
      ]);
      const adjustedDifference = counted - (initialFloat + cashSales + afterReject.totals.net);
      expect(adjustedDifference).toBe(-800);
      expect(debtAmountFor(adjustedDifference)).toBe(800);
    });
  });

  it('reconciliation status mirrors the admin classification', () => {
    expect(reconciliationStatus(100, 100)).toBe('BALANCED');
    expect(reconciliationStatus(100, 120.5)).toBe('SURPLUS');
    expect(reconciliationStatus(100, 99.99)).toBe('SHORTAGE');
    expect(reconciliationStatus(-0.01, 0)).toBe('REQUIRES_RECONCILIATION');
  });

  describe('opening block (D-4, C-2, P-2)', () => {
    it('blocks while the last corte awaits or failed N1', () => {
      expect(isOpeningBlockedBy({ reviewStatus: 'pendiente_n1', n1ResolverRole: 'branch_operator' })).toBe(true);
      expect(isOpeningBlockedBy({ reviewStatus: 'rechazado_n1', n1ResolverRole: 'branch_operator' })).toBe(true);
    });

    it('does not block once N1 approved, for history, or without a previous shift', () => {
      expect(isOpeningBlockedBy({ reviewStatus: 'pendiente_n2' })).toBe(false);
      expect(isOpeningBlockedBy({ reviewStatus: 'rechazado_n2' })).toBe(false);
      expect(isOpeningBlockedBy({ reviewStatus: 'no_aplica' })).toBe(false);
      expect(isOpeningBlockedBy(null)).toBe(false);
    });

    it('P-2: the owner emergency unblock lifts the block', () => {
      expect(isOpeningBlockedBy({ reviewStatus: 'pendiente_n1', openBlockOverriddenAt: new Date() })).toBe(false);
    });

    it('C-2: OIS-closed cortes block until the supervisor N1 (configurable)', () => {
      const oisCorte = { reviewStatus: 'pendiente_n1', n1ResolverRole: 'branch_supervisor' };
      expect(isOpeningBlockedBy(oisCorte)).toBe(true);
      expect(isOpeningBlockedBy(oisCorte, { n2MustDifferFromN1: true, oisCloseBlocksOpeningUntilN1: false })).toBe(false);
    });

    it('is enforced only behind CASH_APPROVALS_ENFORCE_OPEN_BLOCK=true', () => {
      expect(isOpenBlockEnforced({})).toBe(false);
      expect(isOpenBlockEnforced({ CASH_APPROVALS_ENFORCE_OPEN_BLOCK: 'true' })).toBe(true);
    });
  });

  it('debts only for shortages', () => {
    expect(debtAmountFor(-12.345)).toBe(12.35);
    expect(debtAmountFor(0)).toBe(0);
    expect(debtAmountFor(15)).toBe(0);
  });

  it('requires a reason (AU-03)', () => {
    expectRule(() => requireReason('  ', 'rechazar'), 'unprocessable');
    expect(requireReason('  Billete faltante ', 'rechazar')).toBe('Billete faltante');
  });
});
