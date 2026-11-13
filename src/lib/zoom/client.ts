import "server-only";

/**
 * Zoom API client — Server-to-Server OAuth (note 09 §40.2).
 *
 * The app is made in Tony's Zoom Pro account, so its token acts for that
 * account; meetings are created under "me", the user who made the app. The
 * three keys are read from the server environment only, and the token is held
 * in memory for its life (an hour) rather than fetched per call.
 */

const API = "https://api.zoom.us/v2";

export function zoomConfigured(): boolean {
  return Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;

  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new ZoomError(0, "Zoom is not configured");
  }

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64")}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; reason?: string };
  if (!response.ok || !body.access_token) {
    // Zoom's reason, never the request: it would carry the keys.
    throw new ZoomError(response.status, `Zoom sign-in failed: ${body.reason ?? response.status}`);
  }

  token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

export class ZoomError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Zoom's own error code: 3001 is "meeting does not exist". */
    readonly code?: number,
  ) {
    super(message);
  }

  get notFound(): boolean {
    return this.status === 404 || this.code === 3001;
  }
}

export async function zoom<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const send = async () =>
    fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

  let response = await send();
  if (response.status === 401) {
    // A token Zoom has revoked early: fetch a fresh one once.
    token = null;
    response = await send();
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { code?: number; message?: string };
  if (!response.ok) {
    throw new ZoomError(response.status, `Zoom ${method} ${path.split("?")[0]}: ${data.message ?? response.status}`, data.code);
  }
  return data as T;
}
