# Aegis user guide

## Lock a note

Open a Markdown note and run **Aegis Note Locker: Lock current note**. Review the warning, create and confirm a password, and wait for the success notice. The filename and readable frontmatter remain; the body becomes a placeholder and the encrypted envelope is stored in the note's frontmatter.

## Protect frontmatter values

Run **Aegis Note Locker: Lock selected frontmatter properties**, choose top-level properties, review the list, and confirm. Property names stay readable, while values are replaced by `Protected by Aegis` and encrypted records are kept in the Aegis marker. Locking the same note again lets you add more properties.

## Unlock and lock the session

Run **Aegis Note Locker: Unlock current note** and provide the password. Aegis verifies the authenticated record before writing anything. The password is kept only in memory until the timeout in Settings. Use **Aegis Note Locker: Lock now (clear session)** whenever you leave the device.

## Recovery and backups

Use **Aegis Note Locker: Export encrypted backup of current note** before a migration or a risky sync. The export is a password-protected `.aegis` file in the configured vault-relative folder. It does not contain a password. **Aegis Note Locker: Roll back last operation** restores the last changed note(s) only when the current file still matches Aegis's expected result.

The undo record is intentionally volatile: it is cleared on timeout, Lock Now, unload, and restart. Keep a normal vault backup as your durable recovery path.

## Billing

The first three successful note-body or frontmatter-properties protection operations on each local calendar day are free. Later successful protection operations use one purchased use each. Unlocking, viewing, encrypted export, and rollback are always free. Settings offers one-time packs of $1 for 100 uses and $10 for 1,000 uses using the live Aegis catalog price IDs.

When a paid protection is needed, Aegis records a charge intent before changing the note and charges it only after the encrypted write has been verified. A failed write does not consume a purchased use. If a charge request is uncertain, Aegis keeps the note protected and retries the same event ID later, while preventing another paid protection from starting until that charge is reconciled.

## Sync, search, and mobile

Obsidian Sync and Git can synchronize ciphertext, but conflicts must be resolved before Aegis will overwrite a file. Do not edit the encrypted marker by hand. Search, backlinks, embeds, properties, and plugins cannot inspect locked content; this is an intentional security tradeoff. Mobile can carry ciphertext, but unlocking depends on the same password and the mobile runtime's Web Crypto support. Always test a copy of a vault before adopting a sync workflow.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.3.20)

Aegis uses the configured property list and applies the operation directly. Password setup is done once per session in Settings; before-and-after review is optional and off by default.
<!-- one-click-workflow:end -->
