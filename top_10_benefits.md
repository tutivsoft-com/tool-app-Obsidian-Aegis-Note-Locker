# Top 10 Benefits of Aegis Note Locker

1. **Local Authenticated Encryption (AES-256-GCM)**
   - **Benefit:** Encrypts sensitive Markdown notes using military-grade authenticated encryption.
   - **Example:** Lock private journal entries or financial records so they cannot be read in raw text editors.

2. **Selective Frontmatter Property Protection**
   - **Benefit:** Encrypt specific sensitive metadata properties while leaving general note metadata readable.
   - **Example:** Encrypt `api_secret: <ciphertext>` and `ssn: <ciphertext>` while keeping `title: Tax 2026` public.

3. **No Cloud Key Escrow or Account Requirement**
   - **Benefit:** Keys are derived locally on your device via PBKDF2-HMAC-SHA-256 with zero third-party cloud dependence.
   - **Example:** Your master passphrase never leaves your device and is never stored on any external server.

4. **Pre-Commit Decryption Verification**
   - **Benefit:** Verifies that ciphertext can be successfully decrypted in memory before writing changes to disk.
   - **Example:** Guarantees you never end up with an unrecoverable corrupted file due to an encryption glitch.

5. **Visible Placeholders for Locked Notes**
   - **Benefit:** Replaces locked note text with a clean placeholder, preventing accidental indexing by other plugins.
   - **Example:** Graph view, search indexing, and backlinks cannot read or leak private body text while locked.

6. **Sync Conflict & Staging Protections**
   - **Benefit:** Writes through temporary files and checks file hashes to prevent Obsidian Sync conflicts.
   - **Example:** If another device syncs a note while you are locking it, Aegis aborts rather than clobbering data.

7. **Encrypted Vault Backup Exports**
   - **Benefit:** Export encrypted note backups directly within your vault before performing major updates.
   - **Example:** Run *Aegis: Export encrypted backup of current note* to keep a secure snapshot.

8. **Configurable Session Timeout & Instant Lock**
   - **Benefit:** Auto-locks unlocked notes when idle and provides an emergency *Lock Now* command.
   - **Example:** Sets decrypted notes to re-lock after 10 minutes of inactivity to protect against unattended access.

9. **Volatile In-Memory Undo Record**
   - **Benefit:** Roll back an accidental lock or unlock operation immediately during your active session.
   - **Example:** Execute *Aegis: Roll back last operation* if you locked the wrong note by mistake.

10. **Daily Free Operations & Free Unlocks**
    - **Benefit:** Unlocking, viewing, reading, and exporting encrypted notes is completely free forever.
    - **Example:** View and unlock all your protected notes without any credit deductions or fees.