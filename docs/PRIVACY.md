# Privacy statement

Aegis Note Locker encrypts note content locally. It does not collect analytics, call an AI service, or upload vault content. The note-encryption password, keys, decrypted content, note paths, encrypted envelopes, and protected properties are not placed in notices, logs, clipboard data, plugin settings, or billing requests. A separate billing account password is submitted only to authenticate with TutivSoft Constance; it is not retained as a password. Optional billing requests contain the app ID, a random installation ID, account/usage metadata, and checkout details. The account session uses rotating tokens stored in Obsidian plugin data.

The plugin stores its session timeout and backup-folder preference in Obsidian plugin data. Encrypted note envelopes and user-requested encrypted exports are stored in the vault. The export includes a source path label so the user can identify it; the note content itself is encrypted.

Install only plugin builds you trust. A compromised device or another plugin with access to the unlocked editor can still read plaintext; client-side encryption does not change that boundary.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.3.20)

Aegis uses the configured property list and applies the operation directly. Password setup is done once per session in Settings; before-and-after review is optional and off by default.
<!-- one-click-workflow:end -->
