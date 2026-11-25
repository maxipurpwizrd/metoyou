function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getSafeReturnTo(locationState: unknown): string | null {
  const from = isRecord(locationState) && isRecord(locationState.from)
    ? locationState.from
    : null;
  const isPathString = typeof locationState === "string";
  const pathname = isPathString ? locationState.split(/[?#]/, 1)[0] : from?.pathname;
  if (
    typeof pathname !== "string" ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("\\")
  ) {
    return null;
  }
  let destination: string;
  if (isPathString) {
    destination = locationState;
  } else {
    if (!from) return null;
    const { search, hash } = from;
    if (search !== undefined && (typeof search !== "string" || (search !== "" && !search.startsWith("?")))) {
      return null;
    }
    if (hash !== undefined && (typeof hash !== "string" || (hash !== "" && !hash.startsWith("#")))) {
      return null;
    }
    destination = `${pathname}${search ?? ""}${hash ?? ""}`;
  }

  try {
    const target = new URL(destination, window.location.origin);
    const decodedPathname = decodeURIComponent(target.pathname);
    if (
      target.origin !== window.location.origin ||
      decodedPathname.startsWith("//") ||
      decodedPathname.includes("\\")
    ) return null;
    if (["/", "/login", "/signup", "/welcome", "/about"].includes(target.pathname)) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}
