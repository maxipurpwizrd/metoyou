---
title: "MeToYou User Guide"
slug: "user-guide"
category: "user-guide"
version: 2
status: "published"
keywords:
  - getting started
  - feed
  - stories
  - messages
  - profile
  - settings
source_references:
  - "../MeToYou-Feature-Audit-Report.md"
last_reviewed: "2026-11-18"
---

## Content

These steps describe flows evidenced in the checked-out native app. They do not confirm that a feature, server, or account entitlement is currently available in production.

### Account access

- **Where:** On launch, signed-out users are directed to sign-in. The sign-up screen is linked from the sign-in flow.
- **How:** The checked-in forms accept email/password and request first/last name on sign-up. If email confirmation is required, the app surfaces that state.
- **What the code does:** It uses Supabase Auth and routes authenticated users into the app.
- **Limits:** Google/Apple buttons show a “coming soon” message; they are not implemented OAuth flows. No native password-reset workflow was found. Production configuration was not verified.

### Feed, posts and comments

- **Where:** Feed tab.
- **How:** The native composer supports text and one image. Feed items expose like, comment and share actions; post menus include owner editing/deletion, highlighting, local save, and report/block options where shown.
- **What the code does:** Post, comment and like actions are submitted through the Supabase client; feed loading is paginated and refreshable.
- **Limits:** No ordinary post repost or general video/audio post creation flow was found. Saved-post identifiers are device-local. Production database and storage access were not verified.

### Stories

- **Where:** Story rail on Feed; the code also shows stories in Messages for VibesPro accounts.
- **How:** Create text or photo content, select one of the displayed durations (2, 4, 8, 12 or 24 hours), open a story to view it, or use its menu to share, save locally or delete your own.
- **What the code does:** Story data is sent to the configured backend; saved-story identifiers are kept on the device.
- **Limits:** Native creation is text/photo only. The presence of a voice-story type in data does not mean users can create voice stories. Production configuration is unverified.

### Profiles, connections and people search

- **Where:** Profile tab, or a profile opened from a feed item, notification, connection list or search result.
- **How:** The profile UI supports editing profile fields and picture. Other profiles expose follow/unfollow, message, share, report or block actions where shown. Connection lists show followers/following/mutual friends. Search looks for usernames.
- **What the code does:** Profile and connection actions use Supabase; selecting a username result navigates to that profile.
- **Limits:** Search is username-only. The audit did not find a private-account control. Do not assume profile visibility settings.

### Messages and inbox

- **Where:** Messages tab; open a conversation from the inbox or a profile.
- **How:** The chat UI supports text, attachments, voice notes, replies, forwarding, reactions, editing/deleting one’s own messages and read receipts. Long-press inbox threads for pin/unread/archive/hide actions. Spam is a request-folder heuristic.
- **What the code does:** The client calls Supabase and listens for Realtime updates. Inbox organization identifiers are stored locally on the device.
- **Limits:** Search and Message settings are placeholders. Local organization does not imply synchronization across devices. Message and attachment privacy are not confirmed by the checked-in policies.

### Notifications

- **Where:** Bell control in the Feed header.
- **How:** Open a notification, refresh the list, mark items read, or use the controls to delete one or all.
- **What the code does:** The screen handles in-app notification records and Realtime changes.
- **Limits:** This is not evidence of general operating-system push notifications. The checked-in native push path is call-specific. Production notification policies were not checked.

### Flicks, Clips and Tracks

- **Flicks:** The surface dock opens image posts. The share control selects/captures a photo and adds a caption; an item menu can repost a Flick to Feed.
- **Clips:** The surface dock opens paginated video posts when the VibesPro gate allows access. Item actions include reposting a Clip. A production publishing control was not found.
- **Tracks:** The surface dock opens available audio. Device Files can select local MP3s. Android automatic scanning requires a custom development build; iOS uses the system file picker.
- **Limits:** Camera/photo-library permissions, entitlement, platform support, remote media and Storage setup can affect these flows. The audit did not verify any of those production dependencies. No native music publishing workflow was found.

### Games

- **Where:** Gaming item in the surface dock or the offline prompt.
- **How:** Open the games list and select Tetris, Bubble Shooter, Yahtzee or Tesla Roadster Race.
- **What the code does:** Gameplay runs locally.
- **Limits:** The Game Feed is a placeholder. No multiplayer or shared leaderboard was found. Production app distribution was not verified.

### Settings, blocked users and support

- **Where:** Profile > Settings; blocked accounts appear under Settings > Privacy.
- **How:** The checked-in UI provides profile editing, language/theme selection, blocked-user review/unblock, support-form submission and sign-out.
- **What the code does:** It saves profile/preferences through Supabase and/or local storage and submits a support ticket with app/platform/route context.
- **Limits:** Native translations are incomplete; Help Center and About are placeholders. Support-ticket access/handling and production availability were not verified. Offline sign-out clears local state even if remote sign-out cannot be confirmed.

### Calls

- **Where:** Audio/video controls in a chat; call history is linked from the Messages bottom bar.
- **How:** The UI contains start/accept, mute, speaker, camera, end and redial interactions.
- **Limits:** Requires a custom development build and configured remote backend; it does not run in Expo Go. TURN, system call UI and reliable background/terminated operation are absent or unverified. Do not promise call availability.

### WiZrd

The Messages screen has a WiZrd entry point. The local code includes chat history, streaming output and error/recovery handling. Treat production operation and answer coverage as unverified until the owner confirms the deployed backend and approved knowledge sources.

## Source references

- [MeToYou Feature Audit Report](../MeToYou-Feature-Audit-Report.md)
- [Native route tree](../../app)
- [Native screens](../../src/native/components)
