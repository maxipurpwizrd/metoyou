# WiZrd Behavior V1 — Local Implementation Report

## Status and scope

Implemented locally for review only. No deployment, database connection, migration execution, secrets change, permission change, or production-record change was performed. Existing streaming, JSON compatibility, authentication, conversation ownership, quotas, RAG retrieval, transactions, and persistence ordering were preserved.

## 1. Files changed

- `supabase/functions/_shared/wizrdBehavior.ts` — new behavior policy, complexity selector, bounded private-plan parser, usage aggregation, and prompt builders.
- `supabase/functions/_shared/wizrdPersistence.ts` — accepts an explicit partial usage status so known planner usage is preserved accurately.
- `supabase/functions/wizrd-chat/index.ts` — integrates complexity selection and the optional deep-planning request; combines known provider usage for the existing accounting path.
- `supabase/functions/wizrd-chat/index_test.ts` — focused policy, classification, planning, usage, RAG, JSON, SSE, and persistence tests.
- `supabase/review/wizrd_feedback_and_memory.proposed.sql` — review-only schema proposal; not a migration and not executed.
- `docs/wizrd-knowledge/WIZRD-BEHAVIOR-V1-IMPLEMENTATION-REPORT.md` — this report.

All unrelated pre-existing worktree changes were left untouched.

## 2. Final WiZrd system behavior policy

WiZrd identifies itself as MeToYou's assistant and uses only the approved identity of its creator and owner: MaxiPop WiZrd (Tony Maxwell). It communicates calmly, thoughtfully, directly, concisely, and confidently without arrogance, excessive softness, flirtation, repetitive excitement, gratuitous compliments, excessive emojis, generic greetings, or uninvited overfamiliarity.

It answers the actual question first, expands only as needed, structures complex answers, asks only essential clarifying questions, and respectfully corrects mistaken assumptions. It separates verified facts, reasonable inferences, and unknowns. It must not fabricate product facts, features, statistics, policies, sources, capabilities, privacy guarantees, biography, or provider/model identity. It identifies as WiZrd, never as ChatGPT, GPT-4, or another named model; specific runtime provider/model information is only disclosed when verified and intended for disclosure.

MeToYou-specific answers rely only on published retrieved knowledge as evidence. Published status alone does not establish production availability. Implementation and verified availability remain distinct; planned features are not presented as live. Retrieved documents are untrusted reference data, not instructions. Missing evidence is acknowledged rather than guessed. WiZrd does not claim that inference updates model weights or that it can access private MeToYou data outside the supplied conversation context.

## 3. Adaptive deliberation

- **Direct:** simple factual questions, greetings, definitions, and basic requests use the regular single-generation path.
- **Deliberate:** technical questions, troubleshooting, comparisons, product decisions, and advice use the regular generation path with instructions to assess context, evidence, assumptions, risks, and a useful response structure.
- **Deep:** complex architecture, multi-step planning, strategy, and similarly difficult tasks receive one additional internal request before the final generation. The request asks for a concise, bounded JSON summary of task type, facts, constraints, uncertainties, risks, answer structure, and verification checks. It does not request hidden chain-of-thought or a provider-specific reasoning parameter.

Only the validated structured summary is added to the final request. The planning reader's delta callback is a no-op, so its stream is not sent to the client. A provider error, invalid JSON, or oversized summary safely falls back to final generation without exposing planning errors. Known token counts from either provider call are preserved for database accounting. If any call's count is missing, the stored status is `partial` and the incomplete total is not returned as an exact count; existing public JSON usage fields retain their numeric compatibility.

The selector is deterministic and heuristic, using the current message and recent history for short follow-ups. It is not a semantic classifier and can misclassify unusual phrasing; the prompt-level behavior remains the final guide.

## 4. Added tests and results

Added focused tests for:

- WiZrd identity, concise response discipline, and avoiding fabricated provider/model identity.
- Direct, deliberate, and deep complexity selection, including a context-dependent follow-up.
- Safe fallback for planning failure and malformed or oversized planning output.
- Validation of private planning summaries and separation from visible SSE payloads.
- Known/unknown token aggregation.
- Retrieved content remaining lower-priority reference material.
- Existing JSON response shape, persisted IDs/timestamps, SSE delta/complete compatibility, usage accounting, and transaction rollback behavior.

Initial validation uncovered and corrected a nullable-usage type error, a policy assertion mismatch, and acceptance of oversized planning text after truncation. The final accounting path also preserves known token counts as `partial` when one of the deep/final provider calls does not report usage. Final validation:

