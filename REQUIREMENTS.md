# Aegis Note Locker — Product Requirements

Status: implemented — 3.3.0 MVP released

## Product promise

Aegis protects selected note content or frontmatter values with authenticated client-side encryption while keeping the rest of the vault understandable and recoverable.

## Security position

Encryption is not a cosmetic lock. The project must document its threat model before implementation. Aegis protects data at rest from ordinary vault inspection, but cannot protect content while it is unlocked, displayed, copied, or viewed on a compromised device.

## Product principles

- No password, plaintext key, or decrypted content is sent to a server.
- Never claim that encrypted content remains searchable when the index cannot read it.
- Make lock and unlock state obvious.
- Prefer authenticated failure over best-effort decryption.
- Recovery and backup behavior must be explained before the user encrypts anything.

## MVP locking model

1. Lock and unlock an individual Markdown note from the command palette and note menu.
2. Lock selected top-level frontmatter properties while leaving unprotected properties readable.
3. Preserve the note path, filename, and a minimal locked marker so the vault does not lose its file identity.
4. Preserve user-selected unencrypted links and graph metadata where possible.
5. Make the locked body and protected values unreadable to normal Markdown and property indexing while locked; explain this limitation clearly.
6. Support a session unlock state with configurable timeout and an explicit Lock Now command.
7. Provide Lock All and Unlock Current Note actions.
8. Show locked notes and protected properties with a clear, non-sensitive placeholder.

## Cryptographic requirements

9. Use authenticated encryption with AES-256-GCM or a comparably reviewed construction that provides confidentiality and integrity.
10. Derive encryption keys from the user password using a memory-hard KDF such as Argon2id when a reviewed implementation is available; otherwise use a strong, versioned PBKDF2-HMAC-SHA-256 configuration supported by the runtime.
11. Generate a unique random salt and nonce/IV for each encrypted record.
12. Store a versioned envelope containing algorithm identifiers, KDF parameters, salt, nonce, ciphertext, and authentication tag—never the password.
13. Reject tampered, truncated, or unsupported envelopes without exposing partial plaintext.
14. Never reuse a nonce with the same encryption key.
15. Clear temporary plaintext and key material as far as the runtime permits after lock, timeout, error, or unload.
16. Use constant-time comparisons for authentication checks where applicable.
17. Include an explicit format version and migration path before changing cryptographic parameters.

## Password and recovery UX

18. Require password confirmation before first encryption.
19. Explain that forgetting the password may make encrypted content unrecoverable.
20. Provide a user-initiated encrypted export or backup workflow without uploading secrets.
21. Never include plaintext in logs, error notices, crash reports, or clipboard operations.
22. Do not implement password recovery through a hidden developer key or remote service.
23. Provide a safe test-unlock step before committing a new encryption operation.
24. Ensure canceling an encryption operation leaves the original note unchanged.

## Safe file operations

25. Preview the impact before encrypting or decrypting a note or property batch.
26. Create a recoverable backup or undo record before changing source files.
27. Use atomic writes and verify the result can be decrypted before replacing the original.
28. Handle sync conflicts by refusing to overwrite and asking the user to resolve them.
29. Provide a rollback path for the last operation where the original is still available.
30. Document how encrypted notes behave with Obsidian Sync, Git, mobile devices, search, backlinks, embeds, and third-party plugins.

## AI decision

AI is explicitly not part of the MVP and should not be connected to protected content. Sending sensitive plaintext to a cloud AI service would undermine the product’s privacy promise. No AI credits are needed. A future local-only assistant may be considered only after the security model and memory-handling behavior are independently reviewed.

## Useful post-MVP features

- Vault-level key wrapping with separate per-note data keys.
- Multiple protected profiles or key slots.
- Lock-on-sleep and lock-on-workspace-change policies.
- Read-only secure preview mode.
- Protected attachments with streaming encryption.
- Security audit log containing events but never content.
- Independent cryptographic review and a documented migration tool.

## Out of scope for the MVP

- Remote password reset or server-side key escrow.
- Cloud AI or cloud decryption.
- Promising full-text search over encrypted content.
- Encrypting the entire vault transparently while claiming compatibility with every plugin.

## Acceptance criteria

- A locked note cannot be read as plaintext from the vault files without the password.
- A wrong password, tampered envelope, or corrupted record fails safely and visibly.
- Unprotected note structure and graph links remain intact where the configured mode permits.
- Encryption and decryption are previewed, recoverable, and atomic.
- Passwords and plaintext never appear in logs or network requests.
- The MVP is fully useful without AI, an account, or an internet connection.
