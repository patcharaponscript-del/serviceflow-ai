import { createInitialSampleData } from '../data/sampleData';
import { Customer, Job } from '../types/serviceflow';

export const STORAGE_KEYS = {
  CUSTOMERS: 'serviceflow_customers_v1',
  JOBS: 'serviceflow_jobs_v1',
  INITIALIZED: 'serviceflow_initialized_v1',
  QUARANTINE: 'serviceflow_quarantine_v1',
} as const;

export type StorageLoadStatus = 'ok' | 'empty_first_run' | 'corrupt' | 'storage_error';

export type QuarantineErrorType =
  | 'json_parse_error'
  | 'invalid_type'
  | 'invalid_records'
  | 'duplicate_id_conflict'
  | 'storage_access_error';

export interface QuarantineRecord {
  id: string;
  timestamp: string;
  sourceKey: string;
  rawOriginalValue: string;
  errorMessage: string;
  errorType: QuarantineErrorType;
  affectedDataType: 'customers' | 'jobs' | 'customers_and_jobs';
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  errorName?: string;
  quotaExceeded?: boolean;
  securityError?: boolean;
  storageUnavailable?: boolean;
}

export interface LoadAppDataResult {
  status: StorageLoadStatus;
  customers: Customer[];
  jobs: Job[];
  errorDetails: string[];
  quarantineSaved: boolean;
  quarantineSaveError?: string;
  quarantineCount: number;
  inMemoryQuarantine: QuarantineRecord[];
  affectedDataTypes: ('customers' | 'jobs')[];
  warnings: string[];
  isStorageReadyForAutoSave: boolean;
}

function getLocalStorageSafe(): { storage: Storage | null; error?: SaveResult } {
  try {
    const g = globalThis as { window?: { localStorage?: Storage }; localStorage?: Storage };
    const storage = g.window?.localStorage ?? g.localStorage ?? null;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      return {
        storage: null,
        error: {
          ok: false,
          error: 'Browser ไม่รองรับหรือปิดการใช้งาน localStorage',
          errorName: 'StorageUnavailable',
          storageUnavailable: true,
        },
      };
    }
    return { storage };
  } catch (err) {
    return {
      storage: null,
      error: classifyStorageError(err, 'ไม่สามารถเข้าถึง localStorage ได้'),
    };
  }
}

