---
title: "MeToYou Feature Inventory"
slug: "feature-inventory"
category: "product-features"
version: 2
status: "published"
keywords:
  - features
  - implementation status
  - production availability
  - MeToYou
source_references:
  - "../MeToYou-Feature-Audit-Report.md"
last_reviewed: "2026-11-18"
---

## Content

“Implementation status” below describes evidence in the checked-out repository only. It is separate from confirmed production availability, which was not independently verified for any feature in this audit.

### How to read this inventory

- **Implementation status** describes what the checked-out code does: implemented, partial/gated, UI-only, or not found.
- **Production verification** is separate. The audit did not query production, inspect deployed database policies, or confirm remote service configuration. Treat availability as **unverified** unless a current authoritative source confirms it.
- A screen, button, API helper, database type, or local Edge Function is not by itself proof of a working production feature.

| Feature | Implementation status in checked-out code | Production availability verification |
|---|---|---|
| Email/password sign-up and sign-in | Implemented in native screens and Supabase Auth helpers; authenticated routes redirect signed-out users. | Unverified. Supabase Auth configuration and deployed app behavior were not checked. |
| Google and Apple authentication | UI-only; buttons report “coming soon” and do not call an identity provider. | Not available through the checked-in native flow; production status otherwise unverified. |
| Feed and text/image posts | Implemented: feed pagination, text/image composer, likes, comments, editing/deletion, sharing, highlighting and local saved-post identifiers. Ordinary post repost is a placeholder. | Unverified. Remote tables, storage, policies and production behavior were not checked. |
| Stories | Implemented for text and photo creation, viewing, sharing, local saving and owner deletion. Voice-story data types do not correspond to a native creation flow. | Unverified. Remote schema, storage, policies and deployment were not checked. |
| Profiles and social connections | Implemented: profile viewing/editing, profile picture, follows, followers/following and mutual-friend browsing. | Unverified. `public_profiles` view definition and grants are absent from checked-in migrations. |
| People search | Implemented for debounced username search and navigation to a selected profile. | Unverified. Remote access and production behavior were not checked. |
| Direct messaging | Implemented in the client for text, attachments, voice notes, replies, forwarding, reactions, editing/deleting, read receipts, typing/presence and Realtime updates. | Unverified. Message RLS and Storage policies are not established by this checkout. |
| Inbox organization and message requests | Implemented, with pin/unread/archive/hide state stored locally. The Spam/request classification is a mutual-follow/message-direction heuristic. Search and Message settings are placeholders. | Unverified. Local-only actions should not be described as cross-device features. |
| In-app notifications | Implemented screen and Realtime client handling for viewing, marking read, deleting and refreshing notifications. | Unverified. Remote table and Realtime policies are not present in the checked-in migrations. General OS push notifications are not established. |
| Clips | Playback, pagination, item actions and reposting to Feed are implemented; VibesPro entitlement gates the feed. A production publish flow is absent from the Clips screen; helper/prototype code exists. | Unverified. Entitlement, media backend and deployment were not checked. |
| Flicks | Image browsing and photo publishing with caption from camera/gallery are implemented; reposting to Feed is present. | Unverified. Camera, Storage and backend configuration were not checked. |
| Tracks and device audio | Remote audio playback and local MP3 selection are implemented, with entitlement/platform limitations. No native music upload flow was found. | Unverified. Entitlement and remote audio availability were not checked. |
| Audio/video calls | Partially implemented: WebRTC setup, call UI, signaling, call history, device registration and call push code exist. Requires a custom build; README notes no TURN relay or system call UI, and end-to-end operation is not established. | Unverified. Deployment, push delivery, background/terminated behavior and production reliability were not tested. |
| Call history | Native screen and redial interactions are implemented. | Unverified. Call-history schema and access policies are not established by the migrations. |
| Offline games | Local implementations of Tetris, Bubble Shooter, Yahtzee and Tesla Roadster Race are present. Game Feed is a placeholder. | Local code is present; production build availability was not checked. Multiplayer/shared scores were not found. |
| Account settings and preferences | Implemented profile/preferences, theme, language selection, blocked-user management, support submission and sign-out. Translations are incomplete; Help Center and About are placeholders. | Unverified. Remote storage/policies and support handling were not checked. |
| Reporting and blocking | Report submission UI and block/unblock actions are implemented. A blocked-user RPC migration derives identity from `auth.uid()`. Report review is not established. | Unverified. Report policies, operations and moderation staffing were not checked. |
| Moderation status and appeals | Partial UI/API path: VibesPro profile UI calls moderation status and can submit appeal details. Review workflow and policies are not established. | Unverified. |
| WiZrd assistant | Native chat, history, streaming client, local `wizrd-chat` function and published-document search call are present. | Unverified. Deployed function, schema, grants, knowledge content and provider operation were not checked. |
| VibesPro subscription/entitlement | Entitlement fields and content gates are present. Native upgrade/manage flow is explicitly unavailable; billing API handlers also exist. | Unverified. Provider configuration and entitlement consistency were not checked. |
| Market, Game Feed, saved collections, communities/groups, creator analytics, general content search, OAuth, message search/settings, Help Center, About and native admin | Not implemented as complete user workflows in the checked-out native app; several are placeholders or repository roadmap ideas. | No production availability confirmed. |

### Production verification rule

Before telling a user a feature is available, check a current owner-approved product source that confirms its production status and any eligibility, platform, regional, or account limitations. This inventory is not that confirmation.

## Source references

- [MeToYou Feature Audit Report](../MeToYou-Feature-Audit-Report.md)
- [Native app routes](../../app)
- [Supabase functions](../../supabase/functions)
- [Checked-in migrations](../../supabase/migrations)
