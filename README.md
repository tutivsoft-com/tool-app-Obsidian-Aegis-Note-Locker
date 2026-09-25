# Aegis Note Locker

Version: `3.3.26`

Aegis protects individual Markdown note bodies and selected top-level frontmatter properties with local, authenticated encryption. It is an offline-first Obsidian plugin: encryption needs no account, AI, or cloud key escrow. Optional billing uses the current authenticated TutivSoft Constance installation/account flow for balance, checkout, and one-use charge events.

## What the MVP does

- Locks and unlocks the current note from the command palette, ribbon, editor menu, or file menu.
- Protects selected top-level frontmatter properties while leaving their names and other properties readable.
- Uses AES-256-GCM with a unique random salt and nonce for each encrypted record and versioned PBKDF2-HMAC-SHA-256 key derivation.
- Applies Lock, Unlock, and Backup directly with configured session defaults; optional review windows are off by default. It verifies decryption before replacement, checks for sync conflicts, and stages writes through a temporary file.
- Keeps a volatile undo record for the last operation and supports an encrypted backup export into the vault.
- Provides Lock All with progress and cancellation, a configurable session timeout, and an explicit Lock Now command.
- Includes three successful body/properties protection operations free per local calendar day, then one purchased use per successful protection operation. Unlock, view, export, and rollback are free.

Install Aegis from the Obsidian Community directory and enable it in Community plugins. The GitHub release also contains the runtime files for manual installation.

## Safe workflow

Set the session password and default protected properties in plugin settings. The password stays in memory only. Lock, Unlock, and Backup then run directly; **Review before applying** is an optional settings toggle. Aegis performs a test decrypt and refuses stale-file writes. **Aegis Note Locker: Roll back last operation** is available while the plugin session still holds its in-memory undo record.

Locked note bodies are replaced by a visible placeholder; encrypted values are ciphertext in the vault file. This means normal Markdown search, property indexing, backlinks, embeds, and third-party plugins cannot read protected content while locked. File paths and unprotected frontmatter remain available. Links that live inside a locked body are not available to Obsidian's graph until the note is unlocked; links kept in unprotected frontmatter remain visible where Obsidian supports them.

## Security and privacy

The note-encryption password and plaintext are never written to logs, clipboard, network requests, or plugin settings. A separate billing account password is submitted only to authenticate with Constance; it is not retained as a password. Rotating billing session tokens are stored in Obsidian plugin data. Billing requests contain account/app identifiers, checkout metadata, and credit event IDs, never note paths, encrypted envelopes, encryption passwords, or protected content. Payment fulfillment remains webhook-authoritative and the plugin refreshes entitlements by polling.

## License

MIT. See [LICENSE](LICENSE).

<!-- one-click-workflow:start -->
## Workflow defaults (v3.3.26)

Aegis uses the configured property list and applies the operation directly. Password setup is done once per session in Settings; before-and-after review is optional and off by default.
<!-- one-click-workflow:end -->
