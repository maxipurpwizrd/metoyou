---
title: "MeToYou Product Roadmap — Unconfirmed Items"
slug: "product-roadmap"
category: "product-roadmap"
version: 2
status: "published"
keywords:
  - roadmap
  - planned
  - development
  - owner approval
source_references:
  - "../MeToYou-Feature-Audit-Report.md"
last_reviewed: "2026-11-18"
---

## Content

The items listed below are not approved commitments; each is awaiting owner approval. Repository mentions are not proof of approval, priority, schedule, or delivery.

### Development work represented in the checked-out code

These areas have partial implementations or development artifacts. Their production readiness and future priority are not confirmed:

- **WiZrd:** native streaming client, local chat function and a published-document search call. Deployment, schema, knowledge content and provider operation were not verified.
- **Calling:** WebRTC UI, signaling, call tables/RPCs, push-device registration and receipt code. Production rollout, background behavior, TURN and reliability remain unverified.
- **Clip publishing:** render/upload helpers and a development-only preview exist, but a production create/publish workflow was not found.
- **Moderation:** report submission and limited status/appeal UI exist; review tooling, policies and operational ownership are unclear.

These describe repository state only; they do not promise ongoing development or a release.

### Ideas listed in repository planning documents

The audit found the following ideas in `ROADMAP.md` and `ENHANCEMENT_PLAN.md`. **Each is awaiting owner approval and may be stale, exploratory, deferred, or rejected.**

- Stories improvements and better search/discovery.
- Saved collections.
- Creator tools and analytics.
- Groups and communities.
- WiZrd AI onboarding and personalized onboarding.
- TURN/background calling.
- Moderation improvements.
- Monetization and native subscription purchase.
- Offline resilience.

Other items represented as incomplete in the app include Market, Game Feed, OAuth, ordinary-post reposting, general content search, message search/settings, Help Center/About, and general OS notifications. These also remain **awaiting approval**; a placeholder is not a commitment.

### Approval and communication rule

WiZrd must not give delivery dates, say an item is “coming soon” unless the owner has approved that wording, or describe an item as planned work based only on repository text. If asked, say that the project contains an unconfirmed idea and no approved schedule is available.

### Owner decisions needed

For every candidate item, the owner must identify whether it is approved, exploratory, deferred, or rejected; confirm scope and priority; and provide any authorized timing and user-facing wording. Confirm whether the repository planning files are current and authoritative.

## Source references

- [MeToYou Feature Audit Report](../MeToYou-Feature-Audit-Report.md)
- [Repository roadmap](../../ROADMAP.md)
- [Enhancement plan](../../ENHANCEMENT_PLAN.md)
