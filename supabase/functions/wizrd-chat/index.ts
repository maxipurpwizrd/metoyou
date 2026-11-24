import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import postgres from "npm:postgres@3.4.5";
import {
  acceptsEventStream,
  encodeSseEvent,
  parseGroqSseData,
  SseDecoder,
} from "../_shared/wizrdSse.ts";
import {
  conversationBelongsTo,
  DEFAULT_DAILY_MESSAGE_LIMIT,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  extractBearerToken,
  hasRequiredDatabasePrivileges,
  type TokenUsageStatus,
  usageLimitDecision,
} from "../_shared/wizrdChatPolicy.ts";
import {
  buildInternalPlanningMessages as makeInternalPlanningMessages,
  buildWizrdGenerationMessages,
  combineProviderUsage,
  type CompletedProviderUsageStatus,
  completedProviderUsageStatus,
  type ConversationHistoryMessage,
  knownProviderUsage,
  type ProviderTokenUsage,
  type ProviderUsageAggregate,
  reportedProviderUsage,
  type ResponseComplexity,
  runInternalPlanningSafely,
  selectResponseComplexity,
  type WizrdPromptMessage,
} from "../_shared/wizrdBehavior.ts";
import { buildWizrdSuccessPayload } from "../_shared/wizrdChatResponse.ts";
import { persistWizrdConversation } from "../_shared/wizrdPersistence.ts";

type ChatRole = "user" | "assistant";
type ChatMessage = WizrdPromptMessage;
type DbMessage = {
  id: string;
  role: ChatRole;
  content: string;
  created_at: Date | string;
};
type DbUsageCounts = { daily_count: number; recent_count: number };
type ProviderUsage = ProviderTokenUsage;
type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  content: string;
  version: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL");
