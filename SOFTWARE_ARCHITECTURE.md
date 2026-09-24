# Aegis Note Locker Software Architecture

Version: 3.3.20

## Runtime boundary

Aegis is an Obsidian desktop community plugin. Obsidian provides the workspace, vault adapter, Markdown files, menus, settings, and plugin lifecycle. Encryption and decryption use the Web Crypto API locally. Optional account and credit operations are the only networked subsystem.

## Components

- src/main.ts owns plugin lifecycle, command registration, ribbon/menu integration, settings, note operations, bulk locking, encrypted backup export, rollback, and session state.
- src/frontmatter.ts parses and serializes Markdown frontmatter and identifies eligible top-level properties.
- src/crypto.ts derives keys and encrypts/decrypts versioned authenticated envelopes.
- src/safety.ts stages writes, checks the original file state, verifies results, and maintains the current operation's rollback record.
- src/types.ts defines settings, encrypted records, and undo data.
- src/ui.ts implements optional review and bulk progress views. Session credentials and default protected properties are configured in Settings.
- src/settings.ts presents protection, session, backup, and billing preferences.
- src/usage.ts tracks the local daily free-use allowance.
- src/billing.ts and src/constance-account.ts integrate account sign-in, allowance and credit checks, idempotent charge events, and checkout.
- src/plugin-support.ts exposes help, settings, and content-safe diagnostics.
- tests/ covers cryptographic envelopes, safe file handling, and usage accounting.

## Data flow

1. A command selects the current note or the requested set of Markdown notes.
2. Aegis reads the session-only password and configured property list. Review dialogs are shown only when enabled in Settings.
3. The crypto module serializes the protected content and encrypts it locally. Aegis tests decryption before it is committed.
4. The safety module verifies that the source has not changed, stages the new file, verifies the staged result, and then replaces the source.
5. Billing meters successful protection operations only. Usage metadata uses stable event identifiers; protected content and note paths stay out of network requests.
6. An undo snapshot is kept in volatile plugin memory for the active session. Encrypted exports are written into the vault and do not contain the password.

## Storage and security boundaries

Each note stores a versioned envelope in Aegis frontmatter. The envelope holds algorithm parameters, salt, nonce, ciphertext, and authentication data. The encryption password is never persisted. The unlock password and the last-operation undo data are volatile and are cleared on timeout, Lock now, unload, or restart.

A successful sign-in may persist rotating Constance session tokens in Obsidian plugin data. Billing requests contain account and usage metadata only. The vault's ordinary files, operating-system memory protections, user backups, password strength, and other installed plugins remain outside Aegis's protection boundary.

## Build and release

TypeScript sources in src/ are mirrored into publish/src/. The release build bundles publish/main.ts into publish/main.js. The public snapshot includes the complete source tree, manifest, stylesheet, license, documentation, and attestation workflow; GitHub release assets are main.js, manifest.json, and styles.css.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.3.20)

Aegis uses the configured property list and applies the operation directly. Password setup is done once per session in Settings; before-and-after review is optional and off by default.
<!-- one-click-workflow:end -->
