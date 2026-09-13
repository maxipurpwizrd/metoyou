# 🚀 MeToYou Development Principles
## Read Before Writing or Refactoring Code

This document defines how MeToYou should be built as it grows. Every contributor (including AI assistants like GitHub Copilot, ChatGPT, or future developers) should follow these principles.

---

# 🎯 Our Philosophy

Build MeToYou as a collection of small, independent, maintainable systems—not giant files that do everything.

Every file should have ONE primary responsibility.

If a file begins handling multiple unrelated responsibilities, split it before adding more features.

---

# 🧩 Single Responsibility Rule

Each file should own ONE responsibility.

Examples:

✅ Chat.tsx
- Render chat UI only.

✅ chatApi.ts
- Handle database communication.
- Fetch conversations.
- Send messages.
- Mark messages as read.

✅ useConversationMessages.ts
- Manage loading messages.
- Pagination.
- Optimistic updates.
- Local state.

✅ useMessageSubscription.ts
- Handle realtime subscriptions.
- Listen for new messages.
- Clean subscriptions.

✅ useTypingIndicator.ts
- Manage typing status.

✅ useChatPresence.ts
- Manage online/offline status.

NOT all inside Chat.tsx.

---

# 🚫 Never Create God Files

If a file starts doing:

- UI
- API
- Realtime
- Presence
- Typing
- Uploads
- Calls
- Cache
- Business logic

STOP.

Split responsibilities immediately.

---

# 🔥 Before Adding New Features

Always ask:

> Can this feature live inside an existing specialized module?

If YES

Add it there.

If NO

Create a new module.

Never force unrelated code into existing files.

---

# 🏗 Preferred Architecture

UI

↓

Hooks

↓

Feature Services

↓

Supabase

Example:

Chat.tsx
↓

useConversationMessages.ts
↓

chatApi.ts
↓

Supabase

The UI should never communicate directly with Supabase.

---

# ⚡ Refactor Rule

Never rewrite an entire system in one pass.

Instead:

1. Build the replacement.
2. Test it.
3. Replace one responsibility.
4. Test again.
5. Continue.

The application should remain functional after every step.

---

# 🛠 Debugging Rule

Fix bugs at their source.

Do not add temporary patches unless absolutely necessary.

If fixing one bug creates another, stop and identify the architectural problem.

---

# 📦 Future Feature Rule

Every major feature should have its own module.

Examples:

Messaging/
Calls/
Games/
Notes/
AI/
Notifications/
Feed/
Profile/
Marketplace/
Settings/

Each feature owns:

- API
- Hooks
- UI
- Types

---

# 🧪 Stability First

Build features in this order:

1. Foundation
2. Stability
3. Realtime
4. UX
5. Animations
6. Extra features

A stable system is more valuable than a feature-rich unstable one.

---

# 🗂 Suggested Project Structure

src/

components/
hooks/
contexts/
lib/
types/

features/

chat/
feed/
profile/
notifications/
games/
calls/
notes/
ai/
settings/

Each feature should remain as independent as possible.

---

# 💜 MeToYou Engineering Standard

We don't build quick hacks.

We build systems that can grow for years.

Every decision should make future development easier, not harder.

---

# 🔥 Golden Rule

Whenever you open a file and think:

"This file is becoming too big..."

You're already late.

Split it.

Always choose maintainability over convenience.

---

Built with ❤️ for MeToYou

"Small modules. Big dreams."