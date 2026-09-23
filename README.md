# Aegis Note Locker

Version: `3.3.16`

Aegis protects individual Markdown note bodies and selected top-level frontmatter properties with local, authenticated encryption. It is an offline-first Obsidian plugin: encryption needs no account, AI, or cloud key escrow. Optional billing uses the current authenticated TutivSoft Constance installation/account flow for balance, checkout, and one-use charge events.

## What the MVP does

- Locks and unlocks the current note from the command palette, ribbon, editor menu, or file menu.
- Protects selected top-level frontmatter properties while leaving their names and other properties readable.
- Uses AES-256-GCM with a unique random salt and nonce for each encrypted record and versioned PBKDF2-HMAC-SHA-256 key derivation.
- Shows a review step before changes, verifies decryption before replacement, checks for sync conflicts, and stages writes through a temporary file.
- Keeps a volatile undo record for the last operation and supports an encrypted backup export into the vault.
- Provides Lock All with progress and cancellation, a configurable session timeout, and an explicit Lock Now command.
- Includes three successful body/properties protection operations free per local calendar day, then one purchased use per successful protection operation. Unlock, view, export, and rollback are free.

Install by placing `publish/main.js`, `publish/manifest.json`, and `publish/styles.css` in `.obsidian/plugins/aegis-note-locker/`, then enable Aegis in Obsidian. For development, run `npm install` and `npm run build`.

## Safe workflow

Before locking anything, make a normal vault backup or use **Aegis Note Locker: Export encrypted backup of current note**. Aegis shows a preview, asks for password confirmation when creating an encryption record, performs a test decrypt, and only then replaces the source. If a file changes between preview and commit, the operation is refused. **Aegis Note Locker: Roll back last operation** is available while the plugin session still holds its in-memory undo record.

Locked note bodies are replaced by a visible placeholder; encrypted values are ciphertext in the vault file. This means normal Markdown search, property indexing, backlinks, embeds, and third-party plugins cannot read protected content while locked. File paths and unprotected frontmatter remain available. Links that live inside a locked body are not available to Obsidian's graph until the note is unlocked; links kept in unprotected frontmatter remain visible where Obsidian supports them.

## Security and privacy

The note-encryption password and plaintext are never written to logs, clipboard, network requests, or plugin settings. A separate billing account password is submitted only to authenticate with Constance; it is not retained as a password. Rotating billing session tokens are stored in Obsidian plugin data. Billing requests contain account/app identifiers, checkout metadata, and credit event IDs, never note paths, encrypted envelopes, encryption passwords, or protected content. Payment fulfillment remains webhook-authoritative and the plugin refreshes entitlements by polling.

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), [docs/USER_GUIDE.md](docs/USER_GUIDE.md), and [docs/PRIVACY.md](docs/PRIVACY.md) for limitations, recovery behavior, and sync guidance.

See [Features](FEATURES.md), [Requirements](REQUIREMENTS.md), [Software Architecture](SOFTWARE_ARCHITECTURE.md), and [Marketing](MARKETING.md) for the product and implementation overview.

## Development

```text
npm install
npm run check
npm run build
```

The source is under `src/`; the `publish/` directory is the public release zone and contains a mirrored source tree plus the generated runtime artifact. Aegis has no AI integration. The live Paddle price IDs are configured in the auditable billing map.

## License

MIT. See [LICENSE](LICENSE).
