export type JobStatus =
  | 'new'
  | 'needs_info'
  | 'pending_confirmation'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export type JobType =
  | 'ล้างแอร์'
  | 'ซ่อมแอร์ / ตรวจเช็ค'
  | 'เติมน้ำยาแอร์'
  | 'ติดตั้งแอร์'
  | 'ย้ายแอร์'
  | 'อื่นๆ';

export type FollowUpReason =
  | 'รอลูกค้าส่งที่อยู่'
  | 'รอลูกค้ายืนยันวันนัด'
  | 'รอติดต่อกลับ'
  | 'รอแจ้งราคา / อะไหล่'
  | 'อื่นๆ';

export interface ACUnit {
  id: string;
  brand: string;
  btu: string;
  locationInHome: string;
  lastServicedAt?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  area: string;
  address: string;
  lineDisplayName?: string;
  acUnits: ACUnit[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export interface FollowUpInfo {
  required: boolean;
  reason: FollowUpReason | '';
  dueDate: string; // YYYY-MM-DD or ''
  note?: string;
  completed: boolean;
  completedAt?: string;
}

export interface Job {
  id: string;
  jobCode: string;
  customerId: string | null;
  customerName: string;
  phone: string;
  jobType: JobType | string;
  symptom: string;
  brand: string;
  btu: string;
  preferredDate: string; // YYYY-MM-DD or descriptive text when unconfirmed
  preferredDateConfirmed: boolean;
  preferredTime: string;
  area: string;
  address: string;
  status: JobStatus;
  rawLineMessage?: string;
  aiModeUsed?: 'gemini' | 'demo' | 'manual';
  technicianNotes?: string;
  followUp: FollowUpInfo;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export interface ExtractedFieldSummary {
  key: keyof ExtractedFields;
  label: string;
  value: string;
}

export interface UncertainFieldSummary {
  key: keyof ExtractedFields;
  label: string;
  rawValue: string;
  reason: string;
}

export interface ExtractedFields {
  customerName: string | null;
  phone: string | null;
  jobType: string | null;
  symptom: string | null;
  brand: string | null;
  btu: string | null;
  preferredDateRaw: string | null;
  preferredDateISO: string | null;
  dateNeedsConfirmation: boolean;
  preferredTime: string | null;
  area: string | null;
  address: string | null;
}

export interface ParsedLineResult {
  mode: 'gemini' | 'demo';
  notice: string;
  rawMessage: string;
  fields: ExtractedFields;
  detectedFields: ExtractedFieldSummary[];
  missingFields: { key: keyof ExtractedFields; label: string }[];
  uncertainFields: UncertainFieldSummary[];
  suggestedQuestions: string[];
  suggestedStatus: JobStatus;
  suggestedFollowUpReason: FollowUpReason | '';
}

export type AppTab = 'dashboard' | 'ai-creator' | 'jobs' | 'customers' | 'followups';
