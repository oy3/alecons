export function trackPortalActivity({ baseUrl, token, portal, routeName, pathTemplate }) {
  if (!baseUrl || !token || !routeName) return;
  fetch(`${String(baseUrl).replace(/\/$/, "")}/analytics/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ portal, eventType: "page_view", routeName: String(routeName), pathTemplate: pathTemplate || undefined }),
    keepalive: true,
  }).catch(() => undefined);
}
