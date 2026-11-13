import { type GuestCapability, type GuestLease, type GuestPrincipal } from './GuestLeaseTypes.js';

export function assertGuestCapability(
  principal: GuestPrincipal,
  lease: GuestLease,
  capability: GuestCapability,
  now = Date.now(),
): void {
  if (principal.kind !== 'guest' || principal.leaseId !== lease.id) {
    throw new Error('Guest principal does not match lease');
  }
  if (lease.revokedAt !== undefined || lease.expiresAt <= now) {
    throw new Error('Guest lease is inactive');
  }
  if (!lease.capabilities.includes(capability)) {
    throw new Error(`Guest capability denied: ${capability}`);
  }
}

export function consumeGuestQuota(
  lease: GuestLease,
  usage: { bytes?: number; operations?: number },
): void {
  const bytes = usage.bytes ?? 0;
  const operations = usage.operations ?? 0;
  if (bytes < 0 || operations < 0) {
    throw new Error('Guest quota usage increments must be non-negative');
  }
  if (lease.usage.bytes + bytes > lease.quota.maxBytes) {
    throw new Error('Guest byte quota exceeded');
  }
  if (lease.usage.operations + operations > lease.quota.maxOperations) {
    throw new Error('Guest operation quota exceeded');
  }
  lease.usage.bytes += bytes;
  lease.usage.operations += operations;
}
