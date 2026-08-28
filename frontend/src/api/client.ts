// The one place that knows about HTTP. Everything else deals in typed data or
// ApiError.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

/** An error carrying the server's own message, so screens can show what the API said. */
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly requestId?: string

  constructor(status: number, title: string, detail: string, requestId?: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.requestId = requestId
  }

  /** True when the API could not be reached at all, rather than refusing. */
  get isNetworkError() {
    return this.status === 0
  }
}

interface ProblemDetail {
  title?: string
  detail?: string
  request_id?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch only rejects when the request never completed: server down, DNS,
    // CORS. The agent needs to be told that, not shown an empty table.
    throw new ApiError(
      0,
      'Cannot reach the API',
      'The server is not responding. Check that the backend is running, then retry.',
    )
  }

  if (!response.ok) {
    // Errors are RFC 9457 problem+json, but a proxy or crash could return
    // something else, so fall back to the status text.
    let problem: ProblemDetail = {}
    try {
      problem = await response.json()
    } catch {
      /* keep the fallbacks below */
    }
    throw new ApiError(
      response.status,
      problem.title ?? response.statusText ?? 'Request failed',
      problem.detail ?? 'The request could not be completed.',
      problem.request_id,
    )
  }

  return response.json() as Promise<T>
}

export function buildQueryString(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
}
