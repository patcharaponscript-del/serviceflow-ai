import React, { useMemo, useState } from 'react';
import {
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Customer, FollowUpReason, Job } from '../types/serviceflow';
import {
  displayOrUnspecified,
  FOLLOW_UP_REASON_OPTIONS,
  formatThaiDate,
  getTodayISO,
} from '../utils/constants';
import { resolveJobCustomer } from '../utils/customerMatcher';
import { StatusText } from './StatusText';

interface FollowUpsViewProps {
  jobs: Job[];
  customers: Customer[];
  onSelectJob: (job: Job) => void;
  onUpdateFollowUp: (
    jobId: string,
    patch: {
      dueDate?: string;
      reason?: FollowUpReason | '';
      completed?: boolean;
    }
  ) => void;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  jobs,
  customers,
  onSelectJob,
  onUpdateFollowUp,
}) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const today = getTodayISO();

  const { activeFollowUps, completedFollowUps } = useMemo(() => {
    const active: Job[] = [];
    const done: Job[] = [];

    for (const job of jobs) {
      if (job.status === 'cancelled') continue;
      const isCandidate =
        job.followUp.required ||
        job.status === 'needs_info' ||
        job.status === 'pending_confirmation';

      if (!isCandidate && !job.followUp.completed) continue;

      if (job.followUp.completed || job.status === 'completed') {
        if (job.followUp.completed) done.push(job);
      } else {
        active.push(job);
      }
    }

    active.sort((a, b) => {
      const da = a.followUp.dueDate || '9999-12-31';
      const db = b.followUp.dueDate || '9999-12-31';
      return da.localeCompare(db);
    });

    done.sort((a, b) =>
      (b.followUp.completedAt || b.updatedAt).localeCompare(
        a.followUp.completedAt || a.updatedAt
      )
    );

    return { activeFollowUps: active, completedFollowUps: done };
  }, [jobs]);

  const urgentJobs = activeFollowUps.filter(
    (j) => j.followUp.dueDate && j.followUp.dueDate <= today
  );
  const upcomingJobs = activeFollowUps.filter(
    (j) => j.followUp.dueDate && j.followUp.dueDate > today
  );
  const unscheduledJobs = activeFollowUps.filter((j) => !j.followUp.dueDate);

  const buildFollowUpLineMessage = (job: Job) => {
    const resolved = resolveJobCustomer(job, customers);
    const name =
      resolved.customerName && resolved.customerName !== 'ยังไม่ได้ระบุ'
        ? `คุณ${resolved.customerName.replace(/^คุณ/, '')}`
        : 'คุณลูกค้า';
    const reason = job.followUp.reason;
    if (reason === 'รอลูกค้าส่งที่อยู่' || !resolved.address) {
      return `สวัสดีครับ ${name} จากช่างแอร์นะครับ ขออนุญาตติดตามข้อมูลที่อยู่หน้างาน${
        resolved.area ? `แถว${resolved.area}` : ''
      } หรือส่งโลเคชั่นทาง LINE เพื่อลงคิวงาน ${job.jobCode} ครับ`;
    }
    if (reason === 'รอลูกค้ายืนยันวันนัด' || !job.preferredDateConfirmed) {
      return `สวัสดีครับ ${name} ขออนุญาตคอนเฟิร์มวันและเวลาเข้าบริการ${
        job.preferredDate ? ` (${job.preferredDate})` : ''
      } สำหรับงาน ${job.jobType} เพื่อล็อกคิวช่างให้ครับ`;
    }
    return `สวัสดีครับ ${name} ขออนุญาตติดตามงาน ${job.jobType} (${job.jobCode}) ไม่ทราบว่าสะดวกให้ช่างเข้าบริการวันไหนดีครับ`;
  };

  const handleCopyMessage = async (job: Job) => {
    try {
      await navigator.clipboard.writeText(buildFollowUpLineMessage(job));
      setCopiedJobId(job.id);
      setTimeout(() => setCopiedJobId(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const renderFollowUpCard = (job: Job, isUrgent: boolean) => {
    const resolved = resolveJobCustomer(job, customers);
    const reasonText =
      job.followUp.reason ||
      (job.status === 'needs_info'
        ? 'รอลูกค้าส่งที่อยู่'
        : job.status === 'pending_confirmation'
        ? 'รอลูกค้ายืนยันวันนัด'
        : 'รอติดต่อกลับ');

    return (
      <div
        key={job.id}
        className={`bg-white rounded-2xl border p-4 sm:p-5 space-y-3.5 ${
          isUrgent ? 'border-amber-300' : 'border-slate-200/90'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-[#0F2544]">
                {displayOrUnspecified(resolved.customerName)}
              </h3>
              <span className="text-xs font-mono-num text-slate-400">{job.jobCode}</span>
              <StatusText status={job.status} compact />
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              {job.jobType}
              {resolved.area ? ` · ${resolved.area}` : ''}
              {resolved.phone ? ` · ${resolved.phone}` : ''}
            </p>
            {job.followUp.note && (
              <p className="mt-1 text-xs text-slate-500">โน้ต: {job.followUp.note}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectJob(job)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-[#0F2544] hover:bg-slate-50 inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>ดูใบงาน</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Editable Follow-up Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs text-slate-500 mb-1">สาเหตุที่ติดตาม</label>
            <select
              value={reasonText}
              onChange={(e) =>
                onUpdateFollowUp(job.id, { reason: e.target.value as FollowUpReason })
              }
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-[#0F2544]"
            >
              {FOLLOW_UP_REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>กำหนดวันติดตาม</span>
            </label>
            <input
              type="date"
              value={job.followUp.dueDate || ''}
              onChange={(e) => onUpdateFollowUp(job.id, { dueDate: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-mono-num text-[#0F2544]"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleCopyMessage(job)}
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-medium text-[#0F2544] inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copiedJobId === job.id ? (
              <>
                <Check className="w-4 h-4 text-teal-600" />
                <span>คัดลอกข้อความทัก LINE แล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>คัดลอกข้อความติดตามทาง LINE</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onUpdateFollowUp(job.id, { completed: true })}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ทำเครื่องหมายว่าติดตามแล้ว</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F2544]">
            แจ้งเตือนและติดตามงาน
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            รวมงานที่รอที่อยู่ รอยืนยันวันนัด หรือรอติดต่อกลับ เพื่อไม่ให้หลุดคิวลูกค้า
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowCompleted(false)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              !showCompleted ? 'bg-white text-[#0F2544] shadow-xs' : 'text-slate-600'
            }`}
          >
            รอติดตาม ({activeFollowUps.length})
          </button>
          <button
            type="button"
            onClick={() => setShowCompleted(true)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              showCompleted ? 'bg-white text-[#0F2544] shadow-xs' : 'text-slate-600'
            }`}
          >
            ติดตามแล้ว ({completedFollowUps.length})
          </button>
        </div>
      </div>

      {!showCompleted ? (
        activeFollowUps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center">
            <BellRing className="w-8 h-8 text-teal-600 mx-auto" />
            <p className="mt-3 text-sm font-semibold text-[#0F2544]">
              ไม่มีงานค้างติดตามในขณะนี้
            </p>
            <p className="mt-1 text-xs text-slate-500">
              เมื่อมีใบงานที่ข้อมูลไม่ครบหรือตั้งวันติดตามไว้ รายการจะมาแสดงที่นี่
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {urgentJobs.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-amber-800">
                  ต้องติดตามวันนี้ / เกินกำหนด ({urgentJobs.length})
                </h2>
                <div className="space-y-3">
                  {urgentJobs.map((job) => renderFollowUpCard(job, true))}
                </div>
              </section>
            )}

            {upcomingJobs.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-[#0F2544]">
                  กำหนดติดตามถัดไป ({upcomingJobs.length})
                </h2>
                <div className="space-y-3">
                  {upcomingJobs.map((job) => renderFollowUpCard(job, false))}
                </div>
              </section>
            )}

            {unscheduledJobs.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-700">
                  งานรอข้อมูล / ยังไม่กำหนดวันติดตาม ({unscheduledJobs.length})
                </h2>
                <div className="space-y-3">
                  {unscheduledJobs.map((job) => renderFollowUpCard(job, false))}
                </div>
              </section>
            )}
          </div>
        )
      ) : completedFollowUps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center">
          <p className="text-sm font-semibold text-[#0F2544]">
            ยังไม่มีประวัติงานที่ติดตามเสร็จแล้ว
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100">
          {completedFollowUps.map((job) => {
            const resolved = resolveJobCustomer(job, customers);
            return (
              <div
                key={job.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#0F2544]">
                      {displayOrUnspecified(resolved.customerName)}
                    </span>
                    <span className="text-xs font-mono-num text-slate-400">{job.jobCode}</span>
                  </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  {job.followUp.reason || 'ติดตามงาน'} · ติดตามแล้วเมื่อ{' '}
                  <span className="font-mono-num">
                    {job.followUp.completedAt
                      ? formatThaiDate(job.followUp.completedAt)
                      : 'วันนี้'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateFollowUp(job.id, { completed: false })}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  ย้อนกลับเป็นรอติดตาม
                </button>
                <button
                  type="button"
                  onClick={() => onSelectJob(job)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-[#0F2544] hover:bg-slate-50 cursor-pointer"
                >
                  ดูใบงาน
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
