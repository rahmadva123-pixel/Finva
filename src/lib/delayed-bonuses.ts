// Delayed referral bonuses have been disabled as part of migrating to the
// new instant referral bonus system. This module intentionally no-ops so
// any scheduled jobs or imports remain safe.

export async function processDelayedReferralBonuses() {
    // No-op: legacy delayed referral bonuses are removed.
    return [];
}