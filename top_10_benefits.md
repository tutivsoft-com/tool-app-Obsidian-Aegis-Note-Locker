# Top 10 Benefits of Aegis Note Locker

1. **Local Authenticated Encryption (AES-256-GCM)**
   - **Benefit:** Encrypts selected Markdown content locally with authenticated encryption.
   - **Example:** Lock private journal entries or financial records so they cannot be read in raw text editors.

2. **Selective Frontmatter Property Protection**
   - **Benefit:** Encrypt specific sensitive metadata properties while leaving general note metadata readable.
   - **Example:** Encrypt `api_secret: <ciphertext>` and `ssn: <ciphertext>` while keeping `title: Tax 2026` public.

3. **No Cloud Key Escrow**
   - **Benefit:** Encryption keys are derived on the device; billing accounts do not receive note keys.
   - **Example:** Your note-encryption passphrase is not uploaded or stored on an external server.

4. **Pre-Commit Decryption Verification**
   - **Benefit:** Tests decryption in memory before the encrypted content is written.
   - **Example:** A failed test stops the write and leaves the original note in place.

5. **Visible Placeholders for Locked Notes**
   - **Benefit:** Replaces locked note text with a clean placeholder, preventing accidental indexing by other plugins.
   - **Example:** Graph view, search indexing, and backlinks cannot read or leak private body text while locked.

6. **Sync Conflict & Staging Protections**
   - **Benefit:** Stages writes and checks whether the source changed before replacing it.
   - **Example:** If another device syncs a note while you are locking it, Aegis aborts rather than clobbering data.

7. **Encrypted Vault Backup Exports**
   - **Benefit:** Export encrypted note backups directly within your vault before performing major updates.
   - **Example:** Run *Aegis Note Locker: Export encrypted backup of current note* to keep a secure snapshot.

8. **Configurable Session Timeout & Instant Lock**
   - **Benefit:** Auto-locks unlocked notes when idle and provides an emergency *Lock Now* command.
   - **Example:** Sets decrypted notes to re-lock after 10 minutes of inactivity to protect against unattended access.

9. **Volatile In-Memory Undo Record**
   - **Benefit:** Roll back an accidental lock or unlock operation immediately during your active session.
   - **Example:** Execute *Aegis Note Locker: Roll back last operation* if you locked the wrong note by mistake.

10. **Free Unlock and Recovery Operations**
    - **Benefit:** Unlocking, viewing, encrypted export, and rollback do not consume protection uses.
    - **Example:** Use a protection credit only when successfully locking a note body or frontmatter values.
