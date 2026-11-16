import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  MessageSquarePlus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Customer, Job, JobStatus } from '../types/serviceflow';
import { displayOrUnspecified, formatThaiDate, JOB_STATUS_CONFIG } from '../utils/constants';
import { resolveJobCustomer } from '../utils/customerMatcher';
import { StatusText } from './StatusText';

interface JobsViewProps {
  jobs: Job[];
  customers: Customer[];
  statusFilter: JobStatus | 'all';
  onStatusFilterChange: (status: JobStatus | 'all') => void;
  onSelectJob: (job: Job) => void;
  onOpenAICreator: () => void;
  onOpenNewManualJob: () => void;
}

const FILTER_TABS: { key: JobStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'new', label: JOB_STATUS_CONFIG.new.label },
  { key: 'needs_info', label: JOB_STATUS_CONFIG.needs_info.label },
  { key: 'pending_confirmation', label: JOB_STATUS_CONFIG.pending_confirmation.label },
  { key: 'confirmed', label: JOB_STATUS_CONFIG.confirmed.label },
  { key: 'completed', label: JOB_STATUS_CONFIG.completed.label },
  { key: 'cancelled', label: JOB_STATUS_CONFIG.cancelled.label },
];

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  customers,
  statusFilter,
  onStatusFilterChange,
  onSelectJob,
  onOpenAICreator,
  onOpenNewManualJob,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...jobs]
      .filter((job) => {
        if (statusFilter !== 'all' && job.status !== statusFilter) return false;
        if (!q) return true;
        const resolved = resolveJobCustomer(job, customers);
        return (
          job.jobCode.toLowerCase().includes(q) ||
          resolved.customerName.toLowerCase().includes(q) ||
          resolved.phone.toLowerCase().includes(q) ||
          resolved.area.toLowerCase().includes(q) ||
          resolved.address.toLowerCase().includes(q) ||
          job.brand.toLowerCase().includes(q) ||
          job.symptom.toLowerCase().includes(q) ||
          job.jobType.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [customers, jobs, searchQuery, statusFilter]);

  const countByStatus = (key: JobStatus | 'all') =>
    key === 'all' ? jobs.length : jobs.filter((j) => j.status === key).length;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F2544]">จัดการใบงานทั้งหมด</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            ค้นหา กรองสถานะ อัปเดตงาน และตรวจสอบรายละเอียดคิวช่าง
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNewManualJob}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-[#0F2544] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มใบงาน</span>
          </button>
          <button
            type="button"
            onClick={onOpenAICreator}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>สร้างจาก LINE</span>
          </button>
        </div>
      </div>

      {/* Search + Segmented Status Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า เบอร์โทร พื้นที่ ยี่ห้อแอร์ หรือรหัสใบงาน..."
            className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="ล้างคำค้นหา"
              className="min-h-[40px] min-w-[40px] absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            const count = countByStatus(tab.key);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onStatusFilterChange(tab.key)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#0F2544] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-[#0F2544]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono-num ${active ? 'text-teal-300' : 'text-slate-500'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Job List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#0F2544]">ไม่พบใบงานที่ตรงกับเงื่อนไข</p>
            <p className="mt-1 text-xs text-slate-500">
              ลองเปลี่ยนตัวกรองสถานะ หรือล้างคำค้นหา
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  onStatusFilterChange('all');
                }}
                className="mt-4 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-[#0F2544] hover:bg-slate-50 cursor-pointer"
              >
                แสดงใบงานทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Tap List */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredJobs.map((job) => {
                const resolved = resolveJobCustomer(job, customers);
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onSelectJob(job)}
                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#0F2544] truncate">
                          {displayOrUnspecified(resolved.customerName)}
                        </span>
                        <StatusText status={job.status} compact />
                      </div>
                      <p className="text-xs text-slate-700 truncate">
                        {displayOrUnspecified(job.jobType)}
                        {job.brand ? ` · ${job.brand}` : ''}
                        {job.btu ? ` ${job.btu}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono-num">{job.jobCode}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">
                          {job.preferredDate
                            ? formatThaiDate(job.preferredDate)
                            : 'ยังไม่ระบุวันนัด'}
                        </span>
                        {resolved.area ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{resolved.area}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">รหัส</th>
                    <th className="py-3 px-4">ลูกค้า / ติดต่อ</th>
                    <th className="py-3 px-4">ประเภทงาน / เครื่องแอร์</th>
                    <th className="py-3 px-4">พื้นที่</th>
                    <th className="py-3 px-4">วันนัดหมาย</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredJobs.map((job) => {
                    const resolved = resolveJobCustomer(job, customers);
                    return (
                      <tr
                        key={job.id}
                        onClick={() => onSelectJob(job)}
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-mono-num text-xs text-slate-500 whitespace-nowrap">
                          {job.jobCode}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#0F2544]">
                            {displayOrUnspecified(resolved.customerName)}
                          </p>
                          <p className="text-xs font-mono-num text-slate-500">
                            {displayOrUnspecified(resolved.phone)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-[#0F2544]">
                            {displayOrUnspecified(job.jobType)}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-[240px]">
                            {[job.brand, job.btu, job.symptom].filter(Boolean).join(' · ') ||
                              'ไม่มีรายละเอียดเพิ่มเติม'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                          {displayOrUnspecified(resolved.area)}
                        </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono-num text-slate-700">
                          {job.preferredDate
                            ? formatThaiDate(job.preferredDate)
                            : 'ยังไม่ได้ระบุ'}
                        </span>
                        {job.preferredTime && (
                          <span className="block text-xs text-slate-500">
                            {job.preferredTime}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusText status={job.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="text-xs font-semibold text-teal-700 hover:text-teal-800">
                            เปิดดู
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
