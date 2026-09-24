# Aegis Note Locker Features

Version: 3.3.16

## Selective note protection

- Encrypt the body of the current Markdown note.
- Choose individual top-level frontmatter properties to protect; property names and unselected values remain readable.
- Add protection to another eligible property set on a note that already has protected properties.
- Lock and unlock from the command palette, lock ribbon icon, editor menu, and file menu.

## Encryption and safe writes

- Encrypt with AES-256-GCM and derive keys with PBKDF2-HMAC-SHA-256 using the versioned parameters described in the threat model.
- Generate a fresh random salt and nonce for each encrypted record.
- Store an algorithm- and format-versioned envelope with ciphertext and authentication data, never the password.
- Test-decrypt before changing the source note and fail closed for wrong passwords, damaged records, or unsupported formats.
- Run Lock, Unlock, Backup, and Rollback directly after configuring a session password in Settings. Optional review windows are off by default; stale-file checks and write verification always remain active.

## Recovery and session controls

- Export an encrypted copy of the current note into the configured vault backup folder.
- Roll back the most recent operation while its volatile undo record remains available.
- Lock all Markdown notes with progress and cancellation.
- Keep the unlock password in memory only for the configured session timeout; Lock now clears it immediately.
- Explain that sync conflicts must be resolved before Aegis can write.

## Usage and privacy

- The first three successful protection operations each local calendar day are free. Further successful body or property protection operations consume one purchased use.
- Unlock, view, encrypted backup export, and rollback do not consume protection uses.
- Optional Constance requests contain billing and usage metadata only; they never contain passwords, note paths, plaintext, ciphertext, or protected properties.
- Aegis has no AI feature, remote password reset, or cloud key escrow.

## Expected tradeoffs

- Locked text and properties are not searchable or available to backlinks, embeds, or third-party plugins.
- The path, filename, locked marker, and unprotected frontmatter remain visible.
- Plaintext can be exposed while a note is unlocked or on a compromised device; JavaScript cannot guarantee perfect memory zeroization.
- Forgetting a password may make protected content unrecoverable.
