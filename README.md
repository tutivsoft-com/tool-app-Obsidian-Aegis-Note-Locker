# Aegis Note Locker

Version: `3.3.7`

Aegis protects individual Markdown note bodies and selected top-level frontmatter properties with local, authenticated encryption. It is an offline-first Obsidian plugin: encryption needs no account, AI, or cloud key escrow. Optional billing uses TutivSoft Constance only for balance, checkout, and one-use charge events.

## What the MVP does

- Locks and unlocks the current note from the command palette, ribbon, editor menu, or file menu.
- Protects selected top-level frontmatter properties while leaving their names and other properties readable.
- Uses AES-256-GCM with a unique random salt and nonce for each encrypted record and versioned PBKDF2-HMAC-SHA-256 key derivation.
- Shows a review step before changes, verifies decryption before replacement, checks for sync conflicts, and stages writes through a temporary file.
- Keeps a volatile undo record for the last operation and supports an encrypted backup export into the vault.
- Provides Lock All with progress and cancellation, a configurable session timeout, and an explicit Lock Now command.
- Includes three successful body/properties protection operations free per local calendar day, then one purchased use per successful protection operation. Unlock, view, export, and rollback are free.

Install by placing the root-level `main.js`, `manifest.json`, and `styles.css` from this repository in `.obsidian/plugins/aegis-note-locker/`, then enable Aegis in Obsidian. This public release repository is a source-inclusive snapshot and does not contain the private source repository's npm build metadata; build changes from the mapped private source checkout before mirroring a release here.

## Safe workflow

Before locking anything, make a normal vault backup or use **Aegis: Export encrypted backup of current note**. Aegis shows a preview, asks for password confirmation when creating an encryption record, performs a test decrypt, and only then replaces the source. If a file changes between preview and commit, the operation is refused. **Aegis: Roll back last operation** is available while the plugin session still holds its in-memory undo record.

Locked note bodies are replaced by a visible placeholder; encrypted values are ciphertext in the vault file. This means normal Markdown search, property indexing, backlinks, embeds, and third-party plugins cannot read protected content while locked. File paths and unprotected frontmatter remain available. Links that live inside a locked body are not available to Obsidian's graph until the note is unlocked; links kept in unprotected frontmatter remain visible where Obsidian supports them.

## Security and privacy

Passwords and plaintext are never written to logs, clipboard, network requests, or plugin settings. Billing requests contain only the app ID, a random per-install device ID, billing email for checkout, and credit event IDs; they never contain note paths, encrypted envelopes, passwords, or protected content. The password is held only in memory for the configured session timeout and is cleared by Lock Now, timeout, unload, or error. The encrypted envelope stores only algorithm identifiers, KDF parameters, salt, nonce, and ciphertext with its GCM authentication tag.

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), [docs/USER_GUIDE.md](docs/USER_GUIDE.md), and [docs/PRIVACY.md](docs/PRIVACY.md) for limitations, recovery behavior, and sync guidance.

## Development

The source is under `src/`, with the generated Obsidian runtime artifact at the repository root as `main.js`. The root `manifest.json`, `styles.css`, `VERSION`, source tree, and documentation are the public release surface. Aegis has no AI integration. The live Paddle price IDs are configured in `src/billing.ts`; the plugin calls the TutivSoft Constance relay rather than Paddle directly.

## License

MIT. See [LICENSE](LICENSE).