if (!SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is required");

const RAW_PUBLISHABLE_KEYS = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
if (!RAW_PUBLISHABLE_KEYS) {
  throw new Error("SUPABASE_PUBLISHABLE_KEYS is required");
}

let publishableKeyValues: unknown;
try {
  publishableKeyValues = Object.values(
    JSON.parse(RAW_PUBLISHABLE_KEYS) as Record<string, unknown>,
  );
} catch {
  throw new Error("SUPABASE_PUBLISHABLE_KEYS must be a JSON object");
}

const PUBLISHABLE_KEY = (publishableKeyValues as unknown[]).find(
  (value): value is string => typeof value === "string" && value.length > 0,
);
if (!PUBLISHABLE_KEY) {
  throw new Error("No Supabase publishable key is configured");
}

const positiveInt = (name: string, fallback: number): number => {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw.trim() === "") return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const DAILY_MESSAGE_LIMIT = positiveInt(
  "WIZRD_DAILY_MESSAGE_LIMIT",
  DEFAULT_DAILY_MESSAGE_LIMIT,
);
const RATE_LIMIT_PER_MINUTE = positiveInt(
  "WIZRD_RATE_LIMIT_PER_MINUTE",
  DEFAULT_RATE_LIMIT_PER_MINUTE,
);
const RATE_WINDOW_SECONDS = positiveInt("WIZRD_RATE_WINDOW_SECONDS", 60);

const MAX_MESSAGE_CHARS = 2000;
const CONTEXT_MESSAGE_LIMIT = 12;
const KNOWLEDGE_RESULT_LIMIT = 3;
const KNOWLEDGE_CONTENT_CHAR_LIMIT = 4000;
const PROVIDER_TIMEOUT_MS = 45_000;

const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") ?? "groq").trim()
  .toLowerCase();
const AI_MODEL = (Deno.env.get("AI_MODEL") ?? "openai/gpt-oss-20b").trim();
const AI_BASE_URL = (Deno.env.get("AI_BASE_URL") ??
  "https://api.groq.com/openai/v1").trim();
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

const db = postgres(SUPABASE_DB_URL, {
  ssl: "require",
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

const supabaseAuth = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

class ProviderFailure extends Error {
  constructor(
    readonly providerStatus?: number,
    readonly usage: ProviderUsage = { inputTokens: null, outputTokens: null },
  ) {
    super("AI provider request failed");
  }
}

interface OpenedGroqStream {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  abort: () => void;
  dispose: () => void;
}

interface ChatProvider {
  open(
    messages: ChatMessage[],
    requestSignal: AbortSignal,
  ): Promise<OpenedGroqStream>;

  read(
    opened: OpenedGroqStream,
    onDelta: (text: string) => void,
  ): Promise<{
    content: string;
    inputTokens: number | null;
    outputTokens: number | null;
  }>;
}

// Provider-specific HTTP and SSE handling stays separate from persistence.
class GroqChatProvider implements ChatProvider {
  private readonly endpoint: string;

  constructor(
    private readonly apiKey: string,
    baseUrl: string,
    private readonly model: string,
  ) {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "AI_BASE_URL must be an HTTPS base URL without credentials or query parameters",
      );
    }
    this.endpoint = `${url.toString().replace(/\/+$/, "")}/chat/completions`;
  }

  async open(
    messages: ChatMessage[],
    requestSignal: AbortSignal,
  ): Promise<OpenedGroqStream> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      PROVIDER_TIMEOUT_MS,
    );
    const onRequestAbort = () => abortController.abort();

    if (requestSignal.aborted) {
      abortController.abort();
    } else {
      requestSignal.addEventListener("abort", onRequestAbort, { once: true });
    }

    const cleanup = () => {
      clearTimeout(timeoutId);
      requestSignal.removeEventListener("abort", onRequestAbort);
    };

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: abortController.signal,
      });
    } catch {
      cleanup();
      throw new ProviderFailure();
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ??
      "";
    if (
      !response.ok ||
      !response.body ||
      !contentType.startsWith("text/event-stream")
    ) {
      try {
        await response.body?.cancel();
      } catch {
        // No provider response body or transport details are exposed.
      }
      cleanup();
      throw new ProviderFailure(response.status);
    }

    return {
      reader: response.body.getReader(),
      abort: () => abortController.abort(),
      dispose: () => {
        cleanup();
        abortController.abort();
      },
    };
  }

  async read(
    opened: OpenedGroqStream,
    onDelta: (text: string) => void,
  ) {
    const parser = new SseDecoder();
    const decoder = new TextDecoder();
    let finished = false;
    let content = "";
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;

    const consumeEvents = (events: Array<{ data: string }>) => {
      for (const event of events) {
        const frame = parseGroqSseData(event.data);
        if (frame.inputTokens !== undefined) {
          inputTokens = frame.inputTokens;
        }
        if (frame.outputTokens !== undefined) {
          outputTokens = frame.outputTokens;
        }
        if (frame.done) {
          finished = true;
          return;
        }
        if (typeof frame.delta === "string" && frame.delta.length > 0) {
          content += frame.delta;
          onDelta(frame.delta);
        }
      }
    };

    try {
      while (!finished) {
        const result = await opened.reader.read();
        if (result.done) {
          consumeEvents(parser.push(decoder.decode(), true));
          break;
        }
        consumeEvents(
          parser.push(decoder.decode(result.value, { stream: true })),
        );
      }

      if (!finished || content.trim().length === 0) {
        throw new ProviderFailure();
      }

      return { content, inputTokens, outputTokens };
    } catch (error) {
      if (error instanceof ProviderFailure) {
        throw new ProviderFailure(error.providerStatus, {
          inputTokens,
          outputTokens,
        });
      }
      throw new ProviderFailure(undefined, { inputTokens, outputTokens });
    } finally {
      opened.dispose();
      try {
        opened.reader.releaseLock();
      } catch {
        // The stream may already have been cancelled.
      }
    }
  }
}

function getProvider(): ChatProvider {
  if (AI_PROVIDER !== "groq") {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "The assistant is temporarily unavailable.",
    );
  }
  if (!GROQ_API_KEY) {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "The assistant is temporarily unavailable.",
    );
  }

  try {
    return new GroqChatProvider(GROQ_API_KEY, AI_BASE_URL, AI_MODEL);
  } catch {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "The assistant is temporarily unavailable.",
    );
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

