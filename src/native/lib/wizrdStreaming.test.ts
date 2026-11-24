import { describe, expect, it } from "vitest";
import {
  mergeCompletedWizrdMessages,
  ServerSentEventParser,
  sortWizrdMessages,
  streamWizrdChat,
  type WizrdStreamResponse,
} from "./wizrdStreaming";

class FakeXhr {
  readyState = 0;
  status = 200;
  responseText = "";
  timeout = 0;
  requestUrl = "";
  requestMethod = "";
  requestBody = "";
  requestHeaders: Record<string, string> = {};
  aborted = false;
  onprogress: ((event: ProgressEvent) => void) | null = null;
  onload: ((event: ProgressEvent) => void) | null = null;
  onerror: ((event: ProgressEvent) => void) | null = null;
  onabort: ((event: ProgressEvent) => void) | null = null;
  ontimeout: ((event: ProgressEvent) => void) | null = null;
  onreadystatechange: ((event: Event) => void) | null = null;

  open(method: string, url: string) {
    this.requestMethod = method;
    this.requestUrl = url;
    this.readyState = 1;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  getResponseHeader(name: string) {
    return name.toLowerCase() === "content-type" ? "text/event-stream; charset=utf-8" : null;
  }

  send(body: string) {
    this.requestBody = body;
    this.readyState = 2;
    this.onreadystatechange?.({} as Event);
  }

  abort() {
    this.aborted = true;
  }

  emit(chunk: string) {
    this.readyState = 3;
    this.responseText += chunk;
    this.onprogress?.({} as ProgressEvent);
  }

  finish() {
    this.readyState = 4;
    this.onload?.({} as ProgressEvent);
  }

  interrupt() {
    this.onerror?.({} as ProgressEvent);
  }
}

const response: WizrdStreamResponse = {
  conversationId: "conversation-1",
  userMessage: {
    id: "user-1",
    role: "user",
    content: "Summarize this",
    createdAt: "2026-11-17T10:00:00.000Z",
  },
  assistantMessage: {
    id: "assistant-1",
    role: "assistant",
    content: "A complete answer.",
    createdAt: "2026-11-17T10:00:01.000Z",
  },
};

function deltaEvent(text: string, id?: string) {
  return `${id ? `id: ${id}\n` : ""}event: delta\ndata: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

function completionEvent() {
  return `event: complete\ndata: ${JSON.stringify(response)}\n\n`;
}

describe("ServerSentEventParser", () => {
  it("parses events split across chunks, CRLF boundaries, comments, and multiline data", () => {
    const parser = new ServerSentEventParser();
    expect(parser.push(": keepalive\r")).toEqual([]);
    expect(parser.push(`\nid: 7\r\nevent: delta\r\ndata: first\r\ndata: second\r\n\r\n`)).toEqual([
      { event: "delta", id: "7", data: "first\nsecond" },
    ]);

    expect(parser.push("data: final line without delimiter")).toEqual([]);
    expect(parser.finish()).toEqual([{ event: "message", id: "", data: "final line without delimiter" }]);
  });

  it("does not carry an event id onto later events", () => {
    const parser = new ServerSentEventParser();
    expect(parser.push("id: 1\ndata: one\n\ndata: two\n\n")).toEqual([
      { event: "message", id: "1", data: "one" },
      { event: "message", id: "", data: "two" },
    ]);
  });
});

describe("streamWizrdChat", () => {
  it("orders a user message before WiZrd even when database timestamps are identical", () => {
    const timestamp = "2026-11-17T10:00:00.000Z";
    const ordered = sortWizrdMessages([
      { id: "assistant-1", role: "assistant", content: "Answer", createdAt: timestamp },
      { id: "user-1", role: "user", content: "Question", createdAt: timestamp },
    ]);

    expect(ordered.map((message) => message.role)).toEqual(["user", "assistant"]);
  });

  it("replaces optimistic messages by stable server IDs without duplicating completion messages", () => {
    const optimistic = [
      { id: "pending-user", role: "user" as const, content: "Summarize this", createdAt: "2026-11-17T10:00:00.000Z" },
      { id: "stream-assistant", role: "assistant" as const, content: "A complete answer.", createdAt: "2026-11-17T10:00:00.500Z" },
    ];
    const once = mergeCompletedWizrdMessages(optimistic, ["pending-user", "stream-assistant"], response);
    const twice = mergeCompletedWizrdMessages(once, [], response);

    expect(twice).toEqual([response.userMessage, response.assistantMessage]);
  });

  it("sends the existing request contract with the signed-in bearer token and emits text progressively", async () => {
    const xhr = new FakeXhr();
    const received: string[] = [];
    const pending = streamWizrdChat({
      endpoint: "https://project.supabase.co/functions/v1/wizrd-chat",
      anonKey: "public-anon-key",
      accessToken: "user-session-token",
      conversationId: null,
      message: "Summarize this",
      onText: (chunk) => received.push(chunk),
    }, () => xhr);

    expect(xhr.requestMethod).toBe("POST");
    expect(xhr.requestUrl).toContain("/functions/v1/wizrd-chat");
    expect(xhr.requestHeaders.Authorization).toBe("Bearer user-session-token");
    expect(xhr.requestHeaders.apikey).toBe("public-anon-key");
    expect(JSON.parse(xhr.requestBody)).toEqual({ conversationId: null, message: "Summarize this" });

    xhr.emit(deltaEvent("Short "));
    expect(received).toEqual(["Short "]);
    xhr.emit(deltaEvent("answer."));
    expect(received).toEqual(["Short ", "answer."]);
    xhr.emit(completionEvent());
    xhr.finish();
    await expect(pending).resolves.toEqual(response);
  });

  it("streams a long response through many delayed chunks into one message", async () => {
    const xhr = new FakeXhr();
    let accumulated = "";
    const pending = streamWizrdChat({
      endpoint: "https://project.supabase.co/functions/v1/wizrd-chat",
      anonKey: "anon",
      accessToken: "session",
      conversationId: "conversation-1",
      message: "Write a long answer",
      onText: (chunk) => { accumulated += chunk; },
    }, () => xhr);
    expect(JSON.parse(xhr.requestBody).conversationId).toBe("conversation-1");

    const chunks = Array.from({ length: 40 }, (_, index) => `paragraph ${index}. `);
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      xhr.emit(deltaEvent(chunk));
    }
    expect(accumulated).toBe(chunks.join(""));
    xhr.emit(completionEvent());
    xhr.finish();
    await expect(pending).resolves.toEqual(response);
  });

  it("ignores replayed SSE events with the same id", async () => {
    const xhr = new FakeXhr();
    const received: string[] = [];
    const pending = streamWizrdChat({
      endpoint: "https://project.supabase.co/functions/v1/wizrd-chat",
      anonKey: "anon",
      accessToken: "session",
      conversationId: null,
      message: "Hello",
      onText: (chunk) => received.push(chunk),
    }, () => xhr);

    xhr.emit(deltaEvent("once", "event-1"));
    xhr.emit(deltaEvent("duplicate", "event-1"));
    xhr.emit(completionEvent());
    xhr.finish();

    await expect(pending).resolves.toEqual(response);
    expect(received).toEqual(["once"]);
  });

  it("rejects interrupted and incomplete responses without reconnecting", async () => {
    const xhr = new FakeXhr();
    const received: string[] = [];
    const pending = streamWizrdChat({
      endpoint: "https://project.supabase.co/functions/v1/wizrd-chat",
      anonKey: "anon",
      accessToken: "session",
      conversationId: null,
      message: "Hello",
      onText: (chunk) => received.push(chunk),
    }, () => xhr);

    xhr.emit(deltaEvent("partial"));
    xhr.interrupt();
    await expect(pending).rejects.toThrow("Network connection interrupted");
    expect(received).toEqual(["partial"]);
    expect(xhr.aborted).toBe(true);

    const incompleteXhr = new FakeXhr();
    const incomplete = streamWizrdChat({
      endpoint: "https://project.supabase.co/functions/v1/wizrd-chat",
      anonKey: "anon",
      accessToken: "session",
      conversationId: null,
      message: "Hello",
      onText: () => undefined,
    }, () => incompleteXhr);
    incompleteXhr.emit(deltaEvent("partial"));
    incompleteXhr.finish();
    await expect(incomplete).rejects.toThrow("ended before it was complete");
  });
});
