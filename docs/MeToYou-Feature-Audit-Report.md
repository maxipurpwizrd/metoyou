# MeToYou Feature Audit Report

## Scope and confidence

This is a read-only audit of the checked-out repository: the Expo Router application, native screens and data helpers, Supabase Edge Functions and checked-in migrations, Vercel API handlers, and repository documentation. No production service, database, or user record was queried. No migration was run and no deployment was performed.

**Status labels describe the implementation evidenced in this repository, not independently verified production availability.** A checked-in client or function does not prove that the corresponding remote schema, policies, secrets, or function version is deployed. The current app entry point is Expo Router (`package.json`, `app/`); some older web-oriented service code and API handlers also remain in the repository.

- **LIVE** — a user-facing native flow and its local integration are implemented.
- **IN DEVELOPMENT** — partial, gated, prototype-only, operationally incomplete, or dependent on an unverified backend rollout.
- **PLANNED** — described as future work or not implemented as a working user feature.

## Executive summary

The checked-in native app implements account access, a social feed, profiles and following, username search, stories, direct messaging, in-app notifications, media viewing/playback, local games, user reporting/blocking, and account settings. Native audio/video calling has substantial code but is constrained to supported custom builds and lacks documented production-grade background calling and TURN relay. WiZrd has a native screen and local streaming backend source, but this audit cannot verify the deployed function/schema contract. Video-Clip publishing has a development helper/prototype but no production publishing flow in the native Clips screen.

The largest evidence gap is database-side privacy: the checked-in migrations do not define most core app tables or their RLS/storage policies. Therefore this report does **not** certify the privacy of messages, reports, support tickets, profiles, or uploaded media. The repository also contains two billing API handlers that warrant owner/security review before exposure.

## Feature inventory

