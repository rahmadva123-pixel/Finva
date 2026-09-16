VIP & Daily Promo Launch Checklist

Priority items before production rollout:

1. Security
- Deploy `firestore.rules` and ensure admin users have the custom claim `admin: true` set in Auth.
- Verify claim route uses admin SDK (it does) so Firestore rules won't block server writes.

2. Tests
- Unit tests: add tests for tier selection, cooldown logic, and deposit-eligibility.
- Integration/E2E: validate admin sets tiers → qualifying user claims → `vipClaims`, `bonusTransactions`, and `users.balance` updated; test cooldown and failure paths.

3. Backups & migration
- Backed up `settings/bonus` (see `scripts/backup_settings_bonus.js`).
- Use `scripts/seed_vip_settings.js` to seed staging; review before running in prod.

4. Indexes
- Ensure indexes exist for queries used by the server:
  - `deposits` where `status` in ["completed","approved"] (single-field index on `status` usually sufficient).

5. Monitoring
- Add logging around claim errors and high-value payouts.
- Configure alerts for failed transactions or unusual payout spikes.

6. Concurrency & load
- Run concurrent claim simulations; ensure Firestore transactions prevent double-credit.

7. Admin UX
- Validate `vipTiers` editor input validation: positive `amount`, sensible `direct` and `total` thresholds, prevent duplicates.

Commands

Seed staging settings (example):

Windows PowerShell

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
node .\scripts\seed_vip_settings.js
```

Backup settings:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
node .\scripts\backup_settings_bonus.js
```

Run integration test (requires service account):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
node .\scripts\integration_test_vip_claim.js
```

Notes
- Firestore rules above are a conservative baseline; review them with your security team and adapt to your admin management flow.
- Admin writes to `settings/*` require the `admin` custom claim; you'll need a short admin management script to grant this claim to auth users (or set via Firebase console).
