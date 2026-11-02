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

/** Tải file từ API về máy; lỗi trả về như `apiRequest` để hiện thành toast. */
export async function downloadFile(url: string): Promise<ApiResult<object>> {
  try {
    const response = await fetch(url);
    if (!response.ok) return (await response.json()) as ApiResult<object>;

    const filename = /filename="(.+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1];
    const href = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = href;
    link.download = filename ?? 'tai-ve.xlsx';
    link.click();
    URL.revokeObjectURL(href);
    return { ok: true };
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }
}