| Feature | Status | What the repository establishes | Dependencies and known limits |
|---|---|---|---|
| Email/password sign-up and sign-in | LIVE | Native forms call Supabase Auth; email confirmation is surfaced when no session is returned. Authenticated routes redirect signed-out users. See [login](../app/(auth)/login.tsx), [signup](../app/(auth)/signup.tsx), [auth helpers](../src/native/lib/auth.ts), [root route](../app/index.tsx), and [authenticated layout](../app/(app)/_layout.tsx). | Requires configured Supabase Auth and network access. Google and Apple buttons only display “coming soon.” No password-reset or social sign-in workflow was found in the native screens. |
| Feed and text/image posts | LIVE | Paginated feed, post creation, likes, comments, post editing/deletion, sharing, highlighting, and post action menus are implemented. Feed/profile save controls store saved-post IDs locally. See [feed screen](../src/native/components/NativeFeedScreen.tsx), [post composer](../src/native/components/NativeCreatePost.tsx), [post card](../src/native/components/NativePostCard.tsx), [comments](../src/native/components/NativeCommentsSheet.tsx), and [post operations](../src/native/lib/posts.ts). | Supabase tables and storage are required. The native composer creates text/image posts; it does not provide general audio/video post creation. Ordinary post repost is marked “coming soon”; Clips and Flicks have separate working repost actions. |
| Stories | LIVE | Users can create text/photo stories, view grouped stories, share them, save locally, and delete their own. Duration choices are 2, 4, 8, 12, or 24 hours. See [stories UI](../src/native/components/NativeStories.tsx) and [story data operations](../src/native/lib/stories.ts). | Requires Supabase and photo-library permission for photo stories. “Save story” is on this device only. Although the schema/type includes voice stories, the native composer only creates text/photo stories. |
| Profiles and social connections | LIVE | Users can view/edit their profile, set a picture, bio and interests, follow/unfollow accounts, and browse followers, following, and mutual friends. See [profile screen](../src/native/components/NativeProfileScreen.tsx), [connections screen](../src/native/components/NativeConnectionsScreen.tsx), and [profile data operations](../src/native/lib/profile.ts). | Other-user profile reads use `public_profiles`; its actual view definition and underlying grants are not in the checked-in migrations. No profile-visibility/private-account setting was found. |
| People search | LIVE | Search is debounced and searches usernames; selecting a result opens that profile. See [search screen](../src/native/components/NativeSearchScreen.tsx) and [search helper](../src/native/lib/search.ts). | Username-only. Search across posts, media, hashtags, and communities is not implemented. |
| Direct messaging | LIVE | Text, image/video/file attachments, voice notes, replies, forwarding, reactions, editing/deleting, read receipts, typing/presence indicators, and Realtime message updates are present. See [chat screen](../src/native/components/NativeChatScreen.tsx), [chat data operations](../src/native/lib/chat.ts), [message-thread operations](../src/native/lib/messages.ts), and [call provider](../src/native/contexts/NativeCallProviderImpl.tsx). | Requires authenticated Supabase access, Realtime, storage, and platform microphone/media permissions. Message privacy depends on remote RLS not present in the local migrations. Attachments are addressed using `getPublicUrl`; bucket access behavior must be verified before describing them as private. |
| Inbox organization and message requests | LIVE, with local-only actions | Inbox, spam/request and archive screens, pin/unread/archive/hide actions, and block controls are implemented. Message-request classification is based on mutual-follow and message-direction state. See [messages screen](../src/native/components/NativeMessagesScreen.tsx), [archived screen](../src/native/components/NativeArchivedScreen.tsx), [conversation action storage](../src/native/lib/conversationActions.ts), and [thread logic](../src/native/lib/messages.ts). | Pin/archive/unread/hide identifiers are stored in AsyncStorage, so they are device-local and do not synchronize across devices. The “spam” folder is a message-request heuristic, not evidence of a separate moderation verdict. Inbox message search and Message settings are placeholders. |
| In-app activity notifications | LIVE | Users can open notifications, mark them read, delete one or all, refresh, and receive Realtime changes. See [notification screen](../src/native/components/NativeNotificationsScreen.tsx) and [notification operations](../src/native/lib/notifications.ts). | Requires the remote `notifications` table and Realtime policies, which are not defined in the local migrations. This is distinct from operating-system push notifications. |
| Clips playback | LIVE, gated | The Clips screen loads/paginates video posts, supports viewing, post actions, and reposting a Clip to the Feed. See [Clips screen](../src/native/components/NativeClipsScreen.tsx) and [Clips data operations](../src/native/lib/clips.ts). | The feed is gated on VibesPro entitlement. The screen does not expose a production create/publish flow. A clip-render/upload helper and a development-only preview route exist; see [upload helper](../src/native/lib/clipUpload.ts), [surface publishing helper](../src/native/lib/surfacePosts.ts), and [preview prototype](../app/dev/clip-preview-poc.tsx). |
| Flicks | LIVE | Users can browse image posts, publish a photo from camera or gallery with a caption, and repost a Flick to the Feed. See [Flicks screen](../src/native/components/NativeFlicksScreen.tsx), [Flicks composer](../src/native/components/NativeFlicksShareButton.tsx), and [surface publishing helper](../src/native/lib/surfacePosts.ts). | Requires camera/photo-library access and Supabase storage. The current composer publishes images, not video. |
| Tracks and device audio | LIVE, gated/limited | Users can play remote audio posts available to their entitlement and select local MP3 files in the Device Files playlist. See [Tracks screen](../src/native/components/NativeTracksScreen.tsx), [track operations](../src/native/lib/tracks.ts), and [audio source helper](../src/native/lib/audioSources.ts). | Remote VibesPro content is entitlement-gated. Android automatic MP3 scanning requires a custom development build and audio-library permission; iOS uses the system file picker. No native music-upload/publishing workflow was found. |
| Audio/video calls | IN DEVELOPMENT | WebRTC call setup, incoming/outgoing call UI, signaling, call history, device registration and a native call push path are implemented. See [chat screen](../src/native/components/NativeChatScreen.tsx), [call provider](../src/native/contexts/NativeCallProviderImpl.tsx), [call UI](../src/native/components/NativeCallOverlay.tsx), [call Edge Function](../supabase/functions/native-call/index.ts), [device Edge Function](../supabase/functions/native-device/index.ts), and [call migration](../supabase/migrations/20261028000001_native_call_push.sql). | Requires a custom native development build; it does not run in Expo Go. README documents foreground-oriented signaling, no CallKit/ConnectionService and no TURN relay. Push dispatch/receipt code exists, but end-to-end remote deployment, background/terminated delivery, expiry/cleanup scheduling, and production reliability are not verified; README and newer source are not fully aligned. |
| Call history | LIVE in the native implementation | Users can review calls and redial with audio or video from the call-history route. See [call history screen](../src/native/components/NativeCallHistoryScreen.tsx) and [route](../app/(app)/calls.tsx). | Depends on the call-history schema and access policies. Those pre-existing policies are not established by this repository’s migrations. |
| Offline games | LIVE | Tetris, Bubble Shooter, Yahtzee, and Tesla Roadster Race have playable local implementations. See [Games screen](../src/native/components/NativeGamesScreen.tsx) and game logic under [native game helpers](../src/native/lib). | Scores/state are local; no multiplayer or shared score service was found. The separate Game Feed tab is a placeholder. |
| Account settings and preferences | LIVE, with unfinished items | Profile fields, language preference, appearance/theme, push-registration status, blocked-user management, support form, and sign-out are present. See [Settings screen](../src/native/components/NativeSettingsScreen.tsx), [blocked users screen](../src/native/components/NativeBlockedUsersScreen.tsx), and [theme provider](../src/native/contexts/NativeThemeProvider.tsx). | Native translations are explicitly incomplete. Help Center and About are placeholders. Sign-out clears local state even when remote revocation cannot be confirmed offline. |
| User reports and blocking | LIVE for submission/block actions; review operations unverified | Feed/profile/media UI submits reports; users can block and later unblock accounts. The blocked-user RPC derives the caller via `auth.uid()`. See [report/block operations](../src/native/lib/posts.ts), [profile screen](../src/native/components/NativeProfileScreen.tsx), [blocked-users screen](../src/native/components/NativeBlockedUsersScreen.tsx), and [blocked-user RPC migration](../supabase/migrations/20260930000000_get_my_blocked_users.sql). | Submission requires `reports`/`user_blocks`; core policies are absent locally. The repository does not establish whether reports are staffed or how quickly they are handled. |
| Moderation status and appeals | IN DEVELOPMENT / backend unverified | A VibesPro profile UI calls `get_my_moderation_status` and can submit appeal details to `moderation_appeals`. See [VibesPro profile UI](../src/native/components/NativeVibesProProfile.tsx) and [legacy moderation API](../src/lib/moderationApi.ts). | RPC/table policies and the review workflow are not defined in the local migrations. The appeal/status UI appears in the VibesPro profile path, not as a clearly general account-safety destination. |
| WiZrd assistant | IN DEVELOPMENT | The Messages screen exposes the WiZrd launcher; the native chat has history, conversation drawer, SSE parsing, progressive output and error/recovery UI. Local backend source contains JSON/SSE handling and the published-knowledge search call. See [launcher](../src/native/components/NativeMessagesScreen.tsx), [WiZrd chat screen](../src/native/components/NativeWizrdChatScreen.tsx), [streaming client](../src/native/lib/wizrdStreaming.ts), [Edge Function](../supabase/functions/wizrd-chat/index.ts), and [review-only proposed migration](../supabase/review/wizrd_usage_token_usage_status.proposed.sql). | Local code does not prove that the streaming function, knowledge RPC, tables, grants, or schema migration are deployed. Do not treat generated answers or knowledge coverage as verified production behavior. |
| VibesPro entitlement and paid upgrade | IN DEVELOPMENT for native purchase; entitlement gates exist | Native screens read entitlement fields and gate premium presentation/content. Settings explicitly says upgrades are unavailable in the native app. Checkout, customer-portal, and Stripe/Flutterwave webhook handlers also exist under `api/`. | No native purchase/manage flow. Deployment/configuration and provider-to-entitlement consistency are unknown. See security review items below before exposing the billing endpoints. |
| Market, Game Feed, OAuth, message search/settings, Help Center, About, native admin dashboard | PLANNED or UI-only | These controls either display “coming soon,” a placeholder, or an informational alert rather than completing a feature. See [surface dock](../src/native/components/NativeSurfaceDock.tsx), [Games screen](../src/native/components/NativeGamesScreen.tsx), [login](../app/(auth)/login.tsx), [signup](../app/(auth)/signup.tsx), [Messages screen](../src/native/components/NativeMessagesScreen.tsx), and [Settings screen](../src/native/components/NativeSettingsScreen.tsx). | A button or route label is not evidence that the underlying feature works. |

