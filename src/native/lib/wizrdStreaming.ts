export type WizrdStreamMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type WizrdStreamResponse = {
  conversationId: string;
  userMessage: WizrdStreamMessage;
  assistantMessage: WizrdStreamMessage;
};

export function sortWizrdMessages(messages: WizrdStreamMessage[]) {
  return [...messages].sort((left, right) => {
    const timestampOrder = left.createdAt.localeCompare(right.createdAt);
    if (timestampOrder !== 0) return timestampOrder;
    if (left.role !== right.role) return left.role === "user" ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
}

export function mergeCompletedWizrdMessages(
  current: WizrdStreamMessage[],
  transientIds: string[],
  response: WizrdStreamResponse,
) {
  const replacedIds = new Set([
    ...transientIds,
    response.userMessage.id,
    response.assistantMessage.id,
  ]);
  return sortWizrdMessages([
    ...current.filter((message) => !replacedIds.has(message.id)),
    response.userMessage,
    response.assistantMessage,
  ]);
}

export type ServerSentEvent = {
  event: string;
  data: string;
  id: string;
};

type WizrdStreamFrame =
  | { kind: "delta"; text: string }
  | { kind: "complete"; response: WizrdStreamResponse }
  | { kind: "done" }
  | { kind: "ignore" };

type StreamXhr = {
  readyState: number;
  status: number;
  responseText: string;
  timeout: number;
  onprogress: ((event: ProgressEvent) => void) | null;
  onload: ((event: ProgressEvent) => void) | null;
  onerror: ((event: ProgressEvent) => void) | null;
  onabort: ((event: ProgressEvent) => void) | null;
  ontimeout: ((event: ProgressEvent) => void) | null;
  onreadystatechange: ((event: Event) => void) | null;
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  getResponseHeader(name: string): string | null;
  send(body: string): void;
  abort(): void;
};

export type StreamWizrdChatOptions = {
  endpoint: string;
  anonKey: string;
  accessToken: string;
  conversationId: string | null;
  message: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onText: (text: string) => void;
  onUnauthorized?: () => void;
  onConnected?: () => void;
  onConnectionError?: (error: Error) => void;
};

export class ServerSentEventParser {
  private buffer = "";
  private eventName = "";
  private dataLines: string[] = [];
  private currentEventId = "";

  push(chunk: string): ServerSentEvent[] {
    this.buffer += chunk;
    const events: ServerSentEvent[] = [];

    while (this.buffer.length > 0) {
      const lineEnd = this.findLineEnd();
      if (!lineEnd) break;
      const { index, length } = lineEnd;
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + length);
      this.processLine(line, events);
    }

    return events;
  }

  finish(): ServerSentEvent[] {
    const events: ServerSentEvent[] = [];
    if (this.buffer.length > 0) {
      this.processLine(this.buffer.endsWith("\r") ? this.buffer.slice(0, -1) : this.buffer, events);
      this.buffer = "";
    }
    this.dispatchEvent(events);
    return events;
  }

  private findLineEnd() {
    const lfIndex = this.buffer.indexOf("\n");
    const crIndex = this.buffer.indexOf("\r");
    if (lfIndex < 0 && crIndex < 0) return null;

    const index = lfIndex < 0 ? crIndex : crIndex < 0 ? lfIndex : Math.min(lfIndex, crIndex);
    const isCr = this.buffer[index] === "\r";
    if (isCr && index === this.buffer.length - 1) return null;
    return {
      index,
      length: isCr && this.buffer[index + 1] === "\n" ? 2 : 1,
    };
  }

  private processLine(line: string, events: ServerSentEvent[]) {
    if (line === "") {
      this.dispatchEvent(events);
      return;
    }
    if (line.startsWith(":")) return;

    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "data") this.dataLines.push(value);
    else if (field === "event") this.eventName = value;
    else if (field === "id" && !value.includes("\0")) this.currentEventId = value;
  }

  private dispatchEvent(events: ServerSentEvent[]) {
    if (this.dataLines.length > 0) {
      events.push({
        event: this.eventName || "message",
        data: this.dataLines.join("\n"),
        id: this.currentEventId,
      });
    }
    this.eventName = "";
    this.dataLines = [];
    this.currentEventId = "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMessage(value: unknown, expectedRole: "user" | "assistant"): WizrdStreamMessage {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.role !== expectedRole ||
    typeof value.content !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("WiZrd sent an invalid completed message.");
  }
  return {
    id: value.id,
    role: expectedRole,
    content: value.content,
    createdAt: value.createdAt,
  };
}

function readCompletion(value: unknown): WizrdStreamResponse | null {
  if (!isRecord(value)) return null;
  const candidate = isRecord(value.response) ? value.response : value;
  if (typeof candidate.conversationId !== "string") return null;
  if (!candidate.userMessage || !candidate.assistantMessage) return null;
  return {
    conversationId: candidate.conversationId,
    userMessage: readMessage(candidate.userMessage, "user"),
    assistantMessage: readMessage(candidate.assistantMessage, "assistant"),
  };
}

function readDelta(value: Record<string, unknown>) {
  const choices = value.choices;
  if (Array.isArray(choices) && isRecord(choices[0])) {
    const choice = choices[0];
    if (isRecord(choice.delta) && typeof choice.delta.content === "string") return choice.delta.content;
    if (typeof choice.text === "string") return choice.text;
  }
  if (typeof value.delta === "string") return value.delta;
  if (typeof value.token === "string") return value.token;
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  return null;
}

