---
title: "MeToYou Privacy and Safety"
slug: "privacy-and-safety"
category: "privacy-and-safety"
version: 2
status: "published"
keywords:
  - privacy
  - safety
  - messages
  - reports
  - moderation
  - data access
source_references:
  - "../MeToYou-Feature-Audit-Report.md"
last_reviewed: "2026-11-18"
---

## Content

This is a repository-level verification document, not a privacy policy and not a security certification. It is also not a legal opinion or confirmation of production configuration.

### What the checked-out code supports

- Native authentication uses Supabase Auth, and authenticated routes redirect signed-out users.
- Some profile/chat paths read other users through a `public_profiles` view. The view definition and grants are not in the checked-in migrations.
- A checked-in blocked-user RPC derives the requesting user from `auth.uid()` and limits execution to authenticated users.
- The native-call migration includes participant-scoped access controls and call functions that perform identity and participant checks.
- The Stripe webhook source validates its provider signature.
- The client includes report submission and block/unblock flows. This proves client behavior, not that reports are safely stored or reviewed.

These are limited observations about checked-in code. They do not establish that the protections are deployed, configured correctly, or comprehensive.

### What is not verified

- **Core database permissions:** The checked-in migrations do not establish the production Row Level Security (RLS) policies for core tables such as messages, conversations, profiles, posts, stories, reports, notifications or support records.
- **Storage privacy:** The message client creates `getPublicUrl` links for message attachments. The repository does not establish whether the bucket is public or what its deployed object policies permit. Do not describe attachments as private or publicly accessible without checking authoritative bucket settings.
- **Private messages and staff access:** The checked-in client and migrations do not establish who can read messages in production. Do not claim end-to-end encryption, absolute privacy, or that staff/admins can or cannot access messages.
- **Profiles and media:** Profile-view fields, media visibility and audience controls were not confirmed. No private-profile control was found in the native UI.
- **Reports and moderation:** The app has report submission and a limited status/appeal UI, but report access policies, moderation queue, staffing, review decisions and response times are unknown.
- **Legal requests and case handling:** No law-enforcement/case-handling policy or workflow was found in the repository. Do not make claims about disclosure, preservation, escalation, or access to case data.
- **Support requests:** The client submits support tickets, but the access controls and operational handling are not established here.
- **Other backend paths:** The audit identified billing/admin code requiring owner/security review. Production deployment and exposure were not verified; this document does not claim those paths are or are not active.

### Safe response guidance

If asked whether a message, attachment, report, profile, or support request is private, explain that the checked-in repository does not verify the relevant production access policies. Do not assure the user about staff access or confidentiality. Refer the user to an owner-approved privacy notice or support contact only after its existence and current location are confirmed.

Do not give legal or incident-response assurances. If the question requires policy or production details, state that the authoritative information has not been supplied.

### Owner verification checklist

Before using this as user-facing privacy information, obtain and review:

1. The current privacy notice and terms, approved by the owner/legal reviewer.
2. Deployed RLS policies and grants for messages, conversations, profiles, posts, stories, reports, notifications and support records.
3. Storage bucket visibility, object policies, URL behavior, and attachment access paths.
4. Report/appeal access roles, review ownership, retention and user-facing response expectations.
5. Approved statements about staff access, encryption, law-enforcement requests, and case handling.
6. Confirmation that the protections described in code are present in the deployed environment.

## Source references

- [MeToYou Feature Audit Report](../MeToYou-Feature-Audit-Report.md)
- [Auth provider](../../src/native/contexts/NativeAuthProvider.tsx)
- [Supabase client](../../src/native/lib/supabase.ts)
- [Chat operations](../../src/native/lib/chat.ts)
- [Checked-in migrations](../../supabase/migrations)