## User guide for verified LIVE features

These are workflows evidenced in the native UI. Remote availability may still depend on deployment and database configuration.

### Sign up and sign in

- **Where:** App launch routes to sign-in when there is no authenticated session; use **Create account** to open sign-up.
- **How:** Sign up with first name, last name, email and password; if email confirmation is required, confirm by email and return to sign in. Existing users sign in with email/password.
- **What happens:** Supabase Auth establishes a session; authenticated routes open the app tabs. Offline session handling can defer auth decisions.
- **Limits:** Google/Apple controls are not wired to OAuth; the UI reports that they are coming soon.

### Feed, posts and comments

- **Where:** Feed tab, with navigation to profiles, search, Messages and Notifications in the feed header.
- **How:** Use the post composer to write text and/or attach one image. Open post actions to edit/delete your own post, highlight it on your profile, save it on this device, or report/block where offered. Use Like, Comment and Share on a post; comments support text and voice.
- **What happens:** Posts/comments and likes are submitted to Supabase; the feed is paginated and refreshable.
- **Limits:** The native post composer is text/image, not a general video/audio publisher. Saved-post IDs are device-local; ordinary post repost is a placeholder. Availability and access rules depend on remote database/storage policies.

### Stories

- **Where:** Story rail on the Feed; for VibesPro accounts it also appears in Messages.
- **How:** Create a text or photo story, choose one of the displayed durations, tap an author’s story to view, and use the story menu to share, save to this device, or delete your own story.
- **What happens:** The story is uploaded/stored remotely and appears until its expiry; local saved-story IDs remain on the device.
- **Limits:** Native creation is text/photo only. The voice-story type in data does not establish a voice-story creation feature.