function readErrorMessage(value: unknown, fallback: string) {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }
  if (isRecord(value) && typeof value.message === "string") return value.message;
  return fallback;
}

export function parseWizrdStreamEvent(event: ServerSentEvent): WizrdStreamFrame {
  const trimmedData = event.data.trim();
  if (trimmedData === "[DONE]" || event.event === "done" || event.event === "complete") {
    if (trimmedData === "[DONE]" || trimmedData.length === 0) return { kind: "done" };
  }
  if (event.event === "error") {
    let detail: unknown = trimmedData;
    try {
      detail = JSON.parse(trimmedData);
    } catch {
      // Plain-text SSE error messages are valid.
    }
    throw new Error(readErrorMessage(detail, "WiZrd could not complete this response."));
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmedData);
  } catch {
    return trimmedData ? { kind: "delta", text: event.data } : { kind: "ignore" };
  }

  const completion = readCompletion(payload);
  if (completion) return { kind: "complete", response: completion };
  if (!isRecord(payload)) return { kind: "ignore" };
  if (payload.error) {
    throw new Error(readErrorMessage(payload, "WiZrd could not complete this response."));
  }

  const text = readDelta(payload);
  if (text !== null) return { kind: "delta", text };
  if (payload.type === "done" || payload.type === "complete") return { kind: "done" };
  return { kind: "ignore" };
}

function readHttpError(responseText: string, status: number) {
  try {
    return readErrorMessage(JSON.parse(responseText), `WiZrd request failed (${status}).`);
  } catch {
    return responseText.trim() || `WiZrd request failed (${status}).`;
  }
}

function makeAbortError() {
  const error = new Error("WiZrd response was cancelled.");
  error.name = "AbortError";
  return error;
}

export function streamWizrdChat(
  options: StreamWizrdChatOptions,
  createXhr: () => StreamXhr = () => new XMLHttpRequest(),
): Promise<WizrdStreamResponse> {
  return new Promise((resolve, reject) => {
    const xhr = createXhr();
    const parser = new ServerSentEventParser();
    const seenEventIds = new Set<string>();
    let consumedLength = 0;
    let completion: WizrdStreamResponse | null = null;
    let settled = false;
    let reportedAuthRejection = false;
    let reportedConnection = false;

    const cleanup = () => {
      options.signal?.removeEventListener("abort", onSignalAbort);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      xhr.abort();
      reject(error);
    };
    const failConnection = (error: Error) => {
      options.onConnectionError?.(error);
      fail(error);
    };
    const processEvents = (events: ServerSentEvent[]) => {
      for (const event of events) {
        if (event.id && seenEventIds.has(event.id)) continue;
        if (event.id) seenEventIds.add(event.id);
        const frame = parseWizrdStreamEvent(event);
        if (frame.kind === "delta") options.onText(frame.text);
        else if (frame.kind === "complete") completion = frame.response;
      }
    };
    const consumeResponse = () => {
      if (settled || xhr.responseText.length <= consumedLength) return;
      const chunk = xhr.responseText.slice(consumedLength);
      consumedLength = xhr.responseText.length;
      processEvents(parser.push(chunk));
    };
    const onSignalAbort = () => fail(makeAbortError());

    if (options.signal?.aborted) {
      fail(makeAbortError());
      return;
    }

    options.signal?.addEventListener("abort", onSignalAbort, { once: true });

    xhr.timeout = options.timeoutMs ?? 180_000;
    xhr.onreadystatechange = () => {
      if (xhr.readyState < 2) return;
      if (xhr.status === 401 && !reportedAuthRejection) {
        reportedAuthRejection = true;
        // Supabase auth state listens for protected-request rejections.
        options.onUnauthorized?.();
      }
      if (xhr.status > 0 && !reportedConnection) {
        reportedConnection = true;
        options.onConnected?.();
      }
    };
    xhr.onprogress = () => {
      try {
        consumeResponse();
      } catch (cause) {
        fail(cause instanceof Error ? cause : new Error("WiZrd sent an invalid stream."));
      }
    };
    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          fail(new Error(readHttpError(xhr.responseText, xhr.status)));
          return;
        }
        const contentType = xhr.getResponseHeader("content-type")?.toLowerCase() ?? "";
        if (!contentType.startsWith("text/event-stream")) {
          fail(new Error("WiZrd streaming is unavailable. Please try again later."));
          return;
        }
        consumeResponse();
        processEvents(parser.finish());
        if (!completion) {
          fail(new Error("WiZrd’s response ended before it was complete. Reload the chat before retrying."));
          return;
        }
        settled = true;
        cleanup();
        resolve(completion);
      } catch (cause) {
        fail(cause instanceof Error ? cause : new Error("WiZrd could not complete this response."));
      }
    };
    xhr.onerror = () => failConnection(new Error("Network connection interrupted. Reload the chat before retrying."));
    xhr.onabort = () => fail(makeAbortError());
    xhr.ontimeout = () => failConnection(new Error("WiZrd took too long to respond. Reload the chat before retrying."));

    try {
      xhr.open("POST", options.endpoint);
      xhr.setRequestHeader("apikey", options.anonKey);
      xhr.setRequestHeader("Authorization", `Bearer ${options.accessToken}`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "text/event-stream");
      xhr.send(JSON.stringify({
        conversationId: options.conversationId,
        message: options.message,
      }));
    } catch (cause) {
      fail(cause instanceof Error ? cause : new Error("Could not connect to WiZrd."));
    }
  });
}
