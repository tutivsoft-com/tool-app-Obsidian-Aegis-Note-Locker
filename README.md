# Aegis Note Locker

Version: `3.3.4`

Aegis protects individual Markdown note bodies and selected top-level frontmatter properties with local, authenticated encryption. Encryption requires no account, AI, or cloud key escrow. Optional billing uses TutivSoft Constance only for balance, checkout, and one-use charge events.

## Installation

Install Aegis from the Obsidian Community directory, or copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/aegis-note-locker/` in a vault and enable the plugin under **Settings → Community plugins**. For development, run `npm install` and `npm run build` from the source repository.

## Basic usage

Open a Markdown note and run **Aegis: Lock current note** from the command palette, ribbon, editor menu, or file menu. Review the preview, create and confirm a password, and wait for the success notice. Use **Aegis: Unlock current note** to restore protected content, **Aegis: Lock now (clear session)** when leaving the device, and **Aegis: Roll back last operation** when the in-memory undo record is still available.

To protect only selected frontmatter values, run **Aegis: Lock selected frontmatter properties**. Aegis previews the change, verifies decryption before replacement, refuses stale or conflicting writes, and keeps a visible locked placeholder in the note.

## Billing

The first three successful body/properties protection operations per local calendar day are free. After that, each successful protection operation uses one purchased credit. Unlock, view, encrypted export, and rollback remain free. The $1 pack contains 100 uses and the $10 pack contains 1,000 uses.

Aegis follows Torbert's unsigned Constance browser-relay pattern with app ID `aegis-note-locker`: balance sync, one-use credit spends, and a system-browser checkout handoff. The live Paddle price IDs are configured in the auditable billing map. Billing requests contain only the app ID, a random install ID, billing email for checkout, and event IDs; they never contain passwords, keys, note paths, plaintext, ciphertext, or protected properties. A charge intent is persisted before a paid write and charged only after the verified write; uncertain charges retry with the same event ID.

## Security and recovery

Protected content is not searchable by normal Markdown search, property indexing, backlinks, embeds, or third-party plugins while locked. Passwords and plaintext are never written to logs, settings, clipboard, or network requests. Always keep a normal vault backup and read the [user guide](docs/USER_GUIDE.md), [threat model](docs/THREAT_MODEL.md), and [privacy notes](docs/PRIVACY.md) before protecting important notes.

## Development

```text
npm install
npm run check
npm run build
```

The public source is included in this repository for review. Aegis has no AI integration. The published source tree mirrors the development source tree.

## License

MIT. See [LICENSE](LICENSE).
