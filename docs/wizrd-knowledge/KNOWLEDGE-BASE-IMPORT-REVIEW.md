# WiZrd Knowledge Base Import Review

**Status:** Review only — no Supabase records were inserted and nothing was published.
**Reviewed:** 2026-11-18
**Scope:** Seven draft documents under `docs/wizrd-knowledge/`, compared with the MeToYou Feature Audit Report and checked-in WiZrd function source.

## Executive decision

The seven documents are generally consistent with the audit and clearly labeled as drafts. No direct factual contradiction was found. They consistently distinguish checked-in implementation from verified production availability, do not invent community rules or founder biography, and avoid privacy guarantees.

**Do not treat database compatibility as verified and do not import yet.** The actual `wizrd_knowledge_documents` table definition referred to as previously supplied was not present in the checked-out project or the available review files. No live database query was made. Consequently, table column types, constraints, required fields and accepted status/category values cannot be confirmed here. The proposed field mapping below is conditional on checking the authoritative DDL before import.

## Content review

| Document | Review against the audit | Issues, limitations or approval needs |
|---|---|---|
| [MeToYou Identity](metoyou-identity.md) — `metoyou-identity` | The description is framed as a checked-out mobile project, not a production availability claim. Its feature summary and WiZrd caveats match the audit. The creator/owner identity is exactly the user-approved wording. | No direct contradiction. Product positioning, current supported platforms and WiZrd production readiness remain owner-verification questions. No biography beyond the approved identity is present. |
| [MeToYou Feature Inventory](feature-inventory.md) — `feature-inventory` | Implementation and production verification are separate for every row. The distinctions for local inbox actions, heuristic message requests, Clips/Flicks reposting, Clips publishing, calls, notifications, moderation, WiZrd and VibesPro match the audit. | No direct contradiction found. All production availability is correctly left unverified. The feature set and regional/platform/entitlement status still need current owner or release evidence. |
| [MeToYou User Guide](user-guide.md) — `user-guide` | Workflows and limits follow the audit: media creation types, device-local saves/actions, username-only search, message privacy caveat, call limitations and WiZrd uncertainty are stated. | No unsupported production guarantee found. The guide could add that native VibesPro upgrade/manage is unavailable; that limitation appears in the inventory but is not called out as a standalone guide topic. Confirm all navigation and account-dependent steps against the current released app before publication. |
| [MeToYou Community Guidelines](community-guidelines.md) — `community-guidelines` | Explicitly records that no official policy was found in the repository and does not invent rules, enforcement, response times or appeal promises. | Safe as a missing-source placeholder, not as community policy. Owner/legal approval and an authoritative policy source are required before it can teach rules or be presented as guidelines. Confirm whether the owner wants this placeholder imported at all. |
| [MeToYou Privacy and Safety](privacy-and-safety.md) — `privacy-and-safety` | Separates code-level observations from production-unverified protections. It accurately flags RLS, Storage, report/moderation, support and legal/case-handling gaps; it makes no end-to-end encryption, absolute privacy or staff-access claim. | No direct contradiction. The listed protections are not certification of deployed controls. Owner/security/legal review and authoritative deployed policy evidence are required before user-facing privacy statements. |
| [MeToYou Product Roadmap — Unconfirmed Items](product-roadmap.md) — `product-roadmap` | Separates partial work in code from ideas in `ROADMAP.md`/`ENHANCEMENT_PLAN.md`; labels the ideas awaiting approval and makes no dates or delivery promises. | No unapproved commitment is asserted. Confirm each item's approval state and whether repository planning documents are current before describing any as planned work. |
| [MeToYou Founder Profile](founder-profile.md) — `founder-profile` | Uses only “MaxiPop WiZrd (Tony Maxwell) is the creator and owner of MeToYou,” as supplied by the owner. | No unsupported biography found. Obtain owner confirmation before publication; do not extend the profile without an approved source. |

### Overall user-misleading-risk check

- No document presents the audit's “LIVE” implementation label as proof of production availability. The inventory labels production verification unverified.
- The guide presents source-evidenced workflows but prominently warns that they do not prove current production availability.
- The community placeholder is not a rule set. The privacy document does not promise confidentiality, encryption, or restricted staff access.
- The roadmap explicitly treats repository planning items as unapproved.
- All seven source documents have `status: draft`; they must remain drafts until separately approved and published.

## Database compatibility review

### Evidence available

- The checked-out repository contains no `CREATE TABLE` definition or migration for `public.wizrd_knowledge_documents`; a project search found no table DDL for it.
- The local `wizrd-chat` function calls `public.search_wizrd_knowledge(query, limit)` and reads `id`, `title`, `category`, `content`, and `version` from its result. It applies a top-three limit. This shows the function's expected RPC result shape, **not** the base table schema or the RPC's deployed implementation.
- No live database connection or schema introspection was performed.
- The prior database-definition artifact could not be located in the checked-out project or available review package. Therefore, the table definition and its types/constraints cannot be independently quoted or certified by this review.

### Conditional field mapping

The following is a proposed mapping using the field names in the document metadata. The first seven are **candidate database columns only** until confirmed against the authoritative `wizrd_knowledge_documents` DDL.

