async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
    throw new Error(err.error || `Request failed (${res.status})`)
  }
  return res.json()
}

export const apiClient = {
  get<T = unknown>(url: string): Promise<T> {
    return fetch(url).then((res) => handleResponse<T>(res))
  },

  post<T = unknown>(url: string, data?: unknown): Promise<T> {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }).then((res) => handleResponse<T>(res))
  },

  patch<T = unknown>(url: string, data?: unknown): Promise<T> {
    return fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }).then((res) => handleResponse<T>(res))
  },

  delete<T = unknown>(url: string): Promise<T> {
    return fetch(url, { method: "DELETE" }).then((res) => handleResponse<T>(res))
  },
}