export function classifyStorageError(err: unknown, fallbackMsg: string): SaveResult {
  const errName = err instanceof Error ? err.name : 'UnknownError';
  const errMsg = err instanceof Error ? err.message : String(err ?? fallbackMsg);
  const legacyCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? Number((err as { code?: unknown }).code)
      : NaN;

  const isQuota =
    errName === 'QuotaExceededError' ||
    errName === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    legacyCode === 22 ||
    legacyCode === 1014 ||
    /quota/i.test(errMsg);

  const isSecurity =
    errName === 'SecurityError' ||
    /security|access is denied|permission/i.test(errMsg);

  return {
    ok: false,
    error: isQuota
      ? `พื้นที่จัดเก็บข้อมูลใน Browser เต็ม (${errMsg})`
      : isSecurity
      ? `Browser ปฏิเสธสิทธิ์การเข้าถึง localStorage (${errMsg})`
      : `${fallbackMsg}: ${errMsg}`,
    errorName: errName,
    quotaExceeded: isQuota,
    securityError: isSecurity,
    storageUnavailable: false,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function writeItemSafe(key: string, value: string): SaveResult {
  const { storage, error } = getLocalStorageSafe();
  if (!storage) {
    return error || { ok: false, error: 'localStorage ไม่พร้อมใช้งาน', storageUnavailable: true };
  }

  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (err) {
    return classifyStorageError(err, `บันทึกข้อมูลลง ${key} ไม่สำเร็จ`);
  }
}

function readItemSafe(
  key: string
): { ok: true; value: string | null } | { ok: false; error: SaveResult } {
  const { storage, error } = getLocalStorageSafe();
  if (!storage) {
    return {
      ok: false,
      error: error || { ok: false, error: 'localStorage ไม่พร้อมใช้งาน', storageUnavailable: true },
    };
  }

  try {
    return { ok: true, value: storage.getItem(key) };
  } catch (err) {
    return {
      ok: false,
      error: classifyStorageError(err, `อ่านข้อมูลจาก ${key} ไม่สำเร็จ`),
    };
  }
}

export function readQuarantineRecords(): {
  records: QuarantineRecord[];
  readError?: string;
} {
  const res = readItemSafe(STORAGE_KEYS.QUARANTINE);
  if (!res.ok) {
    return { records: [], readError: res.error.error };
  }
  if (!res.value) {
    return { records: [] };
  }

  try {
    const parsed: unknown = JSON.parse(res.value);
    if (Array.isArray(parsed)) {
      return { records: parsed.filter(isPlainRecord) as unknown as QuarantineRecord[] };
    }
    return {
      records: [
        {
          id: 'quarantine-legacy-non-array',
          timestamp: new Date().toISOString(),
          sourceKey: STORAGE_KEYS.QUARANTINE,
          rawOriginalValue: res.value,
          errorMessage: 'Existing quarantine payload was not an array',
          errorType: 'invalid_type',
          affectedDataType: 'customers_and_jobs',
        },
      ],
    };
  } catch (err) {
    return {
      records: [
        {
          id: 'quarantine-unparseable',
          timestamp: new Date().toISOString(),
          sourceKey: STORAGE_KEYS.QUARANTINE,
          rawOriginalValue: res.value,
          errorMessage: err instanceof Error ? err.message : 'Quarantine JSON parse error',
          errorType: 'json_parse_error',
          affectedDataType: 'customers_and_jobs',
        },
      ],
    };
  }
}

function appendQuarantineRecords(
  newRecords: Omit<QuarantineRecord, 'id' | 'timestamp'>[]
): {
  saved: boolean;
  error?: string;
  totalCount: number;
  inMemoryRecords: QuarantineRecord[];
} {
  const existing = readQuarantineRecords();
  if (newRecords.length === 0) {
    return {
      saved: !existing.readError,
      error: existing.readError,
      totalCount: existing.records.length,
      inMemoryRecords: existing.records,
    };
  }

  const nowIso = new Date().toISOString();
  const merged = [...existing.records];

  for (const rec of newRecords) {
    const alreadyExists = merged.some(
      (item) =>
        item.sourceKey === rec.sourceKey &&
        item.rawOriginalValue === rec.rawOriginalValue &&
        item.errorType === rec.errorType
    );
    if (!alreadyExists) {
      merged.push({
        ...rec,
        id: generateId('quarantine'),
        timestamp: nowIso,
      });
    }
  }

  if (existing.readError) {
    return {
      saved: false,
      error: existing.readError,
      totalCount: merged.length,
      inMemoryRecords: merged,
    };
  }

  const writeRes = writeItemSafe(STORAGE_KEYS.QUARANTINE, JSON.stringify(merged));
  if (!writeRes.ok) {
    return {
      saved: false,
      error: writeRes.error || 'ไม่สามารถบันทึกข้อมูลดิบลง Quarantine ได้',
      totalCount: merged.length,
      inMemoryRecords: merged,
    };
  }

  return { saved: true, totalCount: merged.length, inMemoryRecords: merged };
}

function normalizeCustomersSafely(rawArray: unknown[], rawOriginalValue: string): {
  customers: Customer[];
  warnings: string[];
  errorDetails: string[];
  quarantineNeeded: Omit<QuarantineRecord, 'id' | 'timestamp'>[];
  duplicateIdToCanonicalNote: string[];
  requiresRecoveryMode: boolean;
} {
  const warnings: string[] = [];
  const errorDetails: string[] = [];
  const quarantineNeeded: Omit<QuarantineRecord, 'id' | 'timestamp'>[] = [];
  const duplicateIdToCanonicalNote: string[] = [];

  const validRawObjects: Record<string, unknown>[] = [];
  let nonObjectCount = 0;

  for (const item of rawArray) {
    if (!isPlainRecord(item)) {
      nonObjectCount += 1;
      continue;
    }
    validRawObjects.push(item);
  }

  if (nonObjectCount > 0) {
    const msg = `พบข้อมูลลูกค้าที่ไม่ใช่ Object (เช่น null) จำนวน ${nonObjectCount} รายการ — ระบบกักกันข้อมูลต้นฉบับและระงับการบันทึกอัตโนมัติ`;
    warnings.push(msg);
    errorDetails.push(msg);
    quarantineNeeded.push({
      sourceKey: STORAGE_KEYS.CUSTOMERS,
      rawOriginalValue,
      errorMessage: msg,
      errorType: 'invalid_records',
      affectedDataType: 'customers',
    });
  }

  // First pass: preserve every existing unique ID as-is; detect duplicates without orphaning jobs
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const customers: Customer[] = validRawObjects.map((raw) => {
    const rawId = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : '';
    let finalId = rawId;

    if (!finalId) {
      finalId = generateId('cust');
      while (seenIds.has(finalId)) {
        finalId = generateId('cust');
      }
      warnings.push(
        `พบข้อมูลลูกค้า "${typeof raw.name === 'string' ? raw.name : 'ไม่ระบุชื่อ'}" ที่ไม่มี id จึงกำหนดรหัสชั่วคราว ${finalId}`
      );
    } else if (seenIds.has(finalId)) {
      duplicateIds.add(finalId);
      const originalDupId = finalId;
      finalId = generateId('cust');
      while (seenIds.has(finalId)) {
        finalId = generateId('cust');
      }
      duplicateIdToCanonicalNote.push(
        `พบรหัสลูกค้าซ้ำ (${originalDupId}): คงรายการแรกไว้ที่ ${originalDupId} และแยกรายการซ้ำเป็น ${finalId} โดยไม่เดาการย้ายใบงานอัตโนมัติ`
      );
    }

    seenIds.add(finalId);

    // Spread raw object to preserve ALL existing and unknown/custom fields
    return {
      ...(raw as unknown as Customer),
      id: finalId,
      name: typeof raw.name === 'string' ? raw.name : '',
      phone: typeof raw.phone === 'string' ? raw.phone : '',
      area: typeof raw.area === 'string' ? raw.area : '',
      address: typeof raw.address === 'string' ? raw.address : '',
      acUnits: Array.isArray(raw.acUnits) ? raw.acUnits : [],
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    };
  });

  if (duplicateIds.size > 0) {
    const msg = duplicateIdToCanonicalNote.join(' · ');
    warnings.push(msg);
    errorDetails.push(msg);
    quarantineNeeded.push({
      sourceKey: STORAGE_KEYS.CUSTOMERS,
      rawOriginalValue,
      errorMessage: msg,
      errorType: 'duplicate_id_conflict',
      affectedDataType: 'customers',
    });
  }

  return {
    customers,
    warnings,
    errorDetails,
    quarantineNeeded,
    duplicateIdToCanonicalNote,
    requiresRecoveryMode: nonObjectCount > 0 || duplicateIds.size > 0,
  };
}

function normalizeJobsSafely(rawArray: unknown[], rawOriginalValue: string): {
  jobs: Job[];
  warnings: string[];
  errorDetails: string[];
  quarantineNeeded: Omit<QuarantineRecord, 'id' | 'timestamp'>[];
  requiresRecoveryMode: boolean;
} {
  const warnings: string[] = [];
  const errorDetails: string[] = [];
  const quarantineNeeded: Omit<QuarantineRecord, 'id' | 'timestamp'>[] = [];
  const duplicateJobIds = new Set<string>();
  const duplicateJobNotes: string[] = [];
  const jobs: Job[] = [];
  const seenJobIds = new Set<string>();
  let nonObjectCount = 0;

  for (const raw of rawArray) {
    if (!isPlainRecord(raw)) {
      nonObjectCount += 1;
      continue;
    }

    const rawId = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : '';
    let finalId = rawId || generateId('job');
    if (seenJobIds.has(finalId)) {
      const dupId = finalId;
      duplicateJobIds.add(dupId);
      finalId = generateId('job');
      while (seenJobIds.has(finalId)) {
        finalId = generateId('job');
      }
      const note = `พบ id ใบงานซ้ำ (${dupId}): คงรายการแรกไว้ที่ ${dupId} และแยกรายการซ้ำเป็น ${finalId} ในหน่วยความจำโดยไม่เขียนทับข้อมูลดิบ`;
      warnings.push(note);
      duplicateJobNotes.push(note);
    }
    seenJobIds.add(finalId);

    const rawFollowUp = isPlainRecord(raw.followUp) ? raw.followUp : {};
    const customerId =
      typeof raw.customerId === 'string' && raw.customerId.trim().length > 0
        ? raw.customerId.trim()
        : null;

    // Spread raw object to preserve ALL existing and unknown/custom fields
    jobs.push({
      ...(raw as unknown as Job),
      id: finalId,
      jobCode: typeof raw.jobCode === 'string' ? raw.jobCode : 'SF-0000',
      customerId,
      customerName: typeof raw.customerName === 'string' ? raw.customerName : '',
      phone: typeof raw.phone === 'string' ? raw.phone : '',
      jobType: typeof raw.jobType === 'string' ? raw.jobType : 'อื่นๆ',
      symptom: typeof raw.symptom === 'string' ? raw.symptom : '',
      brand: typeof raw.brand === 'string' ? raw.brand : '',
      btu: typeof raw.btu === 'string' ? raw.btu : '',
      preferredDate: typeof raw.preferredDate === 'string' ? raw.preferredDate : '',
      preferredDateConfirmed: Boolean(raw.preferredDateConfirmed),
      preferredTime: typeof raw.preferredTime === 'string' ? raw.preferredTime : '',
      area: typeof raw.area === 'string' ? raw.area : '',
      address: typeof raw.address === 'string' ? raw.address : '',
      status:
        typeof raw.status === 'string' && raw.status
          ? (raw.status as Job['status'])
          : 'new',
      followUp: {
        ...(rawFollowUp as Partial<Job['followUp']>),
        required: Boolean(rawFollowUp.required),
        reason:
          typeof rawFollowUp.reason === 'string'
            ? (rawFollowUp.reason as Job['followUp']['reason'])
            : '',
        dueDate: typeof rawFollowUp.dueDate === 'string' ? rawFollowUp.dueDate : '',
        note: typeof rawFollowUp.note === 'string' ? rawFollowUp.note : undefined,
        completed: Boolean(rawFollowUp.completed),
        completedAt:
          typeof rawFollowUp.completedAt === 'string' ? rawFollowUp.completedAt : undefined,
      },
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    });
  }

  if (nonObjectCount > 0) {
    const msg = `พบข้อมูลใบงานที่ไม่ใช่ Object (เช่น null) จำนวน ${nonObjectCount} รายการ — ระบบกักกันข้อมูลต้นฉบับและระงับการบันทึกอัตโนมัติ`;
    warnings.push(msg);
    errorDetails.push(msg);
    quarantineNeeded.push({
      sourceKey: STORAGE_KEYS.JOBS,
      rawOriginalValue,
      errorMessage: msg,
      errorType: 'invalid_records',
      affectedDataType: 'jobs',
    });
  }

  if (duplicateJobIds.size > 0) {
    const msg = duplicateJobNotes.join(' · ');
    errorDetails.push(msg);
    quarantineNeeded.push({
      sourceKey: STORAGE_KEYS.JOBS,
      rawOriginalValue,
      errorMessage: msg,
      errorType: 'duplicate_id_conflict',
      affectedDataType: 'jobs',
    });
  }

  return {
    jobs,
    warnings,
    errorDetails,
    quarantineNeeded,
    requiresRecoveryMode: nonObjectCount > 0 || duplicateJobIds.size > 0,
  };
}

export function loadAppData(): LoadAppDataResult {
  const existingQuarantine = readQuarantineRecords();

  const initRead = readItemSafe(STORAGE_KEYS.INITIALIZED);
  const customersRead = readItemSafe(STORAGE_KEYS.CUSTOMERS);
  const jobsRead = readItemSafe(STORAGE_KEYS.JOBS);

  // If browser blocks localStorage access completely -> NEVER return sample data
  if (!initRead.ok || !customersRead.ok || !jobsRead.ok) {
    const errorDetails: string[] = [];
    const affectedDataTypes: ('customers' | 'jobs')[] = [];
    if (!initRead.ok && initRead.error.error) errorDetails.push(initRead.error.error);
    if (!customersRead.ok && customersRead.error.error) {
      errorDetails.push(customersRead.error.error);
      affectedDataTypes.push('customers');
    }
    if (!jobsRead.ok && jobsRead.error.error) {
      errorDetails.push(jobsRead.error.error);
      affectedDataTypes.push('jobs');
    }

    return {
      status: 'storage_error',
      customers: [],
      jobs: [],
      errorDetails,
      quarantineSaved: false,
      quarantineSaveError: 'ไม่สามารถเข้าถึง localStorage ของ Browser ได้',
      quarantineCount: existingQuarantine.records.length,
      inMemoryQuarantine: existingQuarantine.records,
      affectedDataTypes:
        affectedDataTypes.length > 0 ? affectedDataTypes : ['customers', 'jobs'],
      warnings: [],
      isStorageReadyForAutoSave: false,
    };
  }

  const initialized = initRead.value;
  const rawCustomers = customersRead.value;
  const rawJobs = jobsRead.value;

  const hasCustomerPayload = rawCustomers !== null && rawCustomers !== '';
  const hasJobPayload = rawJobs !== null && rawJobs !== '';

  // Seed Sample Data ONLY when ALL THREE keys are genuinely empty
  if (!initialized && !hasCustomerPayload && !hasJobPayload) {
    const sample = createInitialSampleData();
    const saveC = saveCustomers(sample.customers);
    const saveJ = saveJobs(sample.jobs);

    if (!saveC.ok || !saveJ.ok) {
      const errorDetails = [saveC.error, saveJ.error].filter(Boolean) as string[];
      return {
        status: 'storage_error',
        customers: [],
        jobs: [],
        errorDetails,
        quarantineSaved: false,
        quarantineCount: existingQuarantine.records.length,
        inMemoryQuarantine: existingQuarantine.records,
        affectedDataTypes: [
          ...(!saveC.ok ? (['customers'] as const) : []),
          ...(!saveJ.ok ? (['jobs'] as const) : []),
        ],
        warnings: [],
        isStorageReadyForAutoSave: false,
      };
    }

    return {
      status: 'empty_first_run',
      customers: sample.customers,
      jobs: sample.jobs,
      errorDetails: [],
      quarantineSaved: true,
      quarantineCount: existingQuarantine.records.length,
      inMemoryQuarantine: existingQuarantine.records,
      affectedDataTypes: [],
      warnings: [],
      isStorageReadyForAutoSave: true,
    };
  }

  const errorDetails: string[] = [];
  const warnings: string[] = [];
  const affectedDataTypes: ('customers' | 'jobs')[] = [];
  const pendingQuarantine: Omit<QuarantineRecord, 'id' | 'timestamp'>[] = [];

  if (!initialized && (hasCustomerPayload || hasJobPayload)) {
    warnings.push(
      'ไม่พบ flag เริ่มต้นระบบ (serviceflow_initialized_v1) แต่พบข้อมูลเดิมในเครื่อง จึงรักษาข้อมูลเดิมไว้โดยไม่เขียนข้อมูลตัวอย่างทับ'
    );
  }

  let customers: Customer[] = [];
  let customersCorrupt = false;
  let customersIntegrityIssue = false;
  if (hasCustomerPayload && rawCustomers !== null) {
    try {
      const parsedC: unknown = JSON.parse(rawCustomers);
      if (!Array.isArray(parsedC)) {
        customersCorrupt = true;
        const msg = 'ข้อมูลรายชื่อลูกค้าใน localStorage ไม่ใช่ Array (โครงสร้างผิดปกติ)';
        errorDetails.push(msg);
        affectedDataTypes.push('customers');
        pendingQuarantine.push({
          sourceKey: STORAGE_KEYS.CUSTOMERS,
          rawOriginalValue: rawCustomers,
          errorMessage: msg,
          errorType: 'invalid_type',
          affectedDataType: 'customers',
        });
      } else {
        const normalized = normalizeCustomersSafely(parsedC, rawCustomers);
        customers = normalized.customers;
        warnings.push(...normalized.warnings);
        errorDetails.push(...normalized.errorDetails);
        pendingQuarantine.push(...normalized.quarantineNeeded);
        if (normalized.requiresRecoveryMode) {
          customersIntegrityIssue = true;
          if (!affectedDataTypes.includes('customers')) {
            affectedDataTypes.push('customers');
          }
        }
      }
    } catch (err) {
      customersCorrupt = true;
      const msg = `อ่าน JSON รายชื่อลูกค้าไม่สำเร็จ: ${
        err instanceof Error ? err.message : 'JSON parse error'
      }`;
      errorDetails.push(msg);
      affectedDataTypes.push('customers');
      pendingQuarantine.push({
        sourceKey: STORAGE_KEYS.CUSTOMERS,
        rawOriginalValue: rawCustomers,
        errorMessage: msg,
        errorType: 'json_parse_error',
        affectedDataType: 'customers',
      });
    }
  }

  let jobs: Job[] = [];
  let jobsCorrupt = false;
  let jobsIntegrityIssue = false;
  if (hasJobPayload && rawJobs !== null) {
    try {
      const parsedJ: unknown = JSON.parse(rawJobs);
      if (!Array.isArray(parsedJ)) {
        jobsCorrupt = true;
        const msg = 'ข้อมูลใบงานใน localStorage ไม่ใช่ Array (โครงสร้างผิดปกติ)';
        errorDetails.push(msg);
        affectedDataTypes.push('jobs');
        pendingQuarantine.push({
          sourceKey: STORAGE_KEYS.JOBS,
          rawOriginalValue: rawJobs,
          errorMessage: msg,
          errorType: 'invalid_type',
          affectedDataType: 'jobs',
        });
      } else {
        const normalized = normalizeJobsSafely(parsedJ, rawJobs);
        jobs = normalized.jobs;
        warnings.push(...normalized.warnings);
        errorDetails.push(...normalized.errorDetails);
        pendingQuarantine.push(...normalized.quarantineNeeded);
        if (normalized.requiresRecoveryMode) {
          jobsIntegrityIssue = true;
          if (!affectedDataTypes.includes('jobs')) {
            affectedDataTypes.push('jobs');
          }
        }
      }
    } catch (err) {
      jobsCorrupt = true;
      const msg = `อ่าน JSON ใบงานไม่สำเร็จ: ${
        err instanceof Error ? err.message : 'JSON parse error'
      }`;
      errorDetails.push(msg);
      affectedDataTypes.push('jobs');
      pendingQuarantine.push({
        sourceKey: STORAGE_KEYS.JOBS,
        rawOriginalValue: rawJobs,
        errorMessage: msg,
        errorType: 'json_parse_error',
        affectedDataType: 'jobs',
      });
    }
  }

  let quarantineSaved = true;
  let quarantineSaveError: string | undefined;
  let quarantineCount = existingQuarantine.records.length;
  let inMemoryQuarantine: QuarantineRecord[] = existingQuarantine.records;

  if (pendingQuarantine.length > 0) {
    const qRes = appendQuarantineRecords(pendingQuarantine);
    quarantineSaved = qRes.saved;
    quarantineSaveError = qRes.error;
    quarantineCount = qRes.totalCount;
    inMemoryQuarantine = qRes.inMemoryRecords;
    if (!qRes.saved && qRes.error) {
      const qErrMsg = `ไม่สามารถบันทึกข้อมูลลง Quarantine ได้ (${qRes.error}) — ระบบเก็บข้อมูลดิบไว้ในหน่วยความจำชั่วคราวแล้ว กรุณา Export Backup (JSON) ทันที`;
      warnings.push(qErrMsg);
      errorDetails.push(qErrMsg);
    }
  }

  // Enter Recovery Mode (isStorageReadyForAutoSave: false) whenever ANY parse error,
  // null/malformed record, duplicate ID conflict, or quarantine write failure occurred
  if (
    customersCorrupt ||
    jobsCorrupt ||
    customersIntegrityIssue ||
    jobsIntegrityIssue ||
    (pendingQuarantine.length > 0 && !quarantineSaved)
  ) {
    return {
      status: 'corrupt',
      customers,
      jobs,
      errorDetails,
      quarantineSaved,
      quarantineSaveError,
      quarantineCount,
      inMemoryQuarantine,
      affectedDataTypes,
      warnings,
      isStorageReadyForAutoSave: false,
    };
  }

  // Restore missing initialized flag safely WITHOUT touching CUSTOMERS or JOBS payloads
  if (!initialized && (hasCustomerPayload || hasJobPayload)) {
    const initFlagRes = writeItemSafe(STORAGE_KEYS.INITIALIZED, 'true');
    if (!initFlagRes.ok) {
      warnings.push(
        `พบข้อมูลเดิมและอ่านได้ครบถ้วน แต่ตั้งค่า flag เริ่มต้นไม่สำเร็จ: ${initFlagRes.error}`
      );
    }
  }

  return {
    status: 'ok',
    customers,
    jobs,
    errorDetails: [],
    quarantineSaved,
    quarantineSaveError,
    quarantineCount,
    inMemoryQuarantine,
    affectedDataTypes: [],
    warnings,
    isStorageReadyForAutoSave: true,
  };
}

export function saveCustomers(customers: Customer[]): SaveResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(customers);
  } catch (err) {
    return {
      ok: false,
      error: `แปลงข้อมูลลูกค้าเป็น JSON ไม่สำเร็จ: ${
        err instanceof Error ? err.message : 'Serialize error'
      }`,
    };
  }

  const writeRes = writeItemSafe(STORAGE_KEYS.CUSTOMERS, serialized);
  if (!writeRes.ok) {
    return writeRes;
  }

  const initRes = writeItemSafe(STORAGE_KEYS.INITIALIZED, 'true');
  if (!initRes.ok) {
    return initRes;
  }

  return { ok: true };
}

