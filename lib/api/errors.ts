/** Lỗi nghiệp vụ trả thẳng cho client; `fields` là lỗi theo từng trường của form. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, `Không tìm thấy ${what}`);
