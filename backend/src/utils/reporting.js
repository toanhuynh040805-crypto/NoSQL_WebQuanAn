import { AppError } from './errors.js';
const DAY = 86400000;

export function vietnamDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
export function reportRange(query = {}, now = new Date()) {
  const parseDay = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, 'Ngày báo cáo phải theo dạng YYYY-MM-DD');
    const date = new Date(value + 'T00:00:00+07:00');
    if (!Number.isFinite(date.getTime()) || vietnamDate(date) !== value) throw new AppError(400, 'Ngày báo cáo không hợp lệ');
    return date;
  };
  const toDay = parseDay(query.to || vietnamDate(now));
  const from = query.from ? parseDay(query.from) : new Date(toDay.getTime() - 29 * DAY);
  const to = new Date(toDay.getTime() + DAY - 1);
  if (from > to) throw new AppError(400, 'Ngày bắt đầu phải trước ngày kết thúc');
  if (to - from > 367 * DAY) throw new AppError(400, 'Vui lòng chọn tối đa 1 năm mỗi lần xem báo cáo');
  return { from, to };
}
