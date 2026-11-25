// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./App";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoading: false,
}));

vi.mock("./hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("./pages/Feed", async () => {
  const React = await import("react");
  const { useLocation, useParams } = await import("react-router-dom");
  return {
    default: function MockFeed() {
      const { postId } = useParams();
      const location = useLocation();
      return React.createElement("main", { "data-testid": "content" }, `post:${postId ?? "none"}${location.search}`);
    },
  };
});

vi.mock("./pages/Profile", async () => {
  const React = await import("react");
  const { useParams } = await import("react-router-dom");
  return {
    default: function MockProfile() {
      const { username } = useParams();
      return React.createElement("main", { "data-testid": "content" }, `profile:${username}`);
    },
  };
});

vi.mock("./pages/Clips", async () => {
  const React = await import("react");
  const { useParams } = await import("react-router-dom");
  return {
    default: function MockClips() {
      const { postId } = useParams();
      return React.createElement("main", { "data-testid": "content" }, `clip:${postId}`);
    },
  };
});

vi.mock("./pages/Flicks", async () => {
  const React = await import("react");
  const { useParams } = await import("react-router-dom");
  return {
    default: function MockFlicks() {
      const { postId } = useParams();
      return React.createElement("main", { "data-testid": "content" }, `flick:${postId}`);
    },
  };
});

vi.mock("./pages/Login", async () => {
  const React = await import("react");
  const { useLocation } = await import("react-router-dom");
  return {
    default: function MockLogin() {
      const location = useLocation();
      const state = location.state as { from?: { pathname?: string; search?: string } } | null;
      return React.createElement("main", { "data-testid": "login" }, `login:${state?.from?.pathname ?? "none"}${state?.from?.search ?? ""}`);
    },
  };
});

describe("canonical content routes", () => {
  beforeEach(() => {
    authState.user = { id: "signed-in-user" };
    authState.isLoading = false;
    window.sessionStorage.clear();
  });

  afterEach(cleanup);

  it.each([
    ["/posts/post-123", "post:post-123"],
    ["/profiles/alice", "profile:alice"],
    ["/clips/clip-123", "clip:clip-123"],
    ["/flicks/flick-123", "flick:flick-123"],
  ])("opens %s directly for an authenticated user", async (path, expected) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("content")).toHaveTextContent(expected);
  });

  it("sends signed-out visitors to login with the requested content location", async () => {
    authState.user = null;
    render(
      <MemoryRouter initialEntries={["/posts/post-123?showComments=1"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("login")).toHaveTextContent("/posts/post-123?showComments=1");
  });

  it("returns an authenticated visitor from login to a safe deep link", async () => {
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: "/login",
          state: { from: { pathname: "/profiles/alice" } },
        }]}
      >
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("content")).toHaveTextContent("profile:alice");
  });
});