### Profiles, follows and people search

- **Where:** Profile tab or a profile opened from a feed item, notification, connection list or search result.
- **How:** On your profile, edit profile fields/picture; on another profile, follow/unfollow, message, share, report or block where shown. Open follower/following lists to browse connections. Use Search in the feed header to search by username.
- **What happens:** Profile and relationship changes use Supabase; search results link to profile pages.
- **Limits:** Search is username-only. No private-profile control was found; do not promise private accounts or audience controls.

### Direct messages and inbox

- **Where:** Messages tab; open a conversation from the inbox or a user profile. The inbox bottom bar links to Spam, Call history and Archived.
- **How:** Send text, attach media/files, record a voice note, reply, react, edit/delete your own message, or forward it. Long-press an inbox thread for local pin/unread/archive/hide actions. Spam contains message requests classified by the current follow/message heuristic.
- **What happens:** Messages use Supabase storage/database and Realtime. Reading a conversation updates message read state through the existing RPC.
- **Limits:** Inbox organization is device-local. The Messages search card and settings icon are placeholders. Attachment privacy is not confirmed by the client implementation; see security/privacy findings.

### Notifications

- **Where:** Bell control in the Feed header.
- **How:** Tap a notification to open the associated profile or post; pull to refresh; use the header control to delete one or all notifications.
- **What happens:** The screen marks notifications read and listens for Realtime updates.
- **Limits:** This describes in-app notifications. It does not imply general OS push notifications; native push source is specifically tied to call invitations.

### Flicks, Clips and Tracks

- **Flicks:** Open from the surface dock. Browse image posts; use the Share control to capture/select a photo and add a caption. The item menu can repost a Flick to the Feed. Camera/photo-library permission is required.
- **Clips:** Open from the surface dock to view/paginate video posts if the account passes the VibesPro gate. The item menu can repost a Clip to the Feed. Native production publishing is not evidenced.
- **Tracks:** Open from the surface dock to play available tracks. Device Files opens local MP3 selection; Android automatic scanning requires an installed custom development build, while iOS uses a file picker.
- These surfaces depend on Supabase media posts and storage. No native flow for uploading a music track was found.

