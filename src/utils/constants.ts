import { FollowUpReason, JobStatus, JobType } from '../types/serviceflow';

export const UNSPECIFIED_TEXT = 'ยังไม่ได้ระบุ';

export const JOB_STATUS_CONFIG: Record<
  JobStatus,
  {
    label: string;
    shortLabel: string;
    textClass: string;
    bgSoftClass: string;
    borderClass: string;
    dotColor: string;
  }
> = {
  new: {
    label: 'งานใหม่',
    shortLabel: 'งานใหม่',
    textClass: 'text-sky-800',
    bgSoftClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    dotColor: 'bg-sky-600',
  },
  needs_info: {
    label: 'รอข้อมูลเพิ่มเติม',
    shortLabel: 'รอข้อมูล',
    textClass: 'text-amber-800',
    bgSoftClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    dotColor: 'bg-amber-600',
  },
  pending_confirmation: {
    label: 'รอยืนยัน',
    shortLabel: 'รอยืนยัน',
    textClass: 'text-indigo-800',
    bgSoftClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    dotColor: 'bg-indigo-600',
  },
  confirmed: {
    label: 'ยืนยันแล้ว',
    shortLabel: 'ยืนยันแล้ว',
    textClass: 'text-teal-800',
    bgSoftClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
    dotColor: 'bg-teal-600',
  },
  completed: {
    label: 'เสร็จแล้ว',
    shortLabel: 'เสร็จแล้ว',
    textClass: 'text-emerald-800',
    bgSoftClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    dotColor: 'bg-emerald-600',
  },
  cancelled: {
    label: 'ยกเลิก',
    shortLabel: 'ยกเลิก',
    textClass: 'text-rose-800',
    bgSoftClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    dotColor: 'bg-rose-600',
  },
};

export const JOB_TYPE_OPTIONS: JobType[] = [
  'ล้างแอร์',
  'ซ่อมแอร์ / ตรวจเช็ค',
  'เติมน้ำยาแอร์',
  'ติดตั้งแอร์',
  'ย้ายแอร์',
  'อื่นๆ',
];

export const FOLLOW_UP_REASON_OPTIONS: FollowUpReason[] = [
  'รอลูกค้าส่งที่อยู่',
  'รอลูกค้ายืนยันวันนัด',
  'รอติดต่อกลับ',
  'รอแจ้งราคา / อะไหล่',
  'อื่นๆ',
];

export const SAMPLE_LINE_MESSAGES: { title: string; text: string }[] = [
  {
    title: 'แอร์ไม่เย็น · บางนา (ตัวอย่างหลัก)',
    text: 'แอร์ห้องนอนไม่ค่อยเย็นครับ เป็น Daikin 12000 BTU อยากให้เข้ามาดูวันเสาร์ช่วงบ่าย บ้านอยู่แถวบางนา',
  },
  {
    title: 'แอร์น้ำหยด · มีเบอร์โทรและชื่อ',
    text: 'สวัสดีค่ะ ชื่อบีนะคะ แอร์ Mitsubishi 18000 BTU ที่ห้องนั่งเล่นน้ำหยดลงพื้นค่ะ ต้องการล้างแอร์และเช็ครั่ว พรุ่งนี้เช้า 10:00 น. สะดวกไหมคะ คอนโดแถวอ่อนนุช สุขุมวิท 77 โทร 080-000-0202 ค่ะ',
  },
  {
    title: 'ติดตั้งแอร์ใหม่ · ข้อมูลยังไม่ครบ',
    text: 'สอบถามคิวติดตั้งแอร์ใหม่ครับ Carrier 9000 BTU แถวลาดพร้าว ว่างวันไหนบ้างครับ',
  },
];

export function formatThaiDate(dateStr: string): string {
  if (!dateStr || dateStr === UNSPECIFIED_TEXT) return UNSPECIFIED_TEXT;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const months = [
      'ม.ค.',
      'ก.พ.',
      'มี.ค.',
      'เม.ย.',
      'พ.ค.',
      'มิ.ย.',
      'ก.ค.',
      'ส.ค.',
      'ก.ย.',
      'ต.ค.',
      'พ.ย.',
      'ธ.ค.',
    ];
    return `${d} ${months[dt.getMonth()]} ${y + 543}`;
  }
  return dateStr;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function displayOrUnspecified(value?: string | null): string {
  if (!value || !value.trim()) return UNSPECIFIED_TEXT;
  return value.trim();
}
