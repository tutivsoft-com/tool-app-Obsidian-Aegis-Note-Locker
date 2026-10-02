# Aegis Note Locker

Version: 3.3.36

Protect note bodies and selected frontmatter values with local authenticated encryption.

## Features

- Lock and unlock the current note from Obsidian commands and context menus.
- Protect selected top-level frontmatter properties while leaving their names readable.
- Encrypt locally with AES-256-GCM and a unique random salt and nonce per record.
- Verify decryption before replacing content and refuse stale-file writes.
- Keep a volatile undo record for the last operation and export encrypted backups into the vault.
- Keep encryption passwords in memory only; no AI, cloud key escrow, or remote note processing.

## Billing

Account balances, entitlements, and checkout are managed by Constance. The plugin fetches current purchase descriptions, amounts, and availability from the live product catalog. It displays the server-provided offer before checkout. Protection uses the app's native protection-operation units.

## Installation

In Obsidian, open **Settings → Community plugins → Browse**, search for **Aegis Note Locker**, install it, and enable it.

## License

MIT. See [LICENSE](LICENSE).