### Games

- **Where:** Gaming item in the surface dock or the offline prompt.
- **How:** Open Games List and select Tetris, Bubble Shooter, Yahtzee or Tesla Roadster Race.
- **What happens:** Gameplay runs locally and is usable without a server connection.
- **Limits:** Game Feed is only a “building” placeholder; no multiplayer or synced leaderboard was found.

### Settings, blocked users and support

- **Where:** Profile > Settings; blocked accounts are under Settings > Privacy.
- **How:** Edit profile name/username/picture, choose a language/theme, review/unblock accounts, submit a problem description, or sign out.
- **What happens:** Profile/preferences are saved through Supabase and/or device storage. Native support creates a support ticket with app/platform/route context.
- **Limits:** Native language translations are incomplete; Help Center/About are unavailable. Offline sign-out clears this device even if remote sign-out cannot be confirmed.

### Calls — limited/in-development

- **Where:** Phone/video controls in a chat; call history is available from the Messages bottom bar.
- **How:** Start or accept a call, then use mute, speaker, camera and end controls. Redial from call history.
- **Limits:** Requires a custom development build, permissions and remote call backend setup. It is not supported in Expo Go; TURN, system call UI, and verified background/terminated operation are absent or unverified.

## UI-only, partial and unfinished features

| Item | Status | Evidence and consequence |
|---|---|---|
| Market | PLANNED | Dock press only shows “Coming soon”; no marketplace workflow. |
| Game Feed | PLANNED | Games screen says Game Kingdom is being built; only offline games work. |
| Google/Apple sign-in/up | PLANNED | Buttons set a “coming soon” message; they do not call an identity provider. |
| Message search and Message settings | PLANNED | Search is display text; settings press opens an alert. |
| Repost of ordinary text/image posts | PLANNED | The ordinary post action menu labels repost as coming soon. Reposting from Clips and Flicks is implemented separately. |
| Native VibesPro upgrades | PLANNED/IN DEVELOPMENT | Settings button explicitly says upgrades are unavailable in the native app. |
| Help Center, About and native admin dashboard | PLANNED / unavailable | Settings controls show alerts; admin is described as web-only, but no route was identified in the Expo app. |
| Clip creation/publishing | IN DEVELOPMENT | Rendering/upload helpers and a development preview route exist, but no production create control was found on the Clips screen. |
| Voice stories | IN DEVELOPMENT / not exposed | Data model has a voice URL/type but the native story composer creates only text/photos. |
| General OS notifications | IN DEVELOPMENT / unverified | In-app Realtime notifications are implemented; current native push source is call-specific. |
| Saved collections | PLANNED | Saved posts and stories can be marked on-device, but no cross-device or organized collection feature was verified. |
| WiZrd production knowledge experience | IN DEVELOPMENT | Client and local function exist; deployment, schema, published knowledge content, and provider operation were not verified. |

## Security and privacy audit

This section is repository-level evidence, not a penetration test or a certification of production configuration.

### Verifiable protections in checked-in code

- The root route and authenticated layout redirect unauthenticated users; the native Supabase client stores the Auth session in AsyncStorage, refreshes it, gates protected requests, and has explicit local sign-out cleanup. See [auth provider](../src/native/contexts/NativeAuthProvider.tsx), [Supabase client](../src/native/lib/supabase.ts), and [authenticated layout](../app/(app)/_layout.tsx).
- Other-user profile lookups use `public_profiles` in native profile/chat paths rather than directly selecting a peer’s full `profiles` row. The view’s actual column definition is not checked in.
- The blocked-user list RPC is `SECURITY DEFINER`, fixes `search_path`, derives the blocker from `auth.uid()`, and grants execute to `authenticated` (see [blocked-user migration](../supabase/migrations/20260930000000_get_my_blocked_users.sql)).
- The native-call migration enables RLS on its call/device/delivery tables, limits authenticated reads of invitations/signals to participants, revokes direct writes, and grants narrowly scoped function execution. Call RPCs perform identity, participant, block, expiry and payload checks. The Edge Function validates Supabase user JWTs; service-role-only endpoints separately verify service-role claims. See [call migration](../supabase/migrations/20261028000001_native_call_push.sql), [shared native auth](../supabase/functions/_shared/native.ts), and [native-call function](../supabase/functions/native-call/index.ts).
- The Stripe webhook validates the Stripe signature before processing events ([Stripe webhook](../api/webhooks/stripe.ts)).
- Native report/block and support submissions require an authenticated user in client code. Client-side checks are not a substitute for server-side RLS.

