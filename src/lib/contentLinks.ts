const CANONICAL_ORIGIN = "https://metoyouvibes.com";

function contentUrl(path: string) {
  return new URL(path, CANONICAL_ORIGIN).toString();
}

export function postUrl(postId: string | number) {
  return contentUrl(`/posts/${encodeURIComponent(String(postId))}`);
}

export function profileUrl(username: string) {
  return contentUrl(`/profiles/${encodeURIComponent(username)}`);
}

export function clipUrl(postId: string | number) {
  return contentUrl(`/clips/${encodeURIComponent(String(postId))}`);
}

export function flickUrl(postId: string | number) {
  return contentUrl(`/flicks/${encodeURIComponent(String(postId))}`);
}