export function saveJobs(jobs: Job[]): SaveResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(jobs);
  } catch (err) {
    return {
      ok: false,
      error: `แปลงข้อมูลใบงานเป็น JSON ไม่สำเร็จ: ${
        err instanceof Error ? err.message : 'Serialize error'
      }`,
    };
  }

  const writeRes = writeItemSafe(STORAGE_KEYS.JOBS, serialized);
  if (!writeRes.ok) {
    return writeRes;
  }

  const initRes = writeItemSafe(STORAGE_KEYS.INITIALIZED, 'true');
  if (!initRes.ok) {
    return initRes;
  }

  return { ok: true };
}

export function resetToSampleData(): {
  customers: Customer[];
  jobs: Job[];
  saveCustomersResult: SaveResult;
  saveJobsResult: SaveResult;
} {
  const sample = createInitialSampleData();
  const saveCustomersResult = saveCustomers(sample.customers);
  const saveJobsResult = saveJobs(sample.jobs);
  return {
    customers: sample.customers,
    jobs: sample.jobs,
    saveCustomersResult,
    saveJobsResult,
  };
}

export function clearAllStoredData(): {
  customers: Customer[];
  jobs: Job[];
  saveCustomersResult: SaveResult;
  saveJobsResult: SaveResult;
} {
  const saveCustomersResult = saveCustomers([]);
  const saveJobsResult = saveJobs([]);
  return {
    customers: [],
    jobs: [],
    saveCustomersResult,
    saveJobsResult,
  };
}

export function generateJobCode(existingJobs: Job[]): string {
  let maxNum = 1000;
  for (const job of existingJobs) {
    const m = typeof job.jobCode === 'string' ? job.jobCode.match(/SF-(\d+)/) : null;
    if (m) {
      const num = Number(m[1]);
      if (num > maxNum) maxNum = num;
    }
  }
  return `SF-${maxNum + 1}`;
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
