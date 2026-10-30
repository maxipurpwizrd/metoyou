# MeToYou Enhancement Plan

## Summary
MeToYou is already a strong social-media MVP with core app surfaces for feed, profile, messages, clips, flicks, tracks, stories, and native calling. The app has a good foundation, but it still needs a focused set of product and platform improvements before it feels complete, reliable, and engaging enough for a real user base.

## Highest-impact enhancements

### 1) Reliable real-time calling
This is the biggest current gap.

Evidence from the project documentation:
- [README.md](README.md) states that incoming call signaling is active only while the app is running.
- It also notes that background/terminated delivery, CallKit/ConnectionService, and TURN relay support are not included yet.
- Native calling also requires a custom development build, which adds friction and limits testing.

Why this matters:
- Real-time communication is one of the most important features for social apps.
- If calls are unreliable or only work while foregrounded, users will not trust the app for communication.

Recommended improvements:
- Add TURN infrastructure for public internet reliability.
- Improve call reconnection and fallback behavior.
- Add background-call delivery for iOS/Android.
- Add better in-call UX and error states.
- Improve reliability across weak networks.

### 2) Search and discovery improvements
The roadmap already calls out “Better search” as a planned feature.

Evidence:
- [ROADMAP.md](ROADMAP.md) lists “Better search” and “Saved collections” as upcoming improvements.

Why this matters:
- Social apps live or die on discovery.
- Feed alone is not enough; users need to find creators, content, communities, and trends quickly.

Recommended improvements:
- Search across users, posts, clips, tracks, and hashtags.
- Add trending topics and discovery feeds.
- Improve ranking and feed personalization.
- Add recommendations based on interests and following behavior.

### 3) Personalization and onboarding
Roadmap notes include AI onboarding and personalized onboarding.

Why this matters:
- New users need a fast setup that makes the app useful immediately.
- Without onboarding, users often struggle to understand the app and drop off.

Recommended improvements:
- First-run profile interests setup.
- Follow suggestions.
- Content preferences and ranking preferences.
- Onboarding for creators vs. normal users.
- AI-assisted setup and suggestions.

### 4) Safety, moderation, and trust
The app includes report and block flows, but a social media product needs stronger trust infrastructure.

Why this matters:
- Trust is one of the defining success factors in social products.
- If users feel spammed, harassed, or unsafe, retention falls quickly.

Recommended improvements:
- Better moderation queue for reports.
- Spam and abuse detection.
- Safer content controls and profile restrictions.
- Clearer privacy and audience-management settings.
- Improved block/report feedback loops.

### 5) Remove or complete placeholder features
A number of features in the UI are still shown as incomplete.

Evidence:
- [src/native/components/NativeSurfaceDock.tsx](src/native/components/NativeSurfaceDock.tsx) includes “Market, coming soon” and “Gaming, coming soon”.
- [src/native/components/NativeMessagesScreen.tsx](src/native/components/NativeMessagesScreen.tsx) includes a “Message settings are coming soon” alert.

Why this matters:
- Placeholder items make the product look unfinished and reduce user trust.
- If these features are not planned soon, they should be removed from the main interface.

Recommended improvements:
- Hide unfinished surfaces from the main navigation.
- Replace placeholders with clear statuses or removal.
- Only show features that are working or intentionally gated.

## Secondary priorities

### Creator tools and analytics
Roadmap includes creator tools and analytics.

Recommended improvements:
- Post performance tracking.
- Audience insights.
- Content growth metrics.
- Creator dashboards.

### Communities and groups
Roadmap lists groups and communities as future work.

Recommended improvements:
- Community creation and moderation.
- Group-specific feeds.
- Private/public membership controls.
- Group discovery and invites.

### Saved collections and content management
The roadmap includes saved collections.

Recommended improvements:
- Save posts, clips, tracks, and profiles.
- Organize saved content by category.
- Shareable collections and export features.

### Stories improvements
Roadmap mentions stories improvement.

Recommended improvements:
- Better story creation/editing flows.
- Story archiving and highlights.
- Richer story interactions.

## Medium-priority product improvements

### Messaging improvements
The messaging system is already structured, but it can be deeper.

Recommended improvements:
- Better search within chat threads.
- Reactions and richer message types.
- Voice note support.
- Improved thread organization and pinned chats.

### Media experience upgrades
The app already has tracks, clips, and flicks, but these can be made stronger.

Recommended improvements:
- Better upload and editing flows.
- Improved playback UI.
- Better content organization.
- Creator-facing media tools.

### Offline and resilience improvements
The app includes local state and caching patterns, which is good, but more reliability work is needed.

Recommended improvements:
- Better sync conflict handling.
- Stronger retry logic.
- Background refresh behavior.
- Better cache invalidation.
- Monitoring and logging.

## Strategic long-term enhancements

### AI assistant and AI onboarding
Roadmap includes WiZrd AI onboarding and an AI assistant.

Recommended improvements:
- Personalized onboarding help.
- Content suggestions.
- Smart assistant replies.
- Creator guidance and trending analysis.

### Monetization and subscriptions
Vibes Pro already appears in the app architecture and theme logic.

Recommended improvements:
- Subscription management.
- Premium creator tools.
- Ad-free or exclusive tiers.
- Better premium value presentation.

### Native app polish
The app has strong native capabilities already, but the experience can be more premium.

Recommended improvements:
- Motion polish and smooth gesture interactions.
- Accessibility quality.
- Better visual consistency across tabs.
- More refined feed and profile interactions.

## Top 5 priorities to address first
1. Fix call reliability and background calling.
2. Add better search and discovery.
3. Improve onboarding and personalization.
4. Remove or complete placeholder features.
5. Strengthen moderation and trust features.

## Final assessment
The app is a promising social-media MVP with a solid base of feed, profiles, messaging, media tabs, stories, and calls. The biggest gaps are not the existence of features, but the lack of product maturity: reliability, personalization, safety, community tools, and discovery.

If this app is meant to become a real social platform, the next phase should focus on production-grade communication, better discovery, and deeper trust and onboarding features before expanding into creator and community features.
