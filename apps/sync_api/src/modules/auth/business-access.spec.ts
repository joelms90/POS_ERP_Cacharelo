import { ForbiddenException } from '@nestjs/common';
import {
  assertBusinessAccess,
  getUserBusinessIds,
  getUserRoles,
  isGlobalOwner,
} from './business-access';

describe('business access authorization', () => {
  it('normalizes roles from role and roles claims', () => {
    expect(getUserRoles({ role: 'owner' })).toEqual(['owner']);
    expect(getUserRoles({ roles: ['owner', 'owner', ' inventory_admin '] })).toEqual([
      'owner',
      'inventory_admin',
    ]);
  });

  it('treats owner as a global business owner', () => {
    expect(isGlobalOwner({ role: 'owner' })).toBe(true);
    expect(isGlobalOwner({ roles: ['inventory_admin', 'owner'] })).toBe(true);
  });

  it('allows owner access to businesses missing from businessAccess', () => {
    expect(() =>
      assertBusinessAccess(
        {
          role: 'owner',
          businessId: 'business-1',
          businessAccess: [{ businessId: 'business-2', role: 'owner' }],
        },
        'business-3',
      ),
    ).not.toThrow();
  });

  it('allows scoped admin access to configured businesses', () => {
    expect(() =>
      assertBusinessAccess(
        {
          role: 'inventory_admin',
          businessId: 'business-1',
          businessAccess: [{ businessId: 'business-2', role: 'inventory_admin' }],
        },
        'business-2',
      ),
    ).not.toThrow();
  });

  it('rejects scoped admin access to unconfigured businesses', () => {
    expect(() =>
      assertBusinessAccess(
        {
          role: 'inventory_admin',
          businessId: 'business-1',
          businessAccess: [{ businessId: 'business-2', role: 'inventory_admin' }],
        },
        'business-3',
      ),
    ).toThrow(ForbiddenException);
  });

  it('returns all explicit business ids for scoped checks', () => {
    expect(
      getUserBusinessIds({
        businessId: 'business-1',
        businessAccess: [
          { businessId: 'business-1', role: 'inventory_admin' },
          { businessId: 'business-2', role: 'inventory_admin' },
        ],
      }),
    ).toEqual(['business-1', 'business-2']);
  });
});
