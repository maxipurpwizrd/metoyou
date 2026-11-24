export type UpstreamSseEvent = { data: string };

const MAX_SSE_FRAME_CHARS = 1_000_000;

export class SseDecoder {
  private buffer = "";
  private dataLines: string[] = [];

  push(chunk: string, final = false): UpstreamSseEvent[] {
    this.buffer += chunk;
    const events: UpstreamSseEvent[] = [];

    while (this.buffer.length > 0) {
      let index = -1;
      for (let i = 0; i < this.buffer.length; i++) {
        if (this.buffer[i] === "\n" || this.buffer[i] === "\r") {
          index = i;
          break;
        }
      }

      if (index < 0) break;

      const isCr = this.buffer[index] === "\r";
      if (isCr && index === this.buffer.length - 1 && !final) break;

      const line = this.buffer.slice(0, index);
      const lineEndingLength = isCr && this.buffer[index + 1] === "\n" ? 2 : 1;
      this.buffer = this.buffer.slice(index + lineEndingLength);
      this.processLine(line, events);
    }

    if (
      this.buffer.length + this.dataLines.join("\n").length >
        MAX_SSE_FRAME_CHARS
    ) {
      throw new Error("SSE frame exceeded the allowed size");
    }

    if (final) {
      if (this.buffer.length > 0) {
        const line = this.buffer.endsWith("\r")
          ? this.buffer.slice(0, -1)
          : this.buffer;
        this.processLine(line, events);
      }
      this.buffer = "";
      this.dispatch(events);
    }

    return events;
  }

  private processLine(line: string, events: UpstreamSseEvent[]) {
    if (line === "") {
      this.dispatch(events);
      return;
    }
    if (line.startsWith(":")) return;

    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "data") {
      this.dataLines.push(value);
      if (this.dataLines.join("\n").length > MAX_SSE_FRAME_CHARS) {
        throw new Error("SSE frame exceeded the allowed size");
      }
    }
  }

  private dispatch(events: UpstreamSseEvent[]) {
    if (this.dataLines.length > 0) {
      events.push({ data: this.dataLines.join("\n") });
    }
    this.dataLines = [];
  }
}

export type GroqSseFrame = {
  done: boolean;
  delta?: string;
  inputTokens?: number;
  outputTokens?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function acceptsEventStream(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  return acceptHeader.split(",").some((mediaRange) => {
    const [mediaType, ...parameters] = mediaRange.split(";");
    if (mediaType.trim().toLowerCase() !== "text/event-stream") return false;
    const quality = parameters.find((parameter) =>
      /^\s*q\s*=/i.test(parameter)
    );
    if (!quality) return true;
    const value = Number(quality.split("=")[1]?.trim());
    return Number.isFinite(value) && value > 0 && value <= 1;
  });
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
    ? value
    : undefined;
}

export function parseGroqSseData(data: string): GroqSseFrame {
  if (data.trim() === "[DONE]") return { done: true };

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new Error("Malformed Groq SSE JSON");
  }

  if (!isRecord(payload)) throw new Error("Malformed Groq SSE payload");
  if (payload.error) throw new Error("Groq returned a stream error");

  const usage = isRecord(payload.usage) ? payload.usage : undefined;
  const choices = payload.choices;

  if (choices !== undefined && !Array.isArray(choices)) {
    throw new Error("Malformed Groq choices payload");
  }
  if (choices === undefined && !usage) {
    throw new Error("Groq SSE payload had neither choices nor usage");
  }

  let delta: string | undefined;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0];
    if (isRecord(choice) && isRecord(choice.delta)) {
      if (typeof choice.delta.content === "string") {
        delta = choice.delta.content;
      }
    }
  }

  return {
    done: false,
    delta,
    inputTokens: usage ? tokenCount(usage.prompt_tokens) : undefined,
    outputTokens: usage ? tokenCount(usage.completion_tokens) : undefined,
  };
}

export function encodeSseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}
