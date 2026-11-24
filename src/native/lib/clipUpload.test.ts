import { describe, expect, it } from "vitest";
import { createTusFileReader } from "./tusFileReader";

describe("bounded Expo-file TUS source", () => {
  it("reads only the requested byte range and marks the final chunk", async () => {
    const bytes = new TextEncoder().encode("0123456789");
    const reads: Array<[number, number]> = [];
    const reader = createTusFileReader(() => ({
      size: bytes.byteLength,
      async readAt(offset, length) {
        reads.push([offset, length]);
        return bytes.slice(offset, offset + length);
      },
      close() {},
    }));

    const source = await reader.openFile({}, 4);
    const first = await source.slice(2, 6);
    const last = await source.slice(6, 10);

    expect(await first.value.text()).toBe("2345");
    expect(first.done).toBe(false);
    expect(await last.value.text()).toBe("6789");
    expect(last.done).toBe(true);
    expect(reads).toEqual([[2, 4], [6, 4]]);
  });

  it("rejects out-of-range and short reads instead of sending misleading chunks", async () => {
    const reader = createTusFileReader(() => ({
      size: 4,
      async readAt() {
        return new Uint8Array(2);
      },
      close() {},
    }));
    const source = await reader.openFile({}, 4);

    await expect(source.slice(0, 4)).rejects.toThrow("requested upload chunk");
    await expect(source.slice(3, 5)).rejects.toThrow("invalid file range");
  });
});