### Material verification gaps and owner/security review items

1. **Core table RLS and storage policies are not auditable from this checkout.** Only four SQL files are present under `supabase/migrations/`; they cover native call/push, a blocked-user RPC, and a message-read reference contract. The message-read file explicitly says it is not deployable. `database.types.ts` defines only `profiles`. The policies for `messages`, `conversations`, `profiles`, `public_profiles`, `posts`, `stories`, `reports`, `notifications`, support tables, and Storage buckets therefore remain unverified. Confirm the authoritative deployed policies before publishing privacy claims.
2. **Message attachment privacy needs confirmation.** `src/native/lib/chat.ts` generates `getPublicUrl` links for the `messages` bucket. This alone does not prove that objects are publicly readable, but it does not provide a signed/private URL workflow either. Confirm bucket visibility, object policies, and expected access before telling users attachments are private.
3. **Billing customer-portal handler lacks visible caller authentication/ownership validation.** [Customer portal handler](../api/customer-portal.ts) accepts `userId` and `customerId` from the request body and creates a Stripe portal session without calling the shared bearer-auth helper or checking that the Stripe customer belongs to the authenticated user. No native route was found invoking it. Confirm whether it is deployed; protect it before making it reachable from clients.
4. **Flutterwave webhook has no visible provider-signature verification.** [Flutterwave webhook](../api/webhooks/flutterwave.ts) reads the supplied body and, when it sees a successful status plus a user ID, updates profile entitlement fields. Unlike the Stripe handler, no signature/authenticity check is present in this source. Confirm production exposure and provider configuration; do not treat it as verified payment evidence without a trusted verification path.
5. **Legacy admin-report service is not connected to an Expo route found in this audit.** [Admin report service](../src/services/supabase/adminReportService.ts) performs direct reads and moderation writes against reports, messages, profiles and posts; the service itself shows no admin-role check. Its protection therefore depends on remote RLS and any external caller gate, neither of which is verified. Audit or retire this path before exposing it.
6. **Reporting and appeal processing are not verified.** Native clients insert reports and can update appeal details, but no locally checked-in migration defines the related RLS/workflow, and no active moderation queue route was found in the Expo app.
7. **No law-enforcement/case-handling policy or feature was found.** Repository search found no law-enforcement, legal-request, case-handling or related policy document or user workflow. This is not evidence that no process exists outside the repository. Owner/legal approval is required before describing any disclosure, preservation, escalation, or access restrictions.

### Private messages, profiles, reports and identity

- The UI labels conversations and block controls but does not establish the server’s complete access policy. Do not promise that staff, admins, or third parties can or cannot access private messages without authoritative backend policy and operational confirmation.
- Public-profile view use is evidenced; profile field exposure and media access are not independently validated.
- User reports are submitted with reporter/target identifiers and reason/details. Who can read, change, delete, or act on those records is unknown from local migrations.
- Authentication identity comes from Supabase Auth in the native path. Server-side call functions use `auth.uid()`/validated JWTs; other direct-table feature paths need their corresponding deployed RLS confirmed.
- The product repository has no user-facing privacy notice or terms document matching the legal/privacy search described below.

## Roadmap and existing development work

### Development work already represented in source

- **WiZrd:** native streaming client, local `wizrd-chat` function, published-document search call, and a review-only proposed schema migration exist. They do not prove a deployed streaming contract or populated/approved knowledge base.
- **Calling:** participant-scoped call tables/RPCs, WebRTC UI, push-device registration and receipt processing are represented. Production rollout, scheduler/cleanup configuration, foreground/background behavior and reliability remain to be confirmed.
- **Clip tooling:** preview/render planning and resumable upload helpers exist, with a development-only preview route. A production user publishing workflow is not evidenced.
- **Moderation:** report submission and a limited status/appeal UI exist; review tooling/policies and operational ownership are unclear.

