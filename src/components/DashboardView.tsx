import React from 'react';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  MessageSquarePlus,
  Plus,
} from 'lucide-react';
import { AppTab, Customer, Job, JobStatus } from '../types/serviceflow';
import { displayOrUnspecified, formatThaiDate, getTodayISO } from '../utils/constants';
import { resolveJobCustomer } from '../utils/customerMatcher';
import { StatusText } from './StatusText';

interface DashboardViewProps {
  jobs: Job[];
  customers: Customer[];
  onNavigateTab: (tab: AppTab) => void;
  onFilterJobsByStatus: (status: JobStatus | 'all') => void;
  onSelectJob: (job: Job) => void;
  onOpenNewManualJob: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  jobs,
  customers,
  onNavigateTab,
  onFilterJobsByStatus,
  onSelectJob,
  onOpenNewManualJob,
}) => {
  const today = getTodayISO();

  const counts = {
    total: jobs.length,
    new: jobs.filter((j) => j.status === 'new').length,
    needs_info: jobs.filter((j) => j.status === 'needs_info').length,
    pending_confirmation: jobs.filter((j) => j.status === 'pending_confirmation').length,
    confirmed: jobs.filter((j) => j.status === 'confirmed').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  const pendingFollowUps = jobs.filter(
    (j) =>
      j.status !== 'completed' &&
      j.status !== 'cancelled' &&
      (j.followUp.required || j.status === 'needs_info' || j.status === 'pending_confirmation') &&
      !j.followUp.completed
  );

  const overdueOrTodayCount = pendingFollowUps.filter(
    (j) => j.followUp.dueDate && j.followUp.dueDate <= today
  ).length;

  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  const kpiCards: {
    label: string;
    count: number;
    filter: JobStatus | 'all';
    accent: string;
  }[] = [
    { label: 'งานทั้งหมด', count: counts.total, filter: 'all', accent: 'text-[#0F2544]' },
    { label: 'งานใหม่', count: counts.new, filter: 'new', accent: 'text-sky-700' },
    {
      label: 'รอข้อมูลเพิ่มเติม',
      count: counts.needs_info,
      filter: 'needs_info',
      accent: 'text-amber-700',
    },
    {
      label: 'รอยืนยัน',
      count: counts.pending_confirmation,
      filter: 'pending_confirmation',
      accent: 'text-indigo-700',
    },
    {
      label: 'ยืนยันแล้ว',
      count: counts.confirmed,
      filter: 'confirmed',
      accent: 'text-teal-700',
    },
    {
      label: 'เสร็จแล้ว',
      count: counts.completed,
      filter: 'completed',
      accent: 'text-emerald-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero / Primary Technician Action Banner */}
      <section className="bg-[#0F2544] text-white rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="max-w-xl">
            <p className="text-xs font-medium text-teal-300">
              ผู้ช่วยจัดการคิวงานช่างแอร์จากแชท LINE
            </p>
            <h1 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-balance">
              เปลี่ยนข้อความลูกค้าเป็นใบงาน พร้อมตรวจข้อมูลที่ขาดก่อนนัดคิว
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              วางข้อความที่ลูกค้าทักมา ระบบจะช่วยแยกชื่อ อาการ ยี่ห้อ BTU และพื้นที่ให้ทันทีโดยไม่เดาข้อมูลเอง
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('ai-creator')}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquarePlus className="w-5 h-5" />
              <span>วางข้อความ LINE สร้างใบงาน</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewManualJob}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มใบงานเอง</span>
            </button>
          </div>
        </div>
      </section>

      {/* 6 Status KPI Grid */}
      <section aria-label="สรุปสถานะใบงาน">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#0F2544]">สรุปภาพรวมใบงาน</h2>
          <button
            type="button"
            onClick={() => onFilterJobsByStatus('all')}
            className="min-h-[40px] px-2 text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>ดูใบงานทั้งหมด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => onFilterJobsByStatus(card.filter)}
              className="text-left bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-teal-500/60 hover:bg-slate-50/70 transition-colors min-h-[88px] flex flex-col justify-between cursor-pointer"
            >
              <span className="text-xs font-medium text-slate-600 leading-snug">
                {card.label}
              </span>
              <span className={`mt-2 text-2xl font-bold font-mono-num ${card.accent}`}>
                {card.count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 2-Column Workspace: Recent Jobs + Follow-up Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Recent Jobs (2 cols on desktop) */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-700" />
              <h2 className="text-base font-semibold text-[#0F2544]">รายการงานล่าสุด</h2>
            </div>
            <button
              type="button"
              onClick={() => onFilterJobsByStatus('all')}
              className="min-h-[40px] px-2.5 text-xs font-medium text-slate-600 hover:text-[#0F2544] cursor-pointer"
            >
              จัดการทั้งหมด
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">ยังไม่มีใบงานในระบบ</p>
              <p className="mt-1 text-xs text-slate-500">
                เริ่มต้นด้วยการวางข้อความจาก LINE เพื่อสร้างใบงานแรก
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('ai-creator')}
                className="mt-4 min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 cursor-pointer"
              >
                สร้างใบงานจาก LINE
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentJobs.map((job) => {
                const resolved = resolveJobCustomer(job, customers);
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onSelectJob(job)}
                    className="w-full text-left px-5 py-3.5 hover:bg-slate-50/90 transition-colors flex items-center justify-between gap-3 min-h-[68px] cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#0F2544] truncate">
                          {displayOrUnspecified(resolved.customerName)}
                        </span>
                        <span className="text-xs font-mono-num text-slate-400">
                          {job.jobCode}
                        </span>
                      </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 flex-wrap">
                      <span>{displayOrUnspecified(job.jobType)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {job.preferredDate
                          ? formatThaiDate(job.preferredDate)
                          : 'ยังไม่ระบุวันนัด'}
                      </span>
                      {job.area ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{job.area}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <StatusText status={job.status} compact />
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Urgent Follow-up Summary */}
        <section className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-600" />
              <h2 className="text-base font-semibold text-[#0F2544]">งานที่ต้องติดตาม</h2>
            </div>
            <span className="text-xs font-mono-num font-semibold text-amber-700">
              {pendingFollowUps.length} รายการ
            </span>
          </div>

          <div className="p-5">
            {pendingFollowUps.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm font-medium text-slate-700">ไม่มีงานค้างติดตาม</p>
                <p className="mt-1 text-xs text-slate-500">
                  งานที่รอข้อมูลหรือรอยืนยันจะแสดงที่นี่
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {overdueOrTodayCount > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      มี <strong className="font-mono-num">{overdueOrTodayCount}</strong>{' '}
                      งานที่ครบกำหนดติดตามวันนี้หรือเกินกำหนด
                    </span>
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {pendingFollowUps.slice(0, 4).map((job) => {
                    const resolved = resolveJobCustomer(job, customers);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => onSelectJob(job)}
                        className="w-full text-left py-3 first:pt-1 last:pb-1 hover:opacity-80 flex items-start justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0F2544] truncate">
                            {displayOrUnspecified(resolved.customerName)}
                          </p>
                          <p className="mt-0.5 text-xs text-amber-700 truncate">
                            {job.followUp.reason ||
                              (job.status === 'needs_info'
                                ? 'รอลูกค้าส่งข้อมูลเพิ่มเติม'
                                : 'รอลูกค้ายืนยันวันนัด')}
                          </p>
                        </div>
                        <span className="text-xs font-mono-num text-slate-500 shrink-0">
                          {job.followUp.dueDate
                            ? formatThaiDate(job.followUp.dueDate)
                            : 'ยังไม่ตั้งวัน'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateTab('followups')}
                  className="w-full min-h-[44px] mt-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-[#0F2544] hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>เปิดหน้ารายการติดตามงาน</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