function isTokenUsageStatus(value: string): value is TokenUsageStatus {
  return value === "pending" ||
    value === "reported" ||
    value === "partial" ||
    value === "unavailable" ||
    value === "failed" ||
    value === "legacy_unverified";
}

async function getRecentMessages(
  userId: string,
  conversationId: string,
): Promise<ConversationHistoryMessage[]> {
  const rows = await db<Pick<DbMessage, "role" | "content">[]>`
    select role, content
    from public.wizrd_messages
    where user_id = ${userId}::uuid
      and conversation_id = ${conversationId}::uuid
    order by created_at desc, id desc
    limit ${CONTEXT_MESSAGE_LIMIT}
  `;

  return rows.reverse().map((row) => ({
    role: row.role,
    content: row.content,
  }));
}

async function verifyDatabasePrivileges(): Promise<void> {
  const [permissions] = await db<{
    can_search_knowledge: boolean;
    can_read_conversations: boolean;
    can_insert_conversations: boolean;
    can_update_conversations: boolean;
    can_read_messages: boolean;
    can_insert_messages: boolean;
    can_read_usage: boolean;
    can_insert_usage: boolean;
    can_update_usage: boolean;
    can_track_token_usage: boolean;
  }[]>`
    select
      has_function_privilege(
        current_user,
        'public.search_wizrd_knowledge(text,integer)',
        'EXECUTE'
      ) as can_search_knowledge,
      has_table_privilege(current_user, 'public.wizrd_conversations', 'SELECT') as can_read_conversations,
      has_table_privilege(current_user, 'public.wizrd_conversations', 'INSERT') as can_insert_conversations,
      has_table_privilege(current_user, 'public.wizrd_conversations', 'UPDATE') as can_update_conversations,
      has_table_privilege(current_user, 'public.wizrd_messages', 'SELECT') as can_read_messages,
      has_table_privilege(current_user, 'public.wizrd_messages', 'INSERT') as can_insert_messages,
      has_table_privilege(current_user, 'public.wizrd_usage', 'SELECT') as can_read_usage,
      has_table_privilege(current_user, 'public.wizrd_usage', 'INSERT') as can_insert_usage,
      has_table_privilege(current_user, 'public.wizrd_usage', 'UPDATE') as can_update_usage,
      (
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'wizrd_usage'
            and column_name = 'token_usage_status'
            and is_nullable = 'NO'
        )
        and exists (
          select 1
          from pg_constraint
          where conrelid = 'public.wizrd_usage'::regclass
            and conname = 'wizrd_usage_token_usage_status_check'
            and contype = 'c'
        )
      ) as can_track_token_usage
  `;
  if (!permissions || !hasRequiredDatabasePrivileges(permissions)) {
    throw new HttpError(
      503,
      "SERVER_CONFIGURATION_ERROR",
      "The assistant is temporarily unavailable.",
    );
  }
}

async function getPublishedKnowledge(
  query: string,
): Promise<KnowledgeDocument[]> {
  const rows = await db<KnowledgeDocument[]>`
    select
      result.id::text as id,
      result.title,
      result.category,
      result.content,
      result.version
    from public.search_wizrd_knowledge(
      ${query},
      ${KNOWLEDGE_RESULT_LIMIT}
    ) as result
    order by result.rank desc
    limit ${KNOWLEDGE_RESULT_LIMIT}
  `;

  return rows.map((row) => ({
    ...row,
    content: row.content.slice(0, KNOWLEDGE_CONTENT_CHAR_LIMIT),
  }));
}

function buildKnowledgeContext(documents: KnowledgeDocument[]): string {
  return documents.length > 0
    ? JSON.stringify(documents)
    : "No relevant published MeToYou reference document was found.";
}