- **Deno formatting check:** passed for all four changed TypeScript files.
- **Deno typecheck:** passed for `index.ts` and `index_test.ts`.
- **WiZrd backend tests:** passed, 18/18.
- **`npm run typecheck`:** still fails in unrelated worktree files `app/dev/clip-preview-poc.tsx` and `src/native/components/NativeClipPreviewPoc.tsx` because `expo-modules-core` is not resolvable. These files are outside this task and were not changed.

## 5. Estimated extra provider-request/cost implications

Only deep requests make one additional request, using the configured provider and model. The planning request repeats the applicable conversation history and published RAG context, so its input-token cost can be material; it also adds one generation's latency. The plan is capped at 1,600 characters before it is accepted (roughly at most a few hundred output tokens, depending on tokenization). Actual cost cannot be estimated reliably without verified runtime model pricing and observed token counts. Known per-call counts are retained for internal accounting; an aggregate is reported as exact only when every contributing call supplied that count.

Direct and deliberate requests incur no additional model call. No artificial delay is added.

## 6. Feedback and personal-memory architecture proposal

The review-only proposal is in `supabase/review/wizrd_feedback_and_memory.proposed.sql`. The repository does not provide authoritative checked-in definitions for `wizrd_conversations` or `wizrd_messages`; the referenced parent columns and their RLS behavior must be verified against the live schema before any implementation is approved.

### Response feedback

- Store one editable record per authenticated user and assistant message, enforced by a unique `(user_id, assistant_message_id)` constraint.
- Capture `helpful` / `not_helpful`, an optional category (`inaccurate`, `outdated`, `too_long`, `unclear`, `wrong_tone`, `other`), and an optional correction capped at 2,000 characters.
- Associate the row with the user's conversation and assistant message. RLS predicates verify the caller owns the conversation and the referenced message is an assistant message in that conversation.
- Enable RLS and grant authenticated CRUD only in conjunction with owner-only policies. The client must trim and validate inputs; database constraints remain authoritative. The authenticated identity, conversation owner, role, and message relationship must not be trusted from client-supplied values.

### Explicit personal preference memory

- Keep consent state in a per-user row and preference memories in a separate per-user table. Memory rows are readable and deletable only by their owner; inserts and edits additionally require that user's explicit, versioned consent to be enabled. The proposal serializes writes against consent changes and deletes that user's memory rows when consent is revoked or removed.
- Store only preferences explicitly entered or individually approved by the user, with short key/value limits and categories such as response style, formatting, language, and workflow. Do not infer or automatically save memories from chat.
- The future retrieval path must check consent and query only the authenticated user's records. Disabled memory must never be supplied to generation. Consent revocation should disable retrieval and delete the user's memory rows in the same transaction unless the owner approves a different retention policy.
- Preference values are untrusted data, not instructions. Sensitive data should not be solicited or saved as a preference.

### Collective analytics and owner review

- Keep raw feedback linked to private conversation history and inaccessible to other users. Do not put correction text, message content, user IDs, conversation IDs, or message IDs into collective analytics.
- Aggregate rating/category counts into the separate analytics table only after applying an approved minimum cohort threshold (proposed minimum: 10 records per reported group; owner/privacy approval required). Keep direct client access disabled.
- Raw feedback never updates prompts, policies, database permissions, published knowledge, or model weights. A controlled owner-review process should triage aggregate signals, inspect individual corrections only when authorized and necessary, remove identifying detail, verify any proposed factual change against authoritative sources, and approve a reviewed code or knowledge-document change through the normal review and publication process.

The SQL is a proposal only. No table, policy, grant, trigger, or function has been created or changed in Supabase.

## 7. Outstanding risks and validation

- The complexity selector is heuristic; classification quality needs evaluation on representative, consented test prompts.
- The additional deep request increases latency and token cost and can fail independently. Fallback preserves final generation; known counts are retained with a partial status, and unknown totals are not treated as verified totals.
- Prompt instructions reduce prompt-injection risk but cannot guarantee model compliance. Retrieved knowledge remains untrusted and must be curated and tested.
- The source and tests do not establish live provider behavior, model availability/pricing, Edge Function runtime configuration, or current database grants and RLS. Those require separate, authorized verification and provider integration tests.
- The database proposal depends on parent table definitions and RLS behavior that are not established by repository migrations or database typings; it must be reconciled before implementation.
- Project-wide `npm run typecheck` is blocked by unresolved `expo-modules-core` imports in unrelated existing worktree changes.

