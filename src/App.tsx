import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Download, ShieldAlert, X } from 'lucide-react';
import { AIJobCreatorView } from './components/AIJobCreatorView';
import { AppShell } from './components/AppShell';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CustomersView } from './components/CustomersView';
import { DashboardView } from './components/DashboardView';
import { FollowUpsView } from './components/FollowUpsView';
import { JobDetailModal } from './components/JobDetailModal';
import { JobsView } from './components/JobsView';
import { ReviewJobView } from './components/ReviewJobView';
import {
  AppTab,
  Customer,
  FollowUpReason,
  Job,
  JobStatus,
  ParsedLineResult,
} from './types/serviceflow';
import { fetchAIStatus } from './utils/aiClient';
import { getTodayISO, UNSPECIFIED_TEXT } from './utils/constants';
import {
  clearAllStoredData,
  generateId,
  generateJobCode,
  loadAppData,
  LoadAppDataResult,
  QuarantineRecord,
  resetToSampleData,
  saveCustomers,
  SaveResult,
  saveJobs,
  StorageLoadStatus,
} from './utils/storage';

type ConfirmState =
  | { type: 'delete-job'; job: Job }
  | { type: 'delete-customer'; customer: Customer }
  | { type: 'reset-sample' }
  | { type: 'clear-all' }
  | null;

interface WriteErrorState {
  customersError?: string;
  jobsError?: string;
  partialSuccessNote?: string;
}

