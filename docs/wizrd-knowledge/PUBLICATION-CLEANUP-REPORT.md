# WiZrd Knowledge Publication Cleanup

**Release:** Version 2 content cleanup
**Date:** 2026-11-18

## Updated documents

The seven existing Markdown documents are prepared to align their frontmatter with the already-published Supabase records:

- `metoyou-identity.md`
- `feature-inventory.md`
- `user-guide.md`
- `community-guidelines.md`
- `privacy-and-safety.md`
- `product-roadmap.md`
- `founder-profile.md`

Each document now has `version: 2` and `status: "published"`. Stale introductory draft/unpublished notices were removed. Source references, keywords, categories, and `last_reviewed: "2026-11-18"` were retained.

## Content safeguards retained

- The feature inventory distinguishes checked-out implementation from confirmed production availability.
- The user guide does not promise that backend-dependent flows work in production.
- The Community Guidelines document states that no approved official policy was supplied and is an information notice, not a replacement policy.
- Privacy & Safety remains a repository-level verification document, not a privacy policy or security certification; unresolved access-policy questions remain.
- Product Roadmap possibilities remain explicitly unapproved commitments.
- Founder Profile contains only the approved identity: MaxiPop WiZrd (Tony Maxwell), creator and owner of MeToYou.

## Database and release status

These are corrected content files for Supabase AI to apply atomically to the existing records. No Supabase records were inserted, updated, or published by this task, and no application code or database schema was changed.
