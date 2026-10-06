# Aegis Note Locker

Protect a note body or selected top-level frontmatter values locally using password-derived authenticated encryption.

Current version: **3.3.57**.

## First use

Enable the plugin and use its settings page. Simple is the default settings mode; Advanced exposes optional configuration. Set the session password in plugin settings, open a Markdown note, then run Lock current note or Lock selected frontmatter properties.

AES-256-GCM encryption uses PBKDF2-derived keys, random salts and nonces, and a versioned envelope. Passwords stay in session memory. Optional review defaults off. Writes verify source and output; the last operation has volatile rollback data. Lock now clears the cached session rather than re-encrypting plaintext notes already unlocked on disk.

## Account and processing

Processing is local. This plugin has no AI provider integration. Constance handles account and billing operations.

One completed protection operation consumes one unit. New protection uses durable account authorization and verified-write recovery. Unlock, viewing, rollback and backup of already protected content do not create a new protection debit; exporting an unprotected note creates protection.

Connect the existing Constance account in settings; registration can require email verification before signing in again. Billing account passwords are sent for authentication and are not persisted. Access/refresh session data and a stable installation identity are saved locally. Account free usage and purchased balance are determined by Constance; cached values and checkout return URLs do not create entitlement. Catalog displays current formatted names, prices, availability and exact price IDs. Unknown usage and checkout results retain their original identities for recovery.

## Diagnostics

Help is available in settings and through Open documentation. Open plugin settings and Copy full debug log are command-palette fallbacks. Debug logging defaults off for a new installation; failures and full Error objects/stacks still appear in the local developer console. Timed information is enabled by the debug preference. The copyable diagnostic buffer keeps at most 1,000 summarized events and excludes raw error text, stacks, note text, paths and credentials. Full console exceptions can contain whatever the failed operation placed in its error. Logs are not uploaded automatically.

## Documentation


License terms are in LICENSE.