function buildChatMessages(
  history: ConversationHistoryMessage[],
  knowledgeContext: string,
  userMessage: string,
  complexity: ResponseComplexity,
  planningSummary: string | null,
): ChatMessage[] {
  return buildWizrdGenerationMessages({
    history,
    knowledgeContext,
    userMessage,
    complexity,
    planningSummary,
  });
}

function buildInternalPlanningMessages(
  history: ConversationHistoryMessage[],
  knowledgeContext: string,
  userMessage: string,
): ChatMessage[] {
  return makeInternalPlanningMessages({
    history,
    knowledgeContext,
    userMessage,
  });
}

async function reserveUsage(
  userId: string,
  conversationId: string | null,
): Promise<string> {
  return await db.begin(async (tx) => {
    // Global per-user lock: reservation rows are counted while pending, so
    // concurrent requests cannot all pass a stale quota count.
    await tx`
      select pg_advisory_xact_lock(hashtextextended(${userId}, 0))
    `;

    const [counts] = await tx<DbUsageCounts[]>`
      select
        (count(*) filter (
          where created_at >=
            date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        ))::int as daily_count,
        (count(*) filter (
          where created_at >=
            now() - make_interval(secs => ${RATE_WINDOW_SECONDS})
        ))::int as recent_count
      from public.wizrd_usage
      where user_id = ${userId}::uuid
    `;

    const limitDecision = usageLimitDecision(
      {
        dailyCount: counts.daily_count,
        recentCount: counts.recent_count,
      },
      DAILY_MESSAGE_LIMIT,
      RATE_LIMIT_PER_MINUTE,
    );
    if (limitDecision === "daily") {
      throw new HttpError(
        429,
        "DAILY_LIMIT_REACHED",
        "You've reached today's WiZrd message limit. Please try again tomorrow.",
      );
    }
    if (limitDecision === "rate") {
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "Please wait a moment before sending another message.",
      );
    }

    const [reservation] = await tx<{ id: string }[]>`
      insert into public.wizrd_usage
        (
          user_id,
          conversation_id,
          provider,
          model,
          input_tokens,
          output_tokens,
          token_usage_status,
          status
        )
      values
        (
          ${userId}::uuid,
          ${conversationId}::uuid,
          ${AI_PROVIDER},
          ${AI_MODEL},
          0,
          0,
          'pending',
          'pending'
        )
      returning id::text
    `;
    return reservation.id;
  });
}

async function markUsageFailed(
  usageId: string,
  userId: string,
  latencyMs: number,
  usage: ProviderUsage = { inputTokens: null, outputTokens: null },
): Promise<void> {
  try {
    await db`
      update public.wizrd_usage
      set status = 'failed',
          token_usage_status = 'failed',
          input_tokens = coalesce(${usage.inputTokens}, input_tokens),
          output_tokens = coalesce(${usage.outputTokens}, output_tokens),
          latency_ms = ${latencyMs}
      where id = ${usageId}::uuid
        and user_id = ${userId}::uuid
        and status = 'pending'
    `;
  } catch {
    console.error("WiZrd usage failure update failed");
  }
}

