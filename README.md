# Aegis Note Locker

Version: 3.3.39 — validated locally for publication; release pending.

## Current purchase behavior

Purchase settings load the current public product catalog from Constance. Each available offer supplies its exact Paddle price ID, native-unit grant, unit name, and formatted amount. The client displays backend-provided amounts, enables only offers marked available, and submits the selected price ID through authenticated checkout with quantity one. Existing account balances and granted credits remain associated with the account.

<!-- SETTINGS-CURRENT-2026-09-30 -->

## Preview and lifetime allowance

Guests see a bounded preview held only in memory. Keep the originating window open through registration, email verification and sign-in, then retry that exact result without regeneration. Guests cannot save, apply, export or queue useful output. Closing the preview or restarting loses unrevealed guest content.

Constance authorizes metered operations using this app’s native billing unit. The plugin checks current account entitlements and live purchase availability through Constance; each operation follows its documented reserve/commit or quote/confirmation flow.

One new protection is one native unit; free plaintext <=2,000 Unicode codepoints. Existing protected content decryption, restore/undo, and existing encrypted-result access remain free offline. New protection and new encrypted backup production require authorization. Encryption and passwords remain local.

Useful local writes follow durable reserve -> write -> verify -> commit. Full reveal commits before showing complete content. Unknown writes retain their journal for status/output reconciliation; they are never blindly refunded or replayed. Billing sends account/install identity, native dimensions and source/result digests, never vault content, image bytes or encryption passwords.

## Current settings

Settings default to **Simple** and remember the selected mode. Simple contains everyday controls and account/billing. **Advanced** adds specialist preferences and diagnostics. This plugin runs locally without a managed AI provider. Account and encryption passwords remain necessary.
<!-- SETTINGS-CURRENT-2026-09-30:END -->

<!-- BILLING-CURRENT-2026-09-30 -->
## Current local account and billing behavior

Use **Connect** with your email and password. A new account is registered; an existing account is authenticated. New users must follow the emailed verification link and Connect again. Incorrect passwords offer password recovery; passwords are never saved. Paid purchases and free allowances belong to the authenticated account, not a locally entered email or an editable cached balance. Reinstalling does not replenish the same account's allowance.

Constance is the billing authority. Credit units remain app-specific: characters, OCR pages, searches, conversions, repair/protection batches, or captures. Checkout return URLs and cached balances never grant credits. Payment fulfillment comes from the server’s verified Paddle webhook, and balances refresh from authenticated entitlements. Unknown usage or checkout results reuse the persisted operation ID; they must not create a new debit or alternative checkout.


Constance provides authenticated account entitlements, usage balances, and available purchase offers.
<!-- BILLING-CURRENT-2026-09-30:END -->


Aegis protects individual Markdown note bodies and selected top-level frontmatter properties with local, authenticated encryption. Encryption and decryption run locally with no AI or cloud key escrow. Unlocking existing protected data works offline; creating a new protection requires a connected billing account and verified allowance. Billing uses the current authenticated TutivSoft Constance installation/account flow for balance, checkout, and one-use charge events.

## What the MVP does

- Locks and unlocks the current note from the command palette, ribbon, editor menu, or file menu.
- Protects selected top-level frontmatter properties while leaving their names and other properties readable.
- Uses AES-256-GCM with a unique random salt and nonce for each encrypted record and versioned PBKDF2-HMAC-SHA-256 key derivation.
- Applies Lock, Unlock, and Backup directly with configured session defaults; optional review windows are off by default. It verifies decryption before replacement, checks for sync conflicts, and stages writes through a temporary file.
- Keeps a volatile undo record for the last operation and supports an encrypted backup export into the vault.
- Provides Lock All with progress and cancellation, a configurable session timeout, and an explicit Lock Now command.


## Safe workflow

Set the session password and default protected properties in plugin settings. The password stays in memory only. Lock, Unlock, and Backup then run directly; **Review before applying** is an optional settings toggle. Aegis performs a test decrypt and refuses stale-file writes. **Aegis Note Locker: Roll back last operation** is available while the plugin session still holds its in-memory undo record.

Locked note bodies are replaced by a visible placeholder; encrypted values are ciphertext in the vault file. This means normal Markdown search, property indexing, backlinks, embeds, and third-party plugins cannot read protected content while locked. File paths and unprotected frontmatter remain available. Links that live inside a locked body are not available to Obsidian's graph until the note is unlocked; links kept in unprotected frontmatter remain visible where Obsidian supports them.

## Security and privacy

The note-encryption password and plaintext are never written to logs, clipboard, network requests, or plugin settings. A separate billing account password is submitted only to authenticate with Constance; it is not retained as a password. Rotating billing session tokens are stored in Obsidian plugin data. Billing requests contain account/app identifiers, checkout metadata, and credit event IDs, never note paths, encrypted envelopes, encryption passwords, or protected content. Payment fulfillment remains webhook-authoritative and the plugin refreshes entitlements by polling.

The plugin protects notes locally with authenticated encryption; keep a separate backup of important vault data.


## License

MIT. See [LICENSE](LICENSE).

<!-- one-click-workflow:start -->
## Workflow defaults (v3.3.39)

Aegis uses the configured property list and applies the operation directly. Password setup is done once per session in Settings; before-and-after review is optional and off by default.
<!-- one-click-workflow:end -->

## Account, billing, and credit feedback

Account and billing controls appear at the top of settings. Select Connect with your email and password; verify the emailed link if requested, then Connect again. The settings page shows the current balance and provides balance refresh, sign-out, and purchase controls. Metered actions show the available balance and report the amount used with the remaining balance when the action completes.

Billing account recovery: use **Forgot password?** in the plugin settings to open the Constance reset page. Signing out clears the local tokens and requests server session revocation.

## Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the matching published release and place them in `.obsidian/plugins/aegis-note-locker/`, then enable the plugin in Obsidian.
