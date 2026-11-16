import type { QuarantineRecord } from './storage';

export const BACKUP_FORMAT_VERSION = '1.0';
export const APP_NAME = 'ServiceFlow AI';
export const APP_VERSION = '0.0.0';

const STORAGE_KEYS = {
  CUSTOMERS: 'serviceflow_customers_v1',
  JOBS: 'serviceflow_jobs_v1',
  INITIALIZED: 'serviceflow_initialized_v1',
  QUARANTINE: 'serviceflow_quarantine_v1',
} as const;

export interface ServiceFlowBackupPayload {
  backupFormatVersion: string;
  exportedAt: string;
  appName: string;
  appVersion: string;
  source: 'localStorage';
  initializedFlag: string | null;
  hasQuarantineData?: boolean;
  quarantineCount?: number;
  quarantineSource?: 'localStorage' | 'memory' | 'localStorage_and_memory';
  summary: {
    customerCount: number;
    jobCount: number;
    acUnitCount: number;
    jobStatuses: Record<string, number>;
    linkedJobCount: number;
    unlinkedJobCount: number;
  };
  customers: unknown[];
  jobs: unknown[];
  quarantineRecords?: unknown[];
  rawStorageErrors?: {
    customersReadError?: string;
    jobsReadError?: string;
    initializedReadError?: string;
    quarantineReadError?: string;
    customersParseError?: string;
    jobsParseError?: string;
    quarantineParseError?: string;
    rawCustomers?: string | null;
    rawJobs?: string | null;
    rawQuarantine?: string | null;
  };
}

export interface MissingCustomerReference {
  jobId: string;
  jobCode: string;
  customerId: string;
}

export interface BackupValidationReport {
  isValidJson: boolean;
  isValidStructure: boolean;
  errors: string[];
  warnings: string[];
  backupFormatVersion: string | null;
  exportedAt: string | null;
  appVersion: string | null;
  customerCount: number;
  jobCount: number;
  acUnitCount: number;
  quarantineCount: number;
  duplicateCustomerIds: string[];
  duplicateJobIds: string[];
  missingCustomerIdsCount: number;
  missingJobIdsCount: number;
  missingCustomerReferences: MissingCustomerReference[];
  unlinkedJobCount: number;
}

export interface CurrentBackupSnapshot {
  fileName: string;
  jsonText: string;
  payload: ServiceFlowBackupPayload;
  validation: BackupValidationReport;
  storageReadError: string | null;
}