async function persistSuccess(
  userId: string,
  requestedConversationId: string | null,
  message: string,
  assistantText: string,
  usageId: string,
  inputTokens: number | null,
  outputTokens: number | null,
  tokenUsageStatus: CompletedProviderUsageStatus,
  latencyMs: number,
) {
  return db.begin(async (tx) =>
    await persistWizrdConversation({
      createConversation: async (ownerId, title) => {
        const [conversation] = await tx<{ id: string }[]>`
          insert into public.wizrd_conversations (user_id, title)
          values (${ownerId}::uuid, ${title})
          returning id::text
        `;
        return conversation.id;
      },
      touchConversation: async (ownerId, conversationId) => {
        await tx`
          update public.wizrd_conversations
          set updated_at = now()
          where id = ${conversationId}::uuid
            and user_id = ${ownerId}::uuid
        `;
      },
      insertMessage: async (conversationId, ownerId, role, content) => {
        const [savedMessage] = await tx<DbMessage[]>`
          insert into public.wizrd_messages
            (conversation_id, user_id, role, content)
          values
            (${conversationId}::uuid, ${ownerId}::uuid, ${role}, ${content})
          returning id::text, role, content, created_at
        `;
        return savedMessage;
      },
      completeUsage: async (
        reservationId,
        ownerId,
        conversationId,
        actualInputTokens,
        actualOutputTokens,
        tokenUsageStatus,
        actualLatencyMs,
      ) => {
        const [updatedUsage] = await tx<{ token_usage_status: string }[]>`
          update public.wizrd_usage
          set conversation_id = ${conversationId}::uuid,
              input_tokens = coalesce(${actualInputTokens}, input_tokens),
              output_tokens = coalesce(${actualOutputTokens}, output_tokens),
              token_usage_status = ${tokenUsageStatus},
              latency_ms = ${actualLatencyMs},
              status = 'succeeded'
          where id = ${reservationId}::uuid
            and user_id = ${ownerId}::uuid
            and status = 'pending'
          returning token_usage_status
        `;
        return updatedUsage &&
            isTokenUsageStatus(updatedUsage.token_usage_status)
          ? updatedUsage.token_usage_status
          : null;
      },
    }, {
      userId,
      requestedConversationId,
      message,
      assistantText,
      usageId,
      inputTokens,
      outputTokens,
      tokenUsageStatus,
      latencyMs,
    })
  );
}