### Repository roadmap entries — not approved commitments

[ROADMAP.md](../ROADMAP.md) lists Stories improvements, better search, saved collections, creator tools/analytics, groups/communities, and WiZrd AI onboarding/personalized onboarding in version buckets. These are repository roadmap entries only; this audit cannot establish that they are approved or scheduled. WiZrd assistant code exists even though the roadmap also lists it as future work, so that document is at least partly stale.

[ENHANCEMENT_PLAN.md](../ENHANCEMENT_PLAN.md) proposes improvements such as TURN/background calls, content discovery, onboarding, moderation, creator tools, monetization and offline resilience. It is a recommendation document, not evidence of approved work.

### Planned/not implemented in the app

Marketplace, Game Feed, general content search, saved collections, groups/communities, creator analytics, AI onboarding, native subscription purchase, full help/about experiences, and OAuth are either explicitly marked coming soon or are only listed as future concepts. The README’s PWA references do not establish a current web/PWA product: the package entry point is Expo Router and the checked-in user routes are native.

## Community guidelines and required owner decisions

No official community-guidelines/Code-of-Conduct document, privacy policy, or terms document was found in the repository. Report-reason choices and moderation UI labels are not a substitute for an approved policy. Do not use them as official user-facing rules.

Before WiZrd teaches users about MeToYou, request owner approval/authoritative sources for:

1. Current production availability and regional/platform limitations for each feature.
2. Deployed Supabase schema, RLS, Storage bucket policies, and support/report access.
3. Whether message attachments and public media are intended to be publicly addressable.
4. Official community rules, privacy notice, terms, moderation appeal process, and response expectations.
5. Any law-enforcement/legal-request handling rules and who is authorized to access case data.
6. Whether billing endpoints are deployed and the approved VibesPro purchase/refund/cancellation workflow.
7. Which repository roadmap items are approved, scheduled, or merely exploratory.
8. Whether the old web API/service paths remain supported or should be excluded from product documentation.

## Evidence index

- **Application/navigation:** [package manifest](../package.json), [root layout](../app/_layout.tsx), [app routes](../app), [authenticated layout](../app/(app)/_layout.tsx), [tab layout](../app/(app)/(tabs)/_layout.tsx).
- **Authentication and privacy controls:** [auth provider](../src/native/contexts/NativeAuthProvider.tsx), [Supabase client](../src/native/lib/supabase.ts), [blocked-user migration](../supabase/migrations/20260930000000_get_my_blocked_users.sql).
- **Feed/social:** [feed](../src/native/components/NativeFeedScreen.tsx), [post composer](../src/native/components/NativeCreatePost.tsx), [stories](../src/native/components/NativeStories.tsx), [profiles](../src/native/components/NativeProfileScreen.tsx), [connections](../src/native/components/NativeConnectionsScreen.tsx), [search](../src/native/components/NativeSearchScreen.tsx).
- **Messages/notifications:** [inbox](../src/native/components/NativeMessagesScreen.tsx), [chat](../src/native/components/NativeChatScreen.tsx), [chat operations](../src/native/lib/chat.ts), [in-app notifications](../src/native/components/NativeNotificationsScreen.tsx), [call history](../src/native/components/NativeCallHistoryScreen.tsx).
- **Media/games/settings:** [Clips](../src/native/components/NativeClipsScreen.tsx), [Flicks](../src/native/components/NativeFlicksScreen.tsx), [Tracks](../src/native/components/NativeTracksScreen.tsx), [Games](../src/native/components/NativeGamesScreen.tsx), [Settings](../src/native/components/NativeSettingsScreen.tsx), [blocked users](../src/native/components/NativeBlockedUsersScreen.tsx).
- **Backend/deployment evidence:** [Supabase functions](../supabase/functions), [migrations](../supabase/migrations), [Vercel API handlers](../api), [database types](../src/types/database.types.ts), [README](../README.md).
- **Documents:** [roadmap](../ROADMAP.md), [enhancement plan](../ENHANCEMENT_PLAN.md), [development principles](../IMPORTANT_DEVELOPMENT_PRINCIPLES.md).
