export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; fields?: Record<string, string> };

const CONNECTION_ERROR = 'Không kết nối được, vui lòng thử lại';

/** Gọi API từ trình duyệt; không ném lỗi, kết quả luôn có `ok`. */
export async function apiRequest<T extends object = object>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await response.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }
}
