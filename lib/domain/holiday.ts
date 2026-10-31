/** Ngày lễ dương lịch cố định; Tết, Giỗ Tổ và ngày nghỉ bù đổi theo năm nên nhập tay (HOL-02). */
const FIXED_VN_HOLIDAYS = [
  { monthDay: '01-01', name: 'Tết Dương lịch' },
  { monthDay: '04-30', name: 'Ngày Giải phóng miền Nam' },
  { monthDay: '05-01', name: 'Quốc tế Lao động' },
  { monthDay: '09-02', name: 'Quốc khánh' },
];

export function vietnamHolidays(year: number) {
  return FIXED_VN_HOLIDAYS.map(({ monthDay, name }) => ({ date: `${year}-${monthDay}`, name }));
}
