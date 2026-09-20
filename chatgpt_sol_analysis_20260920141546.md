# Aegis implementation analysis

## Reviewed code map

Reviewed `src/main.ts`, encryption/lock/unlock workflows, `src/billing.ts`, usage/types/settings, account/support modules, and publish inputs.

## Changes and safeguards

- Protection usage is account-scoped with authenticated entitlement/spend and stable pending charges; missing or expired auth blocks protection rather than failing open.
- Removed obsolete free-use refund path where it conflicted with server authority.
- Local encryption remains the default and security-sensitive passphrase, lock, and batch choices remain explicit.
- Lock/unlock actions lead the menu; backup, timeout, PBKDF2, and billing options are progressively disclosed.

## Threat model and migration

Passwords, encryption keys, protected bodies, and note contents are never logged or sent to billing. Bearer session state is cleared on invalid authentication. Billing is separate from local cryptography.

## Documentation and logging

Help documents local-only encryption, commands, defaults, session clearing, backup/rollback, account/billing, privacy, and troubleshooting. Support logging covers lifecycle, lock batches, cancellation, billing, and failures without secrets.

## Validation

Run `npm run check`, `npm run build`, and `git diff --check`; mirror validated publish output only.

## Remaining limitation

Cryptographic behavior should be exercised with maintainer-owned fixtures; vault data was not accessed.
