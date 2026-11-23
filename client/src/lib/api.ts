
const API_BASE_URL = "/api/v1";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  const body: unknown = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    if (
      body !== null &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      message = body.message;
    }

    throw new ApiError(response.status, message);
  }

  return body as T;
}

export function apiGet<T = unknown>(
  endpoint: string,
  signal?: AbortSignal,
  token?: string
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    { method: "GET", signal },
    token
  );
}

export function apiPost<T = unknown>(
  endpoint: string,
  payload: unknown,
  token?: string
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );
}