function getStorageSafe(): { storage: Storage | null; error?: string } {
  try {
    const g = globalThis as { window?: { localStorage?: Storage }; localStorage?: Storage };
    const storage = g.window?.localStorage ?? g.localStorage ?? null;
    if (!storage || typeof storage.getItem !== 'function') {
      return { storage: null, error: 'ไม่สามารถเข้าถึง localStorage ของ Browser ได้' };
    }
    return { storage };
  } catch (err) {
    return {
      storage: null,
      error: err instanceof Error ? err.message : 'ไม่สามารถเข้าถึง localStorage ของ Browser ได้',
    };
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function generateBackupFileName(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `serviceflow-backup-${y}-${m}-${d}-${hh}${mm}${ss}.json`;
}

function countAcUnits(customers: unknown[]): number {
  let total = 0;
  for (const c of customers) {
    if (isPlainRecord(c) && Array.isArray(c.acUnits)) {
      total += c.acUnits.length;
    }
  }
  return total;
}

function summarizeJobs(jobs: unknown[]): {
  jobStatuses: Record<string, number>;
  linkedJobCount: number;
  unlinkedJobCount: number;
} {
  const jobStatuses: Record<string, number> = {};
  let linkedJobCount = 0;
  let unlinkedJobCount = 0;

  for (const j of jobs) {
    if (!isPlainRecord(j)) continue;
    const status = typeof j.status === 'string' && j.status ? j.status : 'unknown';
    jobStatuses[status] = (jobStatuses[status] || 0) + 1;

    if (typeof j.customerId === 'string' && j.customerId.trim().length > 0) {
      linkedJobCount += 1;
    } else {
      unlinkedJobCount += 1;
    }
  }

  return { jobStatuses, linkedJobCount, unlinkedJobCount };
}

export function validateBackupData(parsed: unknown): BackupValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainRecord(parsed)) {
    return {
      isValidJson: true,
      isValidStructure: false,
      errors: ['โครงสร้างไฟล์ไม่ใช่ JSON Object ของ ServiceFlow Backup'],
      warnings: [],
      backupFormatVersion: null,
      exportedAt: null,
      appVersion: null,
      customerCount: 0,
      jobCount: 0,
      acUnitCount: 0,
      quarantineCount: 0,
      duplicateCustomerIds: [],
      duplicateJobIds: [],
      missingCustomerIdsCount: 0,
      missingJobIdsCount: 0,
      missingCustomerReferences: [],
      unlinkedJobCount: 0,
    };
  }

  const backupFormatVersion =
    typeof parsed.backupFormatVersion === 'string' ? parsed.backupFormatVersion : null;
  const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
  const appVersion = typeof parsed.appVersion === 'string' ? parsed.appVersion : null;

  if (!backupFormatVersion) {
    warnings.push('ไม่พบฟิลด์ backupFormatVersion ในไฟล์');
  }
  if (!exportedAt) {
    warnings.push('ไม่พบฟิลด์ exportedAt ในไฟล์');
  }

  if (!Array.isArray(parsed.customers)) {
    errors.push('ไม่พบอาร์เรย์ customers หรือรูปแบบไม่ถูกต้อง');
  }
  if (!Array.isArray(parsed.jobs)) {
    errors.push('ไม่พบอาร์เรย์ jobs หรือรูปแบบไม่ถูกต้อง');
  }

  const customers: unknown[] = Array.isArray(parsed.customers) ? parsed.customers : [];
  const jobs: unknown[] = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  const quarantineRecords: unknown[] = Array.isArray(parsed.quarantineRecords)
    ? parsed.quarantineRecords
    : [];
  const quarantineCount =
    typeof parsed.quarantineCount === 'number' ? parsed.quarantineCount : quarantineRecords.length;

  const customerIdCounts = new Map<string, number>();
  const customerIdSet = new Set<string>();
  let missingCustomerIdsCount = 0;

  for (const c of customers) {
    if (!isPlainRecord(c)) {
      errors.push('พบรายการลูกค้าที่ไม่ใช่ Object');
      continue;
    }
    if (typeof c.id === 'string' && c.id.trim().length > 0) {
      const id = c.id.trim();
      customerIdSet.add(id);
      customerIdCounts.set(id, (customerIdCounts.get(id) || 0) + 1);
    } else {
      missingCustomerIdsCount += 1;
    }
  }

  const duplicateCustomerIds = Array.from(customerIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  if (duplicateCustomerIds.length > 0) {
    errors.push(`พบรหัสลูกค้า (customer id) ซ้ำกัน ${duplicateCustomerIds.length} รายการ`);
  }
  if (missingCustomerIdsCount > 0) {
    warnings.push(`พบข้อมูลลูกค้าที่ไม่มี id จำนวน ${missingCustomerIdsCount} ราย`);
  }

  const jobIdCounts = new Map<string, number>();
  let missingJobIdsCount = 0;
  let unlinkedJobCount = 0;
  const missingCustomerReferences: MissingCustomerReference[] = [];

  for (const j of jobs) {
    if (!isPlainRecord(j)) {
      errors.push('พบรายการใบงานที่ไม่ใช่ Object');
      continue;
    }
    const jobId = typeof j.id === 'string' && j.id.trim().length > 0 ? j.id.trim() : '';
    const jobCode =
      typeof j.jobCode === 'string' && j.jobCode.trim().length > 0 ? j.jobCode.trim() : '(ไม่มีรหัส)';

    if (jobId) {
      jobIdCounts.set(jobId, (jobIdCounts.get(jobId) || 0) + 1);
    } else {
      missingJobIdsCount += 1;
    }

    if (typeof j.customerId === 'string' && j.customerId.trim().length > 0) {
      const refId = j.customerId.trim();
      if (!customerIdSet.has(refId)) {
        missingCustomerReferences.push({
          jobId: jobId || '(ไม่มี id)',
          jobCode,
          customerId: refId,
        });
      }
    } else {
      unlinkedJobCount += 1;
    }
  }

  const duplicateJobIds = Array.from(jobIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  if (duplicateJobIds.length > 0) {
    errors.push(`พบรหัสใบงาน (job id) ซ้ำกัน ${duplicateJobIds.length} รายการ`);
  }
  if (missingJobIdsCount > 0) {
    warnings.push(`พบข้อมูลใบงานที่ไม่มี id จำนวน ${missingJobIdsCount} รายการ`);
  }
  if (missingCustomerReferences.length > 0) {
    warnings.push(
      `พบใบงาน ${missingCustomerReferences.length} ใบที่อ้างอิง customerId ซึ่งไม่พบในรายชื่อลูกค้า`
    );
  }

  if (quarantineCount > 0) {
    warnings.push(`ไฟล์สำรองนี้มีข้อมูลดิบที่กักกัน (Quarantine) แนบมาด้วย ${quarantineCount} รายการ`);
  }

  if (isPlainRecord(parsed.rawStorageErrors)) {
    const rawErr = parsed.rawStorageErrors;
    if (typeof rawErr.customersReadError === 'string') {
      errors.push(`ไม่สามารถอ่านคีย์ customers จาก localStorage: ${rawErr.customersReadError}`);
    }
    if (typeof rawErr.jobsReadError === 'string') {
      errors.push(`ไม่สามารถอ่านคีย์ jobs จาก localStorage: ${rawErr.jobsReadError}`);
    }
    if (typeof rawErr.customersParseError === 'string') {
      errors.push(
        `ข้อมูล customers ดิบใน Browser อ่าน JSON ไม่ได้: ${rawErr.customersParseError}`
      );
    }
    if (typeof rawErr.jobsParseError === 'string') {
      errors.push(
        `ข้อมูล jobs ดิบใน Browser อ่าน JSON ไม่ได้: ${rawErr.jobsParseError}`
      );
    }
    if (typeof rawErr.quarantineParseError === 'string') {
      warnings.push(
        `ข้อมูล quarantine ดิบใน Browser อ่าน JSON ไม่ได้ (แนบข้อความดิบไว้ให้แล้ว): ${rawErr.quarantineParseError}`
      );
    }
  }

  return {
    isValidJson: true,
    isValidStructure: Array.isArray(parsed.customers) && Array.isArray(parsed.jobs),
    errors,
    warnings,
    backupFormatVersion,
    exportedAt,
    appVersion,
    customerCount: customers.length,
    jobCount: jobs.length,
    acUnitCount: countAcUnits(customers),
    quarantineCount,
    duplicateCustomerIds,
    duplicateJobIds,
    missingCustomerIdsCount,
    missingJobIdsCount,
    missingCustomerReferences,
    unlinkedJobCount,
  };
}

export function validateBackupJsonText(jsonText: string): BackupValidationReport {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    return validateBackupData(parsed);
  } catch (err) {
    return {
      isValidJson: false,
      isValidStructure: false,
      errors: [
        `ไฟล์ไม่ใช่ JSON ที่ถูกต้อง: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
      ],
      warnings: [],
      backupFormatVersion: null,
      exportedAt: null,
      appVersion: null,
      customerCount: 0,
      jobCount: 0,
      acUnitCount: 0,
      quarantineCount: 0,
      duplicateCustomerIds: [],
      duplicateJobIds: [],
      missingCustomerIdsCount: 0,
      missingJobIdsCount: 0,
      missingCustomerReferences: [],
      unlinkedJobCount: 0,
    };
  }
}

/**
 * Strictly READ-ONLY snapshot of current localStorage records + Quarantine.
 * - Reads each key in its own try/catch so one failed key never breaks the rest
 * - Does NOT call loadAppData(), saveCustomers(), or saveJobs()
 * - Does NOT regenerate IDs, normalize, rewrite, or strip unknown fields
 * - Does NOT seed sample data or modify localStorage
 */
export function readCurrentBackupSnapshot(
  inMemoryQuarantine?: QuarantineRecord[]
): CurrentBackupSnapshot {
  const now = new Date();
  const fileName = generateBackupFileName(now);

  const { storage, error: storageAccessErr } = getStorageSafe();

  let rawCustomers: string | null = null;
  let rawJobs: string | null = null;
  let initializedFlag: string | null = null;
  let rawQuarantine: string | null = null;

  const rawStorageErrors: NonNullable<ServiceFlowBackupPayload['rawStorageErrors']> = {};
  let storageReadError: string | null = storageAccessErr || null;

  if (storage) {
    try {
      rawCustomers = storage.getItem(STORAGE_KEYS.CUSTOMERS);
    } catch (err) {
      rawStorageErrors.customersReadError =
        err instanceof Error ? err.message : 'ไม่สามารถอ่าน customers จาก localStorage ได้';
      storageReadError = storageReadError || rawStorageErrors.customersReadError;
    }

    try {
      rawJobs = storage.getItem(STORAGE_KEYS.JOBS);
    } catch (err) {
      rawStorageErrors.jobsReadError =
        err instanceof Error ? err.message : 'ไม่สามารถอ่าน jobs จาก localStorage ได้';
      storageReadError = storageReadError || rawStorageErrors.jobsReadError;
    }

    try {
      initializedFlag = storage.getItem(STORAGE_KEYS.INITIALIZED);
    } catch (err) {
      rawStorageErrors.initializedReadError =
        err instanceof Error ? err.message : 'ไม่สามารถอ่าน initialized flag ได้';
    }

    try {
      rawQuarantine = storage.getItem(STORAGE_KEYS.QUARANTINE);
    } catch (err) {
      rawStorageErrors.quarantineReadError =
        err instanceof Error ? err.message : 'ไม่สามารถอ่าน quarantine จาก localStorage ได้';
    }
  } else if (storageAccessErr) {
    rawStorageErrors.customersReadError = storageAccessErr;
    rawStorageErrors.jobsReadError = storageAccessErr;
  }

  let customers: unknown[] = [];
  if (rawCustomers !== null && rawCustomers !== '') {
    try {
      const parsedC: unknown = JSON.parse(rawCustomers);
      if (Array.isArray(parsedC)) {
        customers = parsedC;
      } else {
        rawStorageErrors.customersParseError = 'ข้อมูล customers ใน localStorage ไม่ใช่ Array';
        rawStorageErrors.rawCustomers = rawCustomers;
      }
    } catch (err) {
      rawStorageErrors.customersParseError =
        err instanceof Error ? err.message : 'JSON parse error';
      rawStorageErrors.rawCustomers = rawCustomers;
    }
  }

  let jobs: unknown[] = [];
  if (rawJobs !== null && rawJobs !== '') {
    try {
      const parsedJ: unknown = JSON.parse(rawJobs);
      if (Array.isArray(parsedJ)) {
        jobs = parsedJ;
      } else {
        rawStorageErrors.jobsParseError = 'ข้อมูล jobs ใน localStorage ไม่ใช่ Array';
        rawStorageErrors.rawJobs = rawJobs;
      }
    } catch (err) {
      rawStorageErrors.jobsParseError =
        err instanceof Error ? err.message : 'JSON parse error';
      rawStorageErrors.rawJobs = rawJobs;
    }
  }

  let quarantineRecords: unknown[] = [];
  let hasQuarantineData = false;
  let hasLocalStorageQuarantine = false;
  if (rawQuarantine !== null && rawQuarantine !== '') {
    hasQuarantineData = true;
    try {
      const parsedQ: unknown = JSON.parse(rawQuarantine);
      if (Array.isArray(parsedQ)) {
        quarantineRecords = parsedQ;
        if (parsedQ.length > 0) {
          hasLocalStorageQuarantine = true;
        }
      } else {
        rawStorageErrors.quarantineParseError = 'ข้อมูล quarantine ใน localStorage ไม่ใช่ Array';
        rawStorageErrors.rawQuarantine = rawQuarantine;
      }
    } catch (err) {
      rawStorageErrors.quarantineParseError =
        err instanceof Error ? err.message : 'JSON parse error';
      rawStorageErrors.rawQuarantine = rawQuarantine;
    }
  }

  let hasMemoryOnlyQuarantine = false;
  if (Array.isArray(inMemoryQuarantine) && inMemoryQuarantine.length > 0) {
    const merged = [...quarantineRecords];
    for (const memRec of inMemoryQuarantine) {
      if (!isPlainRecord(memRec)) continue;
      const alreadyIncluded = merged.some((existing) => {
        if (!isPlainRecord(existing)) return false;
        if (
          typeof existing.id === 'string' &&
          typeof memRec.id === 'string' &&
          existing.id === memRec.id
        ) {
          return true;
        }
        return (
          existing.sourceKey === memRec.sourceKey &&
          existing.rawOriginalValue === memRec.rawOriginalValue &&
          existing.errorType === memRec.errorType
        );
      });
      if (!alreadyIncluded) {
        merged.push(memRec);
        hasMemoryOnlyQuarantine = true;
      }
    }
    if (merged.length > 0) {
      quarantineRecords = merged;
      hasQuarantineData = true;
    }
  }

  const quarantineSource: ServiceFlowBackupPayload['quarantineSource'] =
    hasLocalStorageQuarantine && hasMemoryOnlyQuarantine
      ? 'localStorage_and_memory'
      : hasMemoryOnlyQuarantine
      ? 'memory'
      : hasLocalStorageQuarantine
      ? 'localStorage'
      : undefined;

  const jobStats = summarizeJobs(jobs);
  const payload: ServiceFlowBackupPayload = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    appName: APP_NAME,
    appVersion: APP_VERSION,
    source: 'localStorage',
    initializedFlag,
    hasQuarantineData,
    quarantineCount: quarantineRecords.length,
    ...(quarantineSource ? { quarantineSource } : {}),
    summary: {
      customerCount: customers.length,
      jobCount: jobs.length,
      acUnitCount: countAcUnits(customers),
      jobStatuses: jobStats.jobStatuses,
      linkedJobCount: jobStats.linkedJobCount,
      unlinkedJobCount: jobStats.unlinkedJobCount,
    },
    customers,
    jobs,
    ...(quarantineRecords.length > 0 ? { quarantineRecords } : {}),
    ...(Object.keys(rawStorageErrors).length > 0 ? { rawStorageErrors } : {}),
  };

  const jsonText = JSON.stringify(payload, null, 2);
  const validation = validateBackupJsonText(jsonText);

  return {
    fileName,
    jsonText,
    payload,
    validation,
    storageReadError,
  };
}

/**
 * Triggers a JSON file download compatible with Desktop browsers and iPhone Safari.
 * Delays revoking the object URL so iOS Safari completes reading the Blob.
 */
export function downloadBackupFile(
  jsonText: string,
  fileName: string
): { ok: boolean; error?: string } {
  try {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ไม่สามารถสร้างไฟล์ดาวน์โหลดได้',
    };
  }
}

export function canShareBackupFile(fileName: string): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return false;
    }
    if (typeof navigator.canShare !== 'function' || typeof File === 'undefined') {
      return false;
    }
    const probe = new File(['{}'], fileName, { type: 'application/json' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareBackupFile(
  jsonText: string,
  fileName: string
): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> {
  try {
    const file = new File([jsonText], fileName, {
      type: 'application/json;charset=utf-8',
    });
    await navigator.share({
      title: 'ServiceFlow AI Backup (JSON)',
      files: [file],
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ไม่สามารถแชร์ไฟล์ผ่านเบราว์เซอร์ได้',
    };
  }
}
