/** Link cài app nhân viên, tự điền mã công ty ở M1. */
export function inviteLink(origin: string, companyCode: string): string {
  return `${origin}/m?ma=${encodeURIComponent(companyCode)}`;
}

type InviteMessage = { name: string; email: string; pin?: string; link: string; companyCode: string };

/** CSDL chỉ lưu PIN băm: ngoài lúc vừa tạo hoặc đặt lại, không có PIN nào để gửi kèm. */
export function inviteMessage({ name, email, pin, link, companyCode }: InviteMessage): string {
  return [
    `Chào ${name}, mở link này để cài app chấm công: ${link}`,
    `Mã công ty: ${companyCode}`,
    `Email: ${email}`,
    pin ? `PIN: ${pin}` : 'PIN: hỏi quản lý',
  ].join('\n');
}
