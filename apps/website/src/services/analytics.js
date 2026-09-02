const VERIFY_PATH_PREFIX = "/verify/";

function isPrivateRoute(pathname = window.location.pathname) {
  return pathname.startsWith(VERIFY_PATH_PREFIX);
}

export function initializeAnalytics() {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim();
  if (!websiteId || isPrivateRoute()) return false;
  if (document.querySelector("script[data-alecons-analytics]")) return true;

  window.aleconsAnalyticsBeforeSend = (type, payload) => {
    try {
      const url = new URL(payload.url || window.location.href, window.location.origin);
      if (isPrivateRoute(url.pathname)) return false;
      return { ...payload, url: url.pathname };
    } catch {
      return false;
    }
  };

  const script = document.createElement("script");
  script.defer = true;
  script.src =
    import.meta.env.VITE_UMAMI_SCRIPT_URL?.trim() ||
    "https://cloud.umami.is/script.js";
  script.dataset.aleconsAnalytics = "true";
  script.dataset.websiteId = websiteId;
  script.dataset.domains =
    import.meta.env.VITE_UMAMI_DOMAINS?.trim() ||
    "alecons.edu.ng,www.alecons.edu.ng";
  script.dataset.excludeSearch = "true";
  script.dataset.excludeHash = "true";
  script.dataset.doNotTrack = "true";
  script.dataset.beforeSend = "aleconsAnalyticsBeforeSend";

  if (import.meta.env.VITE_UMAMI_ENABLE_PERFORMANCE === "true") {
    script.dataset.performance = "true";
  }

  document.head.append(script);
  return true;
}

export function trackEvent(eventName) {
  if (!eventName || isPrivateRoute()) return false;
  if (!window.umami?.track) return false;
  window.umami.track(eventName);
  return true;
}
