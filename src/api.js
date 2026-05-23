const PRODUCTION_API_ORIGIN = "https://velahealth.health";

export function resolveApiUrl(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiBaseUrl = options.apiBaseUrl ?? process.env.REACT_APP_API_BASE_URL;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const locationProtocol = options.locationProtocol ?? (
    typeof window !== "undefined" ? window.location?.protocol : ""
  );

  if (apiBaseUrl) {
    return `${apiBaseUrl.replace(/\/+$/, "")}${normalizedPath}`;
  }

  if (locationProtocol === "capacitor:" || locationProtocol === "file:") {
    return `${PRODUCTION_API_ORIGIN}${normalizedPath}`;
  }

  if (nodeEnv === "production") {
    return `${PRODUCTION_API_ORIGIN}${normalizedPath}`;
  }

  return normalizedPath;
}

export function apiUrl(path) {
  return resolveApiUrl(path);
}

export function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (process.env.NODE_ENV === "development" && process.env.REACT_APP_ASK_VELA_DEV_TOKEN) {
    headers["x-dev-token"] = process.env.REACT_APP_ASK_VELA_DEV_TOKEN;
  }
  return headers;
}
