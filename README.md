# Aegis Note Locker

Aegis protects individual Markdown note bodies and selected top-level frontmatter properties with local, authenticated encryption. It requires no account, network service, AI, or cloud key escrow.

## Installation

Install Aegis from the Obsidian Community directory, or copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/aegis-note-locker/` in a vault and enable the plugin under **Settings → Community plugins**. For development, run `npm install` and `npm run build` from the source repository.

## Basic usage

Open a Markdown note and run **Aegis: Lock current note** from the command palette, ribbon, editor menu, or file menu. Review the preview, create and confirm a password, and wait for the success notice. Use **Aegis: Unlock current note** to restore protected content, **Aegis: Lock now (clear session)** when leaving the device, and **Aegis: Roll back last operation** when the in-memory undo record is still available.

To protect only selected frontmatter values, run **Aegis: Lock selected frontmatter properties**. Aegis previews the change, verifies decryption before replacement, refuses stale or conflicting writes, and keeps a visible locked placeholder in the note.

## Security and recovery

Protected content is not searchable by normal Markdown search, property indexing, backlinks, embeds, or third-party plugins while locked. Passwords and plaintext are never written to logs, settings, clipboard, or network requests. Always keep a normal vault backup and read the [user guide](docs/USER_GUIDE.md), [threat model](docs/THREAT_MODEL.md), and [privacy notes](docs/PRIVACY.md) before protecting important notes.

## Development

```text
npm install
npm run check
npm run build
```

The public source is included in this repository for review. Aegis has no AI integration and no server dependency.

## License

MIT. See [LICENSE](LICENSE).
