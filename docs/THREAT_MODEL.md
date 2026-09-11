# Aegis threat model

## Protected against

Aegis protects selected note data at rest from ordinary inspection of the vault files, accidental exposure through Markdown/property indexing, and undetected ciphertext tampering. Each record uses AES-256-GCM with a fresh 96-bit nonce and 128-bit random salt. The password is converted to an AES key with versioned PBKDF2-HMAC-SHA-256 using 310,000 iterations. The GCM tag is included in the authenticated ciphertext.

The envelope format is version 1 and contains `v`, `alg`, `kdf`, `iterations`, `salt`, `iv`, `ciphertext`, and the GCM `tag`. It never stores a password or plaintext. Unsupported, truncated, or modified envelopes fail closed before any replacement is written. Future cryptographic changes must introduce a new format version and migration path rather than silently reinterpreting version 1.

## Not protected against

Encryption cannot protect a plaintext note while it is unlocked, displayed in an editor, copied, rendered, indexed by a trusted local process, or present in memory on a compromised device. Malware with the user's permissions, malicious or compromised Obsidian plugins, screenshots, swap/page files, backups made outside Aegis, and a weak or reused password are outside this MVP's protection boundary. The runtime cannot guarantee perfect memory zeroization for JavaScript strings or Web Crypto keys.

## Operational choices

The password is kept in memory only for the configured session timeout and is cleared on Lock Now, timeout, unload, or an error path. A volatile undo record may contain the original plaintext until that same boundary; it is never persisted to plugin data. User-requested exports encrypt the entire source note before writing a `.aegis` file. No network request is made by the plugin.

Locked bodies and protected values are intentionally not searchable. Paths and unprotected metadata remain visible, and frontmatter links may continue to support graph behavior. Links in a locked body disappear from graph/index behavior until unlock. Sync and Git can safely transport ciphertext, but Aegis refuses stale-file overwrites so users must resolve conflicts explicitly.