function createSseResponse(
  provider: ChatProvider,
  opened: OpenedGroqStream,
  userId: string,
  conversationId: string | null,
  message: string,
  usageId: string,
  priorUsage: ProviderUsage | null,
  requestStartedAt: number,
): Response {
  let clientDisconnected = false;
  let generationFinished = false;
  let usageFinalized = false;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown): boolean => {
        if (clientDisconnected) return false;
        try {
          controller.enqueue(encodeSseEvent(event, data));
          return true;
        } catch {
          clientDisconnected = true;
          if (!generationFinished) opened.abort();
          return false;
        }
      };

      const close = () => {
        if (clientDisconnected) return;
        try {
          controller.close();
        } catch {
          clientDisconnected = true;
        }
      };

      void (async () => {
        let receivedUsage: ProviderUsageAggregate | null = priorUsage
          ? combineProviderUsage(null, priorUsage)
          : null;
        try {
          const completion = await provider.read(opened, (text) => {
            send("delta", { text });
          });
          receivedUsage = combineProviderUsage(receivedUsage, completion);

          // A disconnect after generation is complete must not cancel the
          // transaction. Persist so the client can recover via chat history.
          generationFinished = true;
          const latencyMs = Math.max(
            0,
            Math.round(performance.now() - requestStartedAt),
          );

          const saved = await persistSuccess(
            userId,
            conversationId,
            message,
            completion.content,
            usageId,
            receivedUsage.inputTokens,
            receivedUsage.outputTokens,
            completedProviderUsageStatus(receivedUsage),
            latencyMs,
          );

          usageFinalized = true;
          const reportedUsage = reportedProviderUsage(receivedUsage);
          const knownUsage = knownProviderUsage(receivedUsage);

          send(
            "complete",
            buildWizrdSuccessPayload(saved, {
              provider: AI_PROVIDER,
              model: AI_MODEL,
              ...reportedUsage,
              reportedInputTokens: knownUsage.inputTokens,
              reportedOutputTokens: knownUsage.outputTokens,
              latencyMs,
            }),
          );
          close();
        } catch (error) {
          if (!usageFinalized) {
            const latencyMs = Math.max(
              0,
              Math.round(performance.now() - requestStartedAt),
            );
            const failedUsage = error instanceof ProviderFailure
              ? combineProviderUsage(receivedUsage, error.usage)
              : receivedUsage;
            await markUsageFailed(
              usageId,
              userId,
              latencyMs,
              failedUsage ? knownProviderUsage(failedUsage) : undefined,
            );
            usageFinalized = true;
          }

          if (!clientDisconnected) {
            const providerError = error instanceof ProviderFailure;
            send("error", {
              error: {
                code: providerError
                  ? "AI_PROVIDER_UNAVAILABLE"
                  : "INTERNAL_ERROR",
                message: providerError
                  ? "WiZrd is temporarily unavailable. Please try again shortly."
                  : "Something went wrong. Please try again.",
              },
            });
            close();
          }
        } finally {
          opened.dispose();
        }
      })();
    },

    cancel() {
      clientDisconnected = true;
      if (!generationFinished) opened.abort();
      // After generationFinished, persistence is allowed to complete so the
      // saved result can be recovered from the user's history.
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(
      "INVALID_REQUEST",
      "Only POST requests are supported.",
      400,
    );
  }

  const accessToken = extractBearerToken(req.headers.get("Authorization"));
  if (!accessToken) {
    return errorResponse(
      "UNAUTHENTICATED",
      "Please sign in to use WiZrd.",
      401,
    );
  }

  let userId: string;
  try {
    const { data, error } = await supabaseAuth.auth.getUser(accessToken);
    if (error || !data.user?.id) {
      return errorResponse(
        "UNAUTHENTICATED",
        "Please sign in to use WiZrd.",
        401,
      );
    }
    userId = data.user.id;
  } catch {
    return errorResponse(
      "UNAUTHENTICATED",
      "Please sign in to use WiZrd.",
      401,
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return errorResponse(
      "INVALID_REQUEST",
      "Send the request as JSON.",
      400,
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return errorResponse("INVALID_REQUEST", "The request is too large.", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "The request body must be valid JSON.",
      400,
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(
      "INVALID_REQUEST",
      "The request body must be a JSON object.",
      400,
    );
  }

  const requestBody = body as Record<string, unknown>;
  if (typeof requestBody.message !== "string") {
    return errorResponse("INVALID_REQUEST", "A message is required.", 400);
  }

  const message = requestBody.message.trim();
  if (message.length === 0) {
    return errorResponse(
      "INVALID_REQUEST",
      "A message cannot be empty.",
      400,
    );
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return errorResponse(
      "INVALID_REQUEST",
      "Messages must be 2,000 characters or fewer.",
      400,
    );
  }

  let conversationId: string | null = null;
  if (
    requestBody.conversationId !== null &&
    requestBody.conversationId !== undefined
  ) {
    if (!validUuid(requestBody.conversationId)) {
      return errorResponse(
        "INVALID_REQUEST",
        "conversationId must be a valid UUID or null.",
        400,
      );
    }
    conversationId = requestBody.conversationId;
  }

  let usageId: string | null = null;
  let receivedUsage: ProviderUsageAggregate | null = null;
  const requestStartedAt = performance.now();
  const useSse = acceptsEventStream(req.headers.get("accept"));

  try {
    await verifyDatabasePrivileges();

    if (conversationId !== null) {
      const owned = await db<{ id: string; user_id: string }[]>`
        select id::text, user_id::text
        from public.wizrd_conversations
        where id = ${conversationId}::uuid
          and user_id = ${userId}::uuid
        limit 1
      `;

      if (!conversationBelongsTo(userId, owned[0]?.user_id)) {
        return errorResponse(
          "CONVERSATION_FORBIDDEN",
          "You don't have access to this conversation.",
          403,
        );
      }
    }

    const history = conversationId === null
      ? []
      : await getRecentMessages(userId, conversationId);

    usageId = await reserveUsage(userId, conversationId);

    // Retrieve only through the published-document RPC; never query private
    // conversations or other user data for knowledge context.
    const documents = await getPublishedKnowledge(message);
    const knowledgeContext = buildKnowledgeContext(documents);
    const complexity = selectResponseComplexity(
      message,
      history,
    );

    const provider = getProvider();
    let planningSummary: string | null = null;
    let planningUsage: ProviderUsage | null = null;

    if (complexity === "deep") {
      let planningRequestStarted = false;
      const planning = await runInternalPlanningSafely(async (onDelta) => {
        planningRequestStarted = true;
        const planningOpened = await provider.open(
          buildInternalPlanningMessages(history, knowledgeContext, message),
          req.signal,
        );
        return await provider.read(planningOpened, onDelta);
      });
      planningSummary = planning.summary;
      if (planningRequestStarted) {
        planningUsage = planning.usage;
        receivedUsage = combineProviderUsage(null, planningUsage);
      }
    }

    const messages = buildChatMessages(
      history,
      knowledgeContext,
      message,
      complexity,
      planningSummary,
    );
    let opened: OpenedGroqStream;

    try {
      opened = await provider.open(messages, req.signal);
    } catch (error) {
      const latencyMs = Math.max(
        0,
        Math.round(performance.now() - requestStartedAt),
      );
      const failedUsage = combineProviderUsage(
        planningUsage ? combineProviderUsage(null, planningUsage) : null,
        {
          inputTokens: null,
          outputTokens: null,
        },
      );
      receivedUsage = failedUsage;
      await markUsageFailed(
        usageId,
        userId,
        latencyMs,
        knownProviderUsage(failedUsage),
      );

      if (error instanceof HttpError) {
        return errorResponse(error.code, error.message, error.status);
      }
      return errorResponse(
        "AI_PROVIDER_UNAVAILABLE",
        "WiZrd is temporarily unavailable. Please try again shortly.",
        502,
      );
    }

    if (useSse) {
      return createSseResponse(
        provider,
        opened,
        userId,
        conversationId,
        message,
        usageId,
        planningUsage,
        requestStartedAt,
      );
    }

    let completion: {
      content: string;
      inputTokens: number | null;
      outputTokens: number | null;
    };
    try {
      completion = await provider.read(opened, () => {});
    } catch (error) {
      const latencyMs = Math.max(
        0,
        Math.round(performance.now() - requestStartedAt),
      );
      const finalCallUsage = error instanceof ProviderFailure
        ? error.usage
        : { inputTokens: null, outputTokens: null };
      receivedUsage = combineProviderUsage(
        planningUsage ? combineProviderUsage(null, planningUsage) : null,
        finalCallUsage,
      );
      await markUsageFailed(
        usageId,
        userId,
        latencyMs,
        knownProviderUsage(receivedUsage),
      );
      usageId = null;
      if (error instanceof ProviderFailure) {
        return errorResponse(
          "AI_PROVIDER_UNAVAILABLE",
          "WiZrd is temporarily unavailable. Please try again shortly.",
          502,
        );
      }
      throw error;
    }

    const latencyMs = Math.max(
      0,
      Math.round(performance.now() - requestStartedAt),
    );
    receivedUsage = combineProviderUsage(
      planningUsage ? combineProviderUsage(null, planningUsage) : null,
      completion,
    );
    const saved = await persistSuccess(
      userId,
      conversationId,
      message,
      completion.content,
      usageId,
      receivedUsage.inputTokens,
      receivedUsage.outputTokens,
      completedProviderUsageStatus(receivedUsage),
      latencyMs,
    );
    usageId = null;
    const reportedUsage = reportedProviderUsage(receivedUsage);
    const knownUsage = knownProviderUsage(receivedUsage);
    return jsonResponse(buildWizrdSuccessPayload(saved, {
      provider: AI_PROVIDER,
      model: AI_MODEL,
      ...reportedUsage,
      reportedInputTokens: knownUsage.inputTokens,
      reportedOutputTokens: knownUsage.outputTokens,
      latencyMs,
    }));
  } catch (error) {
    if (usageId) {
      const latencyMs = Math.max(
        0,
        Math.round(performance.now() - requestStartedAt),
      );
      await markUsageFailed(
        usageId,
        userId,
        latencyMs,
        receivedUsage ? knownProviderUsage(receivedUsage) : undefined,
      );
    }

    if (error instanceof HttpError) {
      return errorResponse(error.code, error.message, error.status);
    }

    console.error("WiZrd request failed");
    return errorResponse(
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
      500,
    );
  }
});
