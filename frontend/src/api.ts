import { useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
interface ApiResponse<T> {
  success: boolean;
  result: T;
  error?: { message?: string; details?: Record<string, unknown> };
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/portal/api/${path}`, {
    credentials: "same-origin",
    ...options,
  });
  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      "The server did not return a valid response. Please try again.",
      response.status,
    );
  }
  if (!response.ok || !json.success)
    throw new ApiError(
      json.error?.message || "The request could not be completed.",
      response.status,
      json.error?.details,
    );
  return json.result;
}
export function action<T>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== null && value !== "")
      query.set(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
  return request<T>(`action/${name}?${query}`);
}
export function mutate<T>(
  name: string,
  data: Record<string, unknown> | FormData,
  csrf: string,
): Promise<T> {
  const multipart = data instanceof FormData;
  return request<T>(`action/${name}`, {
    method: "POST",
    headers: {
      "X-CSRFToken": csrf,
      ...(!multipart ? { "Content-Type": "application/json" } : {}),
    },
    body: multipart ? data : JSON.stringify(data),
  });
}
export function useData<T>(
  key: string,
  load: () => Promise<T>,
  enabled = true,
) {
  const [state, setState] = useState<{
    data?: T;
    loading: boolean;
    error?: Error;
  }>({ loading: enabled });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setState({ loading: false });
      return;
    }
    let current = true;
    setState({ loading: true });
    load()
      .then((data) => {
        if (current) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (current)
          setState({
            error:
              error instanceof Error
                ? error
                : new Error("Unable to load data."),
            loading: false,
          });
      });
    return () => {
      current = false;
    };
    // key describes the complete request, including all filters and pagination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, version]);
  return { ...state, reload: () => setVersion((value) => value + 1) };
}
export function useAction<T>(
  name: string,
  params: Record<string, unknown> = {},
  enabled = true,
) {
  return useData<T>(
    name + JSON.stringify(params),
    () => action<T>(name, params),
    enabled,
  );
}
export function safeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function date(value?: string) {
  if (!value) return "Not specified";
  const needsUtc =
    /^\d{4}-\d{2}-\d{2}T/.test(value) && !/(Z|[+-]\d{2}:\d{2})$/.test(value);
  const parsed = new Date(needsUtc ? value + "Z" : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(parsed);
}
export function plain(value?: string | null) {
  return (value || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
export function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 95);
}
