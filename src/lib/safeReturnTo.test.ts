// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { getSafeReturnTo } from "./safeReturnTo";

describe("safe login return destination", () => {
  it("preserves an internal deep link and its query", () => {
    expect(getSafeReturnTo({
      from: { pathname: "/posts/post-123", search: "?showComments=1" },
    })).toBe("/posts/post-123?showComments=1");
  });

  it("preserves a stored internal path including its query", () => {
    expect(getSafeReturnTo("/posts/post-123?redirect=https://example.com")).toBe(
      "/posts/post-123?redirect=https://example.com",
    );
  });

  it.each([
    { pathname: "https://evil.example/steal" },
    { pathname: "//evil.example/steal" },
    { pathname: "/\\\\evil.example/steal" },
    { pathname: "/login" },
  ])("rejects unsafe return destinations: %o", (from) => {
    expect(getSafeReturnTo({ from })).toBeNull();
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\\\evil.example/steal",
    "/%2f%2fevil.example/steal",
    "/%5c%5cevil.example/steal",
  ])(
    "rejects unsafe stored destinations: %s",
    (destination) => {
      expect(getSafeReturnTo(destination)).toBeNull();
    },
  );
});
