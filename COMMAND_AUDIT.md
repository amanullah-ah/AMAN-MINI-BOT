# Command registry notes — 2.4.0

- Duplicate patterns resolve to the latest registered handler, with the earlier duplicate omitted from the user-facing registry.
- Command names are no longer rewritten with plugin filenames.
- The menu shows quick-use commands first, management and utility categories next, and fun/emotion categories later.
- Owner-category commands are centrally restricted to owner accounts; the paired WhatsApp account is automatically an owner.
- Group/admin-category commands require a group admin or the paired bot owner.
- Run `npm run check:all` to check JavaScript syntax. This does not test WhatsApp login, MongoDB, or third-party API availability.