export default function App() {
  const [initialLoad] = useState<LoadAppDataResult>(() => loadAppData());
  const [customers, setCustomers] = useState<Customer[]>(initialLoad.customers);
  const [jobs, setJobs] = useState<Job[]>(initialLoad.jobs);

  const [storageLoadStatus, setStorageLoadStatus] = useState<StorageLoadStatus>(
    initialLoad.status
  );
  const [isStorageReadyForAutoSave, setIsStorageReadyForAutoSave] = useState<boolean>(
    initialLoad.isStorageReadyForAutoSave
  );
  const [storageError, setStorageError] = useState<{
    errorDetails: string[];
    affectedDataTypes: ('customers' | 'jobs')[];
    quarantineSaved: boolean;
    quarantineSaveError?: string;
    quarantineCount: number;
  } | null>(
    initialLoad.status === 'corrupt' || initialLoad.status === 'storage_error'
      ? {
          errorDetails: initialLoad.errorDetails,
          affectedDataTypes: initialLoad.affectedDataTypes,
          quarantineSaved: initialLoad.quarantineSaved,
          quarantineSaveError: initialLoad.quarantineSaveError,
          quarantineCount: initialLoad.quarantineCount,
        }
      : null
  );
  const [storageWarnings, setStorageWarnings] = useState<string[]>(initialLoad.warnings);
  const [inMemoryQuarantine, setInMemoryQuarantine] = useState<QuarantineRecord[]>(
    initialLoad.inMemoryQuarantine
  );
  const [writeError, setWriteError] = useState<WriteErrorState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [aiConfigured, setAiConfigured] = useState(false);

  // AI Creator -> Review Job workflow state
  const [aiInitialText, setAiInitialText] = useState('');
  const [pendingReviewResult, setPendingReviewResult] = useState<ParsedLineResult | null>(null);

  // Jobs filter & modal state
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatus | 'all'>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [newManualJobModal, setNewManualJobModal] = useState<{
    open: boolean;
    preselectedCustomerId: string | null;
  }>({ open: false, preselectedCustomerId: null });

  // Customers detail state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Confirm Dialog & Toast
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Track mount and last-persisted snapshots to avoid initial mount overwrites and race conditions
  const hasMountedCustomersRef = useRef(false);
  const hasMountedJobsRef = useRef(false);
  const lastPersistedCustomersRef = useRef<Customer[]>(initialLoad.customers);
  const lastPersistedJobsRef = useRef<Job[]>(initialLoad.jobs);

  const isRecoveryMode =
    storageLoadStatus === 'corrupt' ||
    storageLoadStatus === 'storage_error' ||
    !isStorageReadyForAutoSave;

  useEffect(() => {
    fetchAIStatus().then((status) => {
      setAiConfigured(status.configured);
    });
  }, []);

  const applySaveResults = (cRes: SaveResult | null, jRes: SaveResult | null) => {
    const cFailed = cRes !== null && !cRes.ok;
    const jFailed = jRes !== null && !jRes.ok;

    if (!cFailed && !jFailed) {
      setWriteError((prev) => {
        if (!prev) return null;
        const next: WriteErrorState = { ...prev };
        if (cRes?.ok) delete next.customersError;
        if (jRes?.ok) delete next.jobsError;
        if (!next.customersError && !next.jobsError) return null;
        return next;
      });
      return true;
    }

    let partialSuccessNote: string | undefined;
    if (cRes?.ok && jFailed) {
      partialSuccessNote = 'รายชื่อลูกค้าถูกบันทึกแล้ว แต่ข้อมูลใบงานยังไม่ได้บันทึก';
    } else if (cFailed && jRes?.ok) {
      partialSuccessNote = 'ข้อมูลใบงานถูกบันทึกแล้ว แต่รายชื่อลูกค้ายังไม่ได้บันทึก';
    }

    setWriteError((prev) => ({
      customersError: cFailed ? cRes?.error : cRes?.ok ? undefined : prev?.customersError,
      jobsError: jFailed ? jRes?.error : jRes?.ok ? undefined : prev?.jobsError,
      partialSuccessNote,
    }));
    return false;
  };

  // Guarded Auto-Save Effects: NEVER run on initial mount and NEVER run in corrupt/storage_error states
  useEffect(() => {
    if (!hasMountedCustomersRef.current) {
      hasMountedCustomersRef.current = true;
      return;
    }
    if (
      !isStorageReadyForAutoSave ||
      storageLoadStatus === 'corrupt' ||
      storageLoadStatus === 'storage_error'
    ) {
      return;
    }
    if (customers === lastPersistedCustomersRef.current) {
      return;
    }

    const res = saveCustomers(customers);
    if (res.ok) {
      lastPersistedCustomersRef.current = customers;
    }
    applySaveResults(res, null);
  }, [customers, isStorageReadyForAutoSave, storageLoadStatus]);

  useEffect(() => {
    if (!hasMountedJobsRef.current) {
      hasMountedJobsRef.current = true;
      return;
    }
    if (
      !isStorageReadyForAutoSave ||
      storageLoadStatus === 'corrupt' ||
      storageLoadStatus === 'storage_error'
    ) {
      return;
    }
    if (jobs === lastPersistedJobsRef.current) {
      return;
    }

    const res = saveJobs(jobs);
    if (res.ok) {
      lastPersistedJobsRef.current = jobs;
    }
    applySaveResults(null, res);
  }, [jobs, isStorageReadyForAutoSave, storageLoadStatus]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  /**
   * Unified synchronous persistence helper that checks safety status first,
   * writes only modified datasets, updates refs before React re-renders effects,
   * and returns exact per-dataset SaveResult truth.
   */
  const persistEntities = (opts: {
    nextCustomers?: Customer[];
    nextJobs?: Job[];
  }): { allOk: boolean; blockedByRecovery: boolean } => {
    if (isRecoveryMode) {
      showToast('อยู่ในโหมดกู้คืนข้อมูล — ระงับการบันทึกอัตโนมัติ กรุณา Export Backup (JSON) ก่อน');
      setSettingsOpen(true);
      return { allOk: false, blockedByRecovery: true };
    }

    let cRes: SaveResult | null = null;
    let jRes: SaveResult | null = null;

    if (opts.nextCustomers !== undefined) {
      cRes = saveCustomers(opts.nextCustomers);
      if (cRes.ok) {
        lastPersistedCustomersRef.current = opts.nextCustomers;
      }
      setCustomers(opts.nextCustomers);
    }

    if (opts.nextJobs !== undefined) {
      jRes = saveJobs(opts.nextJobs);
      if (jRes.ok) {
        lastPersistedJobsRef.current = opts.nextJobs;
      }
      setJobs(opts.nextJobs);
    }

    const allOk = applySaveResults(cRes, jRes);
    return { allOk, blockedByRecovery: false };
  };

  const pendingFollowUpCount = jobs.filter(
    (j) =>
      j.status !== 'completed' &&
      j.status !== 'cancelled' &&
      (Boolean(j.followUp?.required) ||
        j.status === 'needs_info' ||
        j.status === 'pending_confirmation') &&
      !j.followUp?.completed
  ).length;

  const activeJobCount = jobs.filter(
    (j) => j.status !== 'completed' && j.status !== 'cancelled'
  ).length;

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab !== 'ai-creator') {
      setPendingReviewResult(null);
    }
    if (tab !== 'customers') {
      setSelectedCustomerId(null);
    }
  };

  // Save reviewed job from AI Creator
  const handleSaveReviewedJob = (draft: {
    customerId: string | null;
    createCustomerRecord: boolean;
    customerName: string;
    phone: string;
    jobType: string;
    symptom: string;
    brand: string;
    btu: string;
    preferredDate: string;
    preferredDateConfirmed: boolean;
    preferredTime: string;
    area: string;
    address: string;
    status: JobStatus;
    technicianNotes: string;
    rawLineMessage: string;
    aiModeUsed: 'gemini' | 'demo';
    followUpRequired: boolean;
    followUpReason: FollowUpReason | '';
    followUpDueDate: string;
    followUpNote: string;
  }) => {
    if (isRecoveryMode) {
      showToast('อยู่ในโหมดกู้คืนข้อมูล — กรุณา Export Backup (JSON) ก่อนสร้างใบงานใหม่');
      return;
    }

    const nowIso = new Date().toISOString();
    let finalCustomerId = draft.customerId;
    let nextCustomers: Customer[] | undefined;

    if (!finalCustomerId && draft.createCustomerRecord) {
      const newCustomer: Customer = {
        id: generateId('cust'),
        name: draft.customerName || UNSPECIFIED_TEXT,
        phone: draft.phone,
        area: draft.area,
        address: draft.address,
        acUnits:
          draft.brand || draft.btu
            ? [
                {
                  id: generateId('ac'),
                  brand: draft.brand || UNSPECIFIED_TEXT,
                  btu: draft.btu || UNSPECIFIED_TEXT,
                  locationInHome: 'ตามใบงานล่าสุด',
                },
              ]
            : [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextCustomers = [newCustomer, ...customers];
      finalCustomerId = newCustomer.id;
    } else if (finalCustomerId) {
      nextCustomers = customers.map((c) => {
        if (c.id !== finalCustomerId) return c;
        return {
          ...c,
          phone: c.phone || draft.phone,
          area: c.area || draft.area,
          address: c.address || draft.address,
          updatedAt: nowIso,
        };
      });
    }

    const customerPool = nextCustomers ?? customers;
    const linkedMaster = finalCustomerId
      ? customerPool.find((c) => c.id === finalCustomerId) || null
      : null;

    const newJobCode = generateJobCode(jobs);
    const newJob: Job = {
      id: generateId('job'),
      jobCode: newJobCode,
      customerId: finalCustomerId,
      customerName: linkedMaster?.name || draft.customerName || UNSPECIFIED_TEXT,
      phone: linkedMaster?.phone || draft.phone,
      jobType: draft.jobType,
      symptom: draft.symptom,
      brand: draft.brand,
      btu: draft.btu,
      preferredDate: draft.preferredDate,
      preferredDateConfirmed: draft.preferredDateConfirmed,
      preferredTime: draft.preferredTime,
      area: draft.area,
      address: draft.address,
      status: draft.status,
      rawLineMessage: draft.rawLineMessage,
      aiModeUsed: draft.aiModeUsed,
      technicianNotes: draft.technicianNotes,
      followUp: {
        required: draft.followUpRequired,
        reason: draft.followUpRequired ? draft.followUpReason : '',
        dueDate: draft.followUpRequired ? draft.followUpDueDate : '',
        note: draft.followUpRequired ? draft.followUpNote : '',
        completed: false,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextJobs = [newJob, ...jobs];
    const { allOk, blockedByRecovery } = persistEntities({ nextCustomers, nextJobs });
    if (blockedByRecovery) return;

    setPendingReviewResult(null);
    setAiInitialText('');
    setJobStatusFilter('all');
    setActiveTab('jobs');
    setSelectedJob(newJob);

    if (allOk) {
      showToast(`บันทึกใบงาน ${newJobCode} เรียบร้อยแล้ว`);
    }
  };

  // Save edited or manually created job
  const handleSaveJobModal = (
    payload: Omit<Job, 'id' | 'jobCode' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createCustomerRecord?: boolean;
    }
  ) => {
    if (isRecoveryMode) {
      showToast('อยู่ในโหมดกู้คืนข้อมูล — ไม่อนุญาตให้แก้ไขหรือสร้างใบงานจนกว่าจะปลอดภัย');
      return;
    }

    const nowIso = new Date().toISOString();
    const { createCustomerRecord, ...jobFields } = payload;

    let finalCustomerId = jobFields.customerId;
    let nextCustomers: Customer[] | undefined;

    if (!finalCustomerId && createCustomerRecord) {
      const newCustomer: Customer = {
        id: generateId('cust'),
        name: jobFields.customerName || UNSPECIFIED_TEXT,
        phone: jobFields.phone,
        area: jobFields.area,
        address: jobFields.address,
        acUnits:
          jobFields.brand || jobFields.btu
            ? [
                {
                  id: generateId('ac'),
                  brand: jobFields.brand || UNSPECIFIED_TEXT,
                  btu: jobFields.btu || UNSPECIFIED_TEXT,
                  locationInHome: 'ตามใบงานล่าสุด',
                },
              ]
            : [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextCustomers = [newCustomer, ...customers];
      finalCustomerId = newCustomer.id;
    }

    if (jobFields.id) {
      const nextJobs = jobs.map((j) => {
        if (j.id !== jobFields.id) return j;
        return {
          ...j,
          ...jobFields,
          customerId: finalCustomerId,
          customerName: jobFields.customerName || UNSPECIFIED_TEXT,
          updatedAt: nowIso,
        };
      });
      const updatedRecord = nextJobs.find((j) => j.id === jobFields.id) || null;
      const { allOk, blockedByRecovery } = persistEntities({ nextCustomers, nextJobs });
      if (blockedByRecovery) return;

      if (updatedRecord) {
        setSelectedJob(updatedRecord);
      }
      if (allOk) {
        showToast('บันทึกการแก้ไขใบงานแล้ว');
      }
    } else {
      const code = generateJobCode(jobs);
      const created: Job = {
        ...jobFields,
        customerId: finalCustomerId,
        id: generateId('job'),
        jobCode: code,
        customerName: jobFields.customerName || UNSPECIFIED_TEXT,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const nextJobs = [created, ...jobs];
      const { allOk, blockedByRecovery } = persistEntities({ nextCustomers, nextJobs });
      if (blockedByRecovery) return;

      setNewManualJobModal({ open: false, preselectedCustomerId: null });
      if (allOk) {
        showToast(`สร้างใบงาน ${code} เรียบร้อยแล้ว`);
      }
    }
  };

  const handleSaveCustomer = (
    payload: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    if (isRecoveryMode) {
      showToast('อยู่ในโหมดกู้คืนข้อมูล — ไม่อนุญาตให้แก้ไขรายชื่อลูกค้าจนกว่าจะปลอดภัย');
      return;
    }

    const nowIso = new Date().toISOString();
    if (payload.id) {
      const nextCustomers = customers.map((c) =>
        c.id === payload.id ? { ...c, ...payload, id: c.id, updatedAt: nowIso } : c
      );

      // Sync linked jobs so persisted job records and search always reflect the latest customer data
      const nextJobs = jobs.map((j) => {
        if (j.customerId !== payload.id) return j;
        return {
          ...j,
          customerName: payload.name || UNSPECIFIED_TEXT,
          phone: payload.phone,
          area: j.area || payload.area,
          address: j.address || payload.address,
          updatedAt: nowIso,
        };
      });

      const { allOk, blockedByRecovery } = persistEntities({ nextCustomers, nextJobs });
      if (blockedByRecovery) return;

      if (selectedJob && selectedJob.customerId === payload.id) {
        const refreshed = nextJobs.find((j) => j.id === selectedJob.id) || null;
        setSelectedJob(refreshed);
      }

      if (allOk) {
        showToast('อัปเดตข้อมูลลูกค้าแล้ว');
      }
    } else {
      const created: Customer = {
        ...payload,
        id: generateId('cust'),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const nextCustomers = [created, ...customers];
      const { allOk, blockedByRecovery } = persistEntities({ nextCustomers });
      if (blockedByRecovery) return;

      if (allOk) {
        showToast(`เพิ่มลูกค้า "${created.name}" แล้ว`);
      }
    }
  };

  const handleUpdateFollowUp = (
    jobId: string,
    patch: { dueDate?: string; reason?: FollowUpReason | ''; completed?: boolean }
  ) => {
    if (isRecoveryMode) {
      showToast('อยู่ในโหมดกู้คืนข้อมูล — ไม่อนุญาตให้แก้สถานะติดตามงาน');
      return;
    }

    const nowIso = new Date().toISOString();
    const today = getTodayISO();
    const nextJobs = jobs.map((j) => {
      if (j.id !== jobId) return j;
      const completed =
        typeof patch.completed === 'boolean' ? patch.completed : Boolean(j.followUp?.completed);
      return {
        ...j,
        followUp: {
          ...j.followUp,
          required: true,
          dueDate: patch.dueDate !== undefined ? patch.dueDate : j.followUp?.dueDate || '',
          reason: patch.reason !== undefined ? patch.reason : j.followUp?.reason || '',
          completed,
          completedAt: completed ? today : undefined,
        },
        updatedAt: nowIso,
      };
    });

    const { allOk, blockedByRecovery } = persistEntities({ nextJobs });
    if (blockedByRecovery) return;

    if (allOk) {
      if (patch.completed === true) {
        showToast('ทำเครื่องหมายว่าติดตามงานแล้ว');
      } else if (patch.completed === false) {
        showToast('ย้ายกลับไปรายการรอติดตามแล้ว');
      }
    }
  };

  const handleConfirmAction = () => {
    if (!confirmState) return;
    if (confirmState.type === 'delete-job') {
      if (isRecoveryMode) {
        setConfirmState(null);
        showToast('อยู่ในโหมดกู้คืนข้อมูล — ไม่อนุญาตให้ลบใบงาน');
        return;
      }
      const targetId = confirmState.job.id;
      const code = confirmState.job.jobCode;
      const nextJobs = jobs.filter((j) => j.id !== targetId);
      const { allOk } = persistEntities({ nextJobs });
      setSelectedJob(null);
      if (allOk) {
        showToast(`ลบใบงาน ${code} เรียบร้อยแล้ว`);
      }
    } else if (confirmState.type === 'delete-customer') {
      if (isRecoveryMode) {
        setConfirmState(null);
        showToast('อยู่ในโหมดกู้คืนข้อมูล — ไม่อนุญาตให้ลบรายชื่อลูกค้า');
        return;
      }
      const targetId = confirmState.customer.id;
      const name = confirmState.customer.name;
      const nextCustomers = customers.filter((c) => c.id !== targetId);
      // Unlink jobs safely without deleting historical jobs
      const nextJobs = jobs.map((j) =>
        j.customerId === targetId ? { ...j, customerId: null } : j
      );
      const { allOk } = persistEntities({ nextCustomers, nextJobs });
      setSelectedCustomerId(null);
      if (allOk) {
        showToast(`ลบรายชื่อลูกค้า "${name}" แล้ว`);
      }
    } else if (confirmState.type === 'reset-sample') {
      const reset = resetToSampleData();
      const ok = applySaveResults(reset.saveCustomersResult, reset.saveJobsResult);
      if (ok) {
        lastPersistedCustomersRef.current = reset.customers;
        lastPersistedJobsRef.current = reset.jobs;
        setCustomers(reset.customers);
        setJobs(reset.jobs);
        setStorageLoadStatus('ok');
        setIsStorageReadyForAutoSave(true);
        setStorageError(null);
        setStorageWarnings([]);
        setInMemoryQuarantine([]);
        setSelectedJob(null);
        setSelectedCustomerId(null);
        setPendingReviewResult(null);
        showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว');
      }
    } else if (confirmState.type === 'clear-all') {
      const empty = clearAllStoredData();
      const ok = applySaveResults(empty.saveCustomersResult, empty.saveJobsResult);
      if (ok) {
        lastPersistedCustomersRef.current = empty.customers;
        lastPersistedJobsRef.current = empty.jobs;
        setCustomers(empty.customers);
        setJobs(empty.jobs);
        setStorageLoadStatus('ok');
        setIsStorageReadyForAutoSave(true);
        setStorageError(null);
        setStorageWarnings([]);
        setInMemoryQuarantine([]);
        setSelectedJob(null);
        setSelectedCustomerId(null);
        setPendingReviewResult(null);
        showToast('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
      }
    }
    setConfirmState(null);
  };

  const formatAffectedTypes = (types: ('customers' | 'jobs')[]) => {
    const labels: string[] = [];
    if (types.includes('customers')) labels.push('รายชื่อลูกค้า (serviceflow_customers_v1)');
    if (types.includes('jobs')) labels.push('ข้อมูลใบงาน (serviceflow_jobs_v1)');
    return labels.length > 0 ? labels.join(', ') : 'พื้นที่จัดเก็บข้อมูลหลัก';
  };

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      pendingFollowUpCount={pendingFollowUpCount}
      activeJobCount={activeJobCount}
      aiConfigured={aiConfigured}
      onResetSampleData={() => setConfirmState({ type: 'reset-sample' })}
      onClearAllData={() => setConfirmState({ type: 'clear-all' })}
      toastMessage={toastMessage}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={setSettingsOpen}
      inMemoryQuarantine={inMemoryQuarantine}
      quarantineSaved={storageError?.quarantineSaved}
    >
      {/* Recovery Mode Banner (when storage read failed or JSON was corrupt) */}
      {isRecoveryMode && storageError && (
        <section
          role="alert"
          className="mb-5 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 sm:p-5 text-rose-950 space-y-3"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-rose-950">
                พบปัญหาในการอ่านข้อมูล — ระบบหยุดการบันทึกอัตโนมัติเพื่อป้องกันข้อมูลสูญหาย
              </h2>
              <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                ระบบตรวจพบความผิดปกติขณะโหลดข้อมูลจาก Browser จึงเข้าสู่โหมดอ่านอย่างเดียว (Recovery Mode)
                และ<strong>ระงับการบันทึก/แก้ไข/สร้างข้อมูลใหม่</strong> เพื่อไม่ให้เขียนทับข้อมูลเดิมของคุณ
              </p>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs bg-white/80 rounded-xl p-3 border border-rose-200">
                <div>
                  <dt className="text-rose-700 font-semibold">ประเภทปัญหา</dt>
                  <dd className="mt-0.5 font-mono-num">
                    {storageLoadStatus === 'corrupt'
                      ? 'ข้อมูล JSON เสียหายหรือโครงสร้างผิดปกติ (corrupt)'
                      : 'ไม่สามารถเข้าถึงพื้นที่จัดเก็บของ Browser (storage_error)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-rose-700 font-semibold">ส่วนข้อมูลที่ได้รับผลกระทบ</dt>
                  <dd className="mt-0.5">{formatAffectedTypes(storageError.affectedDataTypes)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-rose-700 font-semibold">สถานะการเก็บข้อมูลดิบ (Quarantine)</dt>
                  <dd className="mt-0.5">
                    {storageError.quarantineSaved
                      ? `บันทึกข้อมูลดิบเดิมไว้ใน serviceflow_quarantine_v1 แล้ว (${storageError.quarantineCount} รายการ) โดยไม่แก้ไขข้อมูลหลัก`
                      : `บันทึก Quarantine ลง localStorage ไม่สำเร็จ (${storageError.quarantineSaveError || 'ไม่สามารถเขียนลงเครื่องได้'}) — ระบบเก็บข้อมูลดิบไว้ในหน่วยความจำชั่วคราว (${inMemoryQuarantine.length} รายการ) เพื่อให้กด Export Backup (JSON) ได้ทันที`}
                  </dd>
                </div>
                {storageError.errorDetails.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-rose-700 font-semibold">รายละเอียดข้อผิดพลาด</dt>
                    <dd className="mt-0.5 space-y-0.5 text-rose-900">
                      {storageError.errorDetails.map((d, idx) => (
                        <p key={idx}>{d}</p>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Backup (JSON) ทันที</span>
                </button>
                <p className="text-xs text-rose-800">
                  คำแนะนำ: กรุณากด Export Backup (JSON) เพื่อเก็บข้อมูลดิบและส่วนที่ยังอ่านได้ไว้ก่อนดำเนินการใด ๆ
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Write Error Banner (when saveCustomers / saveJobs returns ok: false) */}
      {writeError && (
        <section
          role="alert"
          className="mb-5 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 sm:p-5 text-amber-950 space-y-2.5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-amber-950">
                บันทึกข้อมูลไม่สำเร็จ ข้อมูลล่าสุดอาจยังไม่ได้ถูกเก็บไว้ในอุปกรณ์ กรุณาส่งออก Backup ก่อนดำเนินการต่อ
              </h2>
              {writeError.partialSuccessNote && (
                <p className="text-xs font-semibold text-amber-900">
                  สถานะการบันทึกบางส่วน: {writeError.partialSuccessNote}
                </p>
              )}
              <ul className="text-xs text-amber-900 space-y-0.5 list-disc pl-4">
                {writeError.customersError && (
                  <li>
                    <strong>รายชื่อลูกค้า:</strong> {writeError.customersError}
                  </li>
                )}
                {writeError.jobsError && (
                  <li>
                    <strong>ข้อมูลใบงาน:</strong> {writeError.jobsError}
                  </li>
                )}
              </ul>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0F2544] hover:bg-[#163663] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>เปิด Backup &amp; Data Management</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Non-blocking Storage Warnings (e.g., restored initialized flag or duplicate ID warning) */}
      {storageWarnings.length > 0 && !isRecoveryMode && (
        <div
          role="status"
          className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">แจ้งเตือนการตรวจสอบข้อมูลตอนเปิดแอป:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {storageWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStorageWarnings([])}
            aria-label="ปิดข้อความแจ้งเตือน"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-amber-700 hover:text-amber-950 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <DashboardView
          jobs={jobs}
          customers={customers}
          onNavigateTab={handleSelectTab}
          onFilterJobsByStatus={(st) => {
            setJobStatusFilter(st);
            setActiveTab('jobs');
          }}
          onSelectJob={(job) => setSelectedJob(job)}
          onOpenNewManualJob={() => {
            if (isRecoveryMode) {
              showToast('อยู่ในโหมดกู้คืนข้อมูล — กรุณา Export Backup (JSON) ก่อนสร้างใบงาน');
              setSettingsOpen(true);
              return;
            }
            setNewManualJobModal({ open: true, preselectedCustomerId: null });
          }}
        />
      )}

      {activeTab === 'ai-creator' && !pendingReviewResult && (
        <AIJobCreatorView
          aiConfigured={aiConfigured}
          initialText={aiInitialText}
          onParsed={(result) => setPendingReviewResult(result)}
        />
      )}

      {activeTab === 'ai-creator' && pendingReviewResult && (
        <ReviewJobView
          parsedResult={pendingReviewResult}
          customers={customers}
          onSaveJob={handleSaveReviewedJob}
          onBackToEditText={(rawText) => {
            setAiInitialText(rawText);
            setPendingReviewResult(null);
          }}
          onCancel={() => {
            setPendingReviewResult(null);
            setAiInitialText('');
            setActiveTab('dashboard');
          }}
        />
      )}

      {activeTab === 'jobs' && (
        <JobsView
          jobs={jobs}
          customers={customers}
          statusFilter={jobStatusFilter}
          onStatusFilterChange={setJobStatusFilter}
          onSelectJob={(job) => setSelectedJob(job)}
          onOpenAICreator={() => handleSelectTab('ai-creator')}
          onOpenNewManualJob={() => {
            if (isRecoveryMode) {
              showToast('อยู่ในโหมดกู้คืนข้อมูล — กรุณา Export Backup (JSON) ก่อนสร้างใบงาน');
              setSettingsOpen(true);
              return;
            }
            setNewManualJobModal({ open: true, preselectedCustomerId: null });
          }}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersView
          customers={customers}
          jobs={jobs}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomerId={setSelectedCustomerId}
          onSaveCustomer={handleSaveCustomer}
          onDeleteCustomerRequest={(cust) => {
            if (isRecoveryMode) {
              showToast('อยู่ในโหมดกู้คืนข้อมูล — ไม่อนุญาตให้ลบรายชื่อลูกค้า');
              return;
            }
            setConfirmState({ type: 'delete-customer', customer: cust });
          }}
          onSelectJob={(job) => setSelectedJob(job)}
          onCreateJobForCustomer={(custId) => {
            if (isRecoveryMode) {
              showToast('อยู่ในโหมดกู้คืนข้อมูล — กรุณา Export Backup (JSON) ก่อนสร้างใบงาน');
              setSettingsOpen(true);
              return;
            }
            setNewManualJobModal({ open: true, preselectedCustomerId: custId });
          }}
        />
      )}

      {activeTab === 'followups' && (
        <FollowUpsView
          jobs={jobs}
          customers={customers}
          onSelectJob={(job) => setSelectedJob(job)}
          onUpdateFollowUp={handleUpdateFollowUp}
        />
      )}

      {/* View / Edit Existing Job Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          customers={customers}
          onClose={() => setSelectedJob(null)}
          onSave={handleSaveJobModal}
          onDeleteRequest={(job) => {
            if (isRecoveryMode) {
              showToast('อยู่ในโหมดกู้คืนข้อมูล — ไม่อนุญาตให้ลบใบงาน');
              return;
            }
            setConfirmState({ type: 'delete-job', job });
          }}
          onOpenCustomer={(custId) => {
            setSelectedCustomerId(custId);
            setActiveTab('customers');
          }}
        />
      )}

      {/* Create New Manual Job Modal */}
      {newManualJobModal.open && !isRecoveryMode && (
        <JobDetailModal
          job={null}
          isNewManual
          preselectedCustomerId={newManualJobModal.preselectedCustomerId}
          customers={customers}
          onClose={() =>
            setNewManualJobModal({ open: false, preselectedCustomerId: null })
          }
          onSave={handleSaveJobModal}
          onDeleteRequest={() => {}}
          onOpenCustomer={() => {}}
        />
      )}

      {/* Accessible Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState !== null}
        title={
          confirmState?.type === 'delete-job'
            ? `ลบใบงาน ${confirmState.job.jobCode}?`
            : confirmState?.type === 'delete-customer'
            ? `ลบรายชื่อลูกค้า "${confirmState.customer.name}"?`
            : confirmState?.type === 'reset-sample'
            ? 'รีเซ็ตข้อมูลเป็นชุดตัวอย่างเริ่มต้น?'
            : 'ล้างข้อมูลใบงานและลูกค้าทั้งหมด?'
        }
        description={
          confirmState?.type === 'delete-job'
            ? 'เมื่อลบแล้วจะไม่สามารถกู้คืนใบงานนี้ได้'
            : confirmState?.type === 'delete-customer'
            ? 'รายชื่อลูกค้านี้จะถูกลบออก (ใบงานเดิมจะยังคงอยู่แต่จะไม่เชื่อมโยงกับรายชื่อนี้)'
            : confirmState?.type === 'reset-sample'
            ? 'ข้อมูลที่คุณสร้างไว้จะถูกแทนที่ด้วยชุดข้อมูลตัวอย่างเริ่มต้น'
            : 'ข้อมูลใบงานและรายชื่อลูกค้าทั้งหมดใน Browser จะถูกลบออก'
        }
        confirmLabel={
          confirmState?.type === 'reset-sample' ? 'รีเซ็ตข้อมูลตัวอย่าง' : 'ยืนยันการลบ'
        }
        destructive={confirmState?.type !== 'reset-sample'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
      />
    </AppShell>
  );
}
