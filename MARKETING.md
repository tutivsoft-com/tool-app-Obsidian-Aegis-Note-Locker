# Aegis Note Locker Marketing

## Positioning

**Put selected Obsidian notes behind authenticated encryption.**

Aegis protects the note body or frontmatter values that a user chooses, while leaving the rest of the vault structure understandable. The encryption password stays on the device, and the plugin makes search and recovery tradeoffs visible before the write.

## Audience

- Obsidian users who keep sensitive details in Markdown notes.
- Users who need selected fields protected while keeping filenames and other metadata visible.
- People who want an explicit local encryption workflow rather than a cloud key vault.

## Product benefits

- Protect a whole note body or selected top-level properties.
- Preview each change and verify decryption before writing.
- Refuse stale-file overwrites and provide a session rollback path.
- Export an encrypted backup for migration and sync preparation.
- Lock all Markdown notes with progress and cancellation.

## Security boundaries

Aegis protects data at rest in vault files; it does not protect content while unlocked, visible on screen, copied, or present on a compromised device. Locked content is not searchable and may be unavailable to backlinks, embeds, and other plugins. Aegis cannot recover a forgotten password, and its volatile undo record is not a durable backup.

## Usage

Three successful protection operations are free per local calendar day. Additional successful body or property protection operations use purchased credits. Unlock, viewing, encrypted export, and rollback are free. Billing requests do not contain note content or encryption secrets.

## Listing

Official Obsidian Community listing: https://community.obsidian.md/plugins/aegis-note-locker

<!-- one-click-workflow:start -->
## Workflow defaults (v3.3.20)

Aegis uses the configured property list and applies the operation directly. Password setup is done once per session in Settings; before-and-after review is optional and off by default.
<!-- one-click-workflow:end -->
