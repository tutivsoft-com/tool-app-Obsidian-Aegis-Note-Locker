# Aegis Note Locker — Product Requirements

Status: implemented — 3.3.16 documentation and release metadata

## Product promise

Aegis protects selected note content or frontmatter values with authenticated client-side encryption while keeping the rest of the vault understandable and recoverable.

## Security position

Encryption is not a cosmetic lock. The project must document its threat model before implementation. Aegis protects data at rest from ordinary vault inspection, but cannot protect content while it is unlocked, displayed, copied, or viewed on a compromised device.

## Product principles

- The note-encryption password, derived keys, and decrypted content are never sent to a server. The separate billing account password is used only for Constance sign-in.
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

18. Keep the password session-only; let the user set it in Settings so routine commands do not open password dialogs.
19. Explain that forgetting the password may make encrypted content unrecoverable.
20. Provide a user-initiated encrypted export or backup workflow without uploading secrets.
21. Never include plaintext in logs, error notices, crash reports, or clipboard operations.
22. Do not implement password recovery through a hidden developer key or remote service.
23. Provide a safe test-unlock step before committing a new encryption operation.
24. Ensure canceling an encryption operation leaves the original note unchanged.

## Safe file operations

25. Keep before/after review optional and off by default; use the Settings toggle when a user wants a review window.
26. Create a recoverable backup or undo record before changing source files.
27. Use atomic writes and verify the result can be decrypted before replacing the original.
28. Handle sync conflicts by refusing to overwrite and asking the user to resolve them.
29. Provide a rollback path for the last operation where the original is still available.
30. Document how encrypted notes behave with Obsidian Sync, Git, mobile devices, search, backlinks, embeds, and third-party plugins.

## AI decision

AI is explicitly not part of the MVP and should not be connected to protected content. Sending sensitive plaintext to a cloud AI service would undermine the product’s privacy promise. No AI credits are needed. A future local-only assistant may be considered only after the security model and memory-handling behavior are independently reviewed.

## Billing requirements

31. Meter only successful note-body and frontmatter-properties protection operations. The first three successful protection operations per local calendar day are free; each later successful protection operation costs one purchased use.
32. Keep unlock, view, encrypted export, and rollback free.
33. Use the current authenticated Constance account contract with the unique app ID `aegis-note-locker`: link the persisted random `constanceDeviceId` through `POST /api/v1/billing/installations/link`, poll `GET /api/v1/billing/entitlements/me`, claim free uses through `POST /api/v1/billing/free-usage/claim`, and spend paid uses through `POST /api/v1/billing/credits/spend`.
34. Persist the rotating access/refresh session locally without storing the password. Refresh access tokens through `POST /api/v1/auth/refresh`; clear the session only when refresh or account linking is rejected.
35. Use authenticated checkout through `POST /api/v1/billing/checkout` with the server-owned pack codes `one_time` and `standard`, a persisted `Idempotency-Key`, and a stable installation ID. Keep the live Paddle price IDs only for the legacy `GET /buy` fallback.
36. Payment fulfillment is webhook-authoritative. Checkout return/polling may refresh the entitlement snapshot but must never grant uses by itself. Aegis has no callback server, so signed callback headers and raw-body/HMAC verification are not applicable to this client.
37. Reserve free uses locally and refund the reservation if preparation or the vault write fails. Persist paid charge intent before writing, spend only after the verified vault write, and never assume an unavailable remote refund endpoint. On a confirmed insufficient response after a write, restore the original note before reporting failure.
38. Billing requests may contain only billing identity, app identity, and credit event metadata. Passwords, keys, note paths, plaintext, ciphertext, and protected properties must never be sent.

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
- The free daily protection allowance and all encryption operations work without AI or cloud key escrow; account and network access are needed for paid credit and checkout operations.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.3.20)

Aegis uses the configured property list and applies the operation directly. Password setup is done once per session in Settings; before-and-after review is optional and off by default.
<!-- one-click-workflow:end -->