| Document metadata | Candidate existing field | Proposed import value / handling |
|---|---|---|
| `slug` | `slug` | The exact slug shown in the import plan below, if the column exists and its constraints permit it. |
| `title` | `title` | The document title shown below, if the column exists. |
| `category` | `category` | The exact category in the document frontmatter, if accepted by the column type or category constraint. |
| `content` | `content` | Markdown document text. Preserve `source_references` and `last_reviewed` within this value if they are not separately supported columns. |
| `status` | `status` | `draft`, only if the actual type/check constraint accepts it. Do not publish or change the value to `published`. |
| `version` | `version` | `1`, encoded according to the actual column type. |
| `keywords` | `keywords` | The keywords listed below, serialized according to the actual column type. |
| `source_references` | No separate column assumed | Preserve the references in `content` (they are already present in each Markdown file's frontmatter and source-reference section). Use a separate column only if the DDL confirms it. |
| `last_reviewed` | No separate column assumed | Preserve `2026-11-18` in `content` if no supported column exists. Use a separate column only if the DDL confirms it. |

For lossless draft import, use the complete Markdown text, including its frontmatter, as `content`; alternatively, if an importer strips frontmatter, it must add the `source_references` and `last_reviewed` values to the content before insertion. Do not silently drop either field.

Before any import, confirm: exact column names and types; nullability and defaults; whether `draft` is an allowed status; category constraints; keyword encoding; uniqueness/upsert behavior for `slug`; and whether the deployed search RPC excludes all non-published rows. The local caller's use of a published-knowledge RPC does not prove that the deployed function enforces that rule.

## Proposed draft import plan

All rows below remain **draft**. “Owner approval required” distinguishes approval of draft content/import from approval to publish; no publication is proposed.

| Title | Slug | Candidate fields to populate | Keywords | Version | Status | Owner approval required | Unresolved factual questions |
|---|---|---|---|---:|---|---|---|
| MeToYou Identity | `metoyou-identity` | `slug`, `title`, `category=product-identity`, `content`, `status`, `version`, `keywords`; preserve `source_references` and `last_reviewed` in `content` unless DDL confirms columns. | MeToYou; product identity; WiZrd; social app | 1 | draft | Yes before import approval; separate approval before publication. | Is this the approved product positioning? Which platforms and regions are currently supported? Is WiZrd production-ready and available? |
| MeToYou Feature Inventory | `feature-inventory` | `slug`, `title`, `category=product-features`, `content`, `status`, `version`, `keywords`; preserve non-column metadata in `content`. | features; implementation status; production availability; MeToYou | 1 | draft | Yes; verify current availability before publishing any status as user guidance. | Which listed features are actually deployed and accessible by platform, region, account tier and release version? |
| MeToYou User Guide | `user-guide` | `slug`, `title`, `category=user-guide`, `content`, `status`, `version`, `keywords`; preserve non-column metadata in `content`. | getting started; feed; stories; messages; profile; settings | 1 | draft | Yes; verify workflows against a current released build before publication. | Are routes, labels, permissions, entitlement gates and remote dependencies still accurate? What is the approved VibesPro purchase/manage guidance? |
| MeToYou Community Guidelines | `community-guidelines` | `slug`, `title`, `category=community-policy`, `content`, `status`, `version`, `keywords`; preserve non-column metadata in `content`. | community guidelines; community policy; reports; moderation | 1 | draft | Yes, including whether to import the missing-source placeholder. An official policy requires owner/legal approval and an authoritative source. | Does an approved policy exist outside the repository? What are its effective date, reporting/review process, appeals and response commitments? |
| MeToYou Privacy and Safety | `privacy-and-safety` | `slug`, `title`, `category=privacy-and-safety`, `content`, `status`, `version`, `keywords`; preserve non-column metadata in `content`. | privacy; safety; messages; reports; moderation; data access | 1 | draft | Yes; security/legal review required before publication. | What are the deployed RLS and Storage rules? Who can access messages, reports and support tickets? What are approved statements about encryption, staff access, retention and legal requests? |
| MeToYou Product Roadmap — Unconfirmed Items | `product-roadmap` | `slug`, `title`, `category=product-roadmap`, `content`, `status`, `version`, `keywords`; preserve non-column metadata in `content`. | roadmap; planned; development; owner approval | 1 | draft | Yes; each item requires explicit owner approval before it is represented as a commitment. | Which repository ideas are approved, exploratory, deferred or rejected? Are the roadmap files current? Are any dates approved for public communication? |
| MeToYou Founder Profile | `founder-profile` | `slug`, `title`, `category=founder-profile`, `content`, `status`, `version`, `keywords`; preserve non-column metadata in `content`. | founder; owner; creator; MaxiPop WiZrd; Tony Maxwell | 1 | draft | Yes before import/publication; use only the supplied identity unless additional facts are explicitly approved. | Is the exact identity wording approved for public use? No other biography facts are verified. |

### Import gate

Do not insert until the authoritative table definition is supplied or otherwise made available for review and the candidate column mapping, types, constraints and `draft` status are confirmed. Keep the seven source documents unchanged. Do not publish any row. This review document itself is not a migration or an instruction to execute SQL.

## Owner decisions required

1. Provide the authoritative `wizrd_knowledge_documents` DDL, including column types, constraints, defaults and uniqueness rules; confirm whether `source_references` and `last_reviewed` are columns.
2. Confirm the accepted `status` values and verify that the deployed `search_wizrd_knowledge` implementation returns only published documents.
3. Confirm whether storing the complete Markdown (including frontmatter) in `content` is the desired ingestion format.
4. Confirm feature production availability and applicable platform, region, entitlement and release limitations.
5. Supply approved community guidelines or confirm that the missing-source placeholder should remain the only draft.
6. Approve privacy/safety wording only after deployed RLS, Storage, reporting, moderation, staff-access and legal-request policies are verified.
7. Mark each roadmap idea approved, exploratory, deferred or rejected; supply approved public wording and dates only where authorized.
8. Confirm the founder identity wording; provide no additional biography unless it is explicitly verified and approved.

## References

- [MeToYou Feature Audit Report](../MeToYou-Feature-Audit-Report.md)
- [WiZrd chat function](../../supabase/functions/wizrd-chat/index.ts)
- [Draft knowledge documents](.)
