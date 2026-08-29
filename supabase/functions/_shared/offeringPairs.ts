// Phase 2.3 — server-side mirror of the provider→offering pairs that
// `create_entity_subject` (SQL) allows. The SQL function is the enforcement
// boundary; this list exists so edge functions can reason about the same
// contract. Parity-tested against BOTH the SQL allow-list and the production
// TypeScript registry (src/services/entityRelationshipRegistry.ts).

export const APPROVED_OFFERING_PAIRS = [
  { provider: 'place', offering: 'food' },
  { provider: 'brand', offering: 'product' },
] as const;

export type ApprovedOfferingPair = (typeof APPROVED_OFFERING_PAIRS)[number];

export function isApprovedOfferingPair(provider: string, offering: string): boolean {
  return APPROVED_OFFERING_PAIRS.some(
    (p) => p.provider === provider && p.offering === offering,
  );
}
