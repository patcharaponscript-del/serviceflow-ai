import React, { useState } from 'react';
import {
  BellRing,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  MapPin,
  Phone,
  Save,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { Customer, FollowUpReason, Job, JobStatus } from '../types/serviceflow';
import {
  displayOrUnspecified,
  FOLLOW_UP_REASON_OPTIONS,
  formatThaiDate,
  getTodayISO,
  JOB_STATUS_CONFIG,
  JOB_TYPE_OPTIONS,
  UNSPECIFIED_TEXT,
} from '../utils/constants';
import { matchCustomerForJob, resolveJobCustomer } from '../utils/customerMatcher';
import { StatusText } from './StatusText';

interface JobDetailModalProps {
  job: Job | null; // null when creating a brand new manual job
  isNewManual?: boolean;
  preselectedCustomerId?: string | null;
  customers: Customer[];
  onClose: () => void;
  onSave: (
    updatedJob: Omit<Job, 'id' | 'jobCode' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createCustomerRecord?: boolean;
    }
  ) => void;
  onDeleteRequest: (job: Job) => void;
  onOpenCustomer: (customerId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isNewManual = false,
  preselectedCustomerId = null,
  customers,
  onClose,
  onSave,
  onDeleteRequest,
  onOpenCustomer,
}) => {
  const initialCustomer = preselectedCustomerId
    ? customers.find((c) => c.id === preselectedCustomerId) || null
    : job?.customerId
    ? customers.find((c) => c.id === job.customerId) || null
    : null;

  const [isEditing, setIsEditing] = useState(isNewManual);

  const [customerId, setCustomerId] = useState<string>(
    job?.customerId || preselectedCustomerId || (isNewManual ? '__new__' : '')
  );
  const [customerName, setCustomerName] = useState(
    initialCustomer?.name || job?.customerName || ''
  );
  const [phone, setPhone] = useState(initialCustomer?.phone || job?.phone || '');
  const [jobType, setJobType] = useState(job?.jobType || 'ล้างแอร์');
  const [symptom, setSymptom] = useState(job?.symptom || '');
  const [brand, setBrand] = useState(job?.brand || '');
  const [btu, setBtu] = useState(job?.btu || '');
  const [preferredDate, setPreferredDate] = useState(job?.preferredDate || '');
  const [preferredDateConfirmed, setPreferredDateConfirmed] = useState(
    job?.preferredDateConfirmed ?? false
  );
  const [preferredTime, setPreferredTime] = useState(job?.preferredTime || '');
  const [area, setArea] = useState(job?.area || initialCustomer?.area || '');
  const [address, setAddress] = useState(job?.address || initialCustomer?.address || '');
  const [status, setStatus] = useState<JobStatus>(job?.status || 'new');
  const [technicianNotes, setTechnicianNotes] = useState(job?.technicianNotes || '');

  const [followUpRequired, setFollowUpRequired] = useState(job?.followUp.required ?? false);
  const [followUpReason, setFollowUpReason] = useState<FollowUpReason | ''>(
    job?.followUp.reason || 'รอลูกค้ายืนยันวันนัด'
  );
  const [followUpDueDate, setFollowUpDueDate] = useState(
    job?.followUp.dueDate || getTodayISO()
  );
  const [followUpNote, setFollowUpNote] = useState(job?.followUp.note || '');
  const [followUpCompleted, setFollowUpCompleted] = useState(
    job?.followUp.completed ?? false
  );
  const [copiedPhone, setCopiedPhone] = useState(false);

  const liveMatch =
    isEditing && (customerId === '__new__' || customerId === '')
      ? matchCustomerForJob({ name: customerName, phone }, customers)
      : null;

  const handleCustomerChange = (newId: string) => {
    setCustomerId(newId);
    if (newId !== '__new__' && newId !== '') {
      const found = customers.find((c) => c.id === newId);
      if (found) {
        setCustomerName(found.name);
        setPhone(found.phone);
        if (found.area) setArea(found.area);
        if (found.address) setAddress(found.address);
      }
    }
  };

  const handleQuickStatusChange = (newStatus: JobStatus) => {
    setStatus(newStatus);
    if (job && !isEditing) {
      onSave({
        id: job.id,
        customerId: job.customerId,
        customerName: job.customerName,
        phone: job.phone,
        jobType: job.jobType,
        symptom: job.symptom,
        brand: job.brand,
        btu: job.btu,
        preferredDate: job.preferredDate,
        preferredDateConfirmed:
          newStatus === 'confirmed' ? true : job.preferredDateConfirmed,
        preferredTime: job.preferredTime,
        area: job.area,
        address: job.address,
        status: newStatus,
        rawLineMessage: job.rawLineMessage,
        aiModeUsed: job.aiModeUsed,
        technicianNotes: job.technicianNotes,
        followUp:
          newStatus === 'completed' || newStatus === 'cancelled'
            ? { ...job.followUp, completed: true, completedAt: getTodayISO() }
            : job.followUp,
        isSample: job.isSample,
      });
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const isCreatingNewCustomer =
      customerId === '__new__' && (customerName.trim().length > 0 || phone.trim().length > 0);
    const resolvedCustomerId =
      customerId && customerId !== '__new__' ? customerId : null;

    onSave({
      id: job?.id,
      customerId: resolvedCustomerId,
      createCustomerRecord: isCreatingNewCustomer,
      customerName: customerName.trim(),
      phone: phone.trim(),
      jobType: jobType.trim() || 'อื่นๆ',
      symptom: symptom.trim(),
      brand: brand.trim(),
      btu: btu.trim(),
      preferredDate: preferredDate.trim(),
      preferredDateConfirmed,
      preferredTime: preferredTime.trim(),
      area: area.trim(),
      address: address.trim(),
      status,
      rawLineMessage: job?.rawLineMessage,
      aiModeUsed: job?.aiModeUsed || 'manual',
      technicianNotes: technicianNotes.trim(),
      followUp: {
        required: followUpRequired,
        reason: followUpRequired ? followUpReason : '',
        dueDate: followUpRequired ? followUpDueDate : '',
        note: followUpRequired ? followUpNote.trim() : '',
        completed: followUpRequired ? followUpCompleted : false,
        completedAt: job?.followUp.completedAt,
      },
      isSample: job?.isSample && !isNewManual ? true : false,
    });
  };

  const handleCopyPhone = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const resolvedView = job ? resolveJobCustomer(job, customers) : null;
  const linkedCustomer = resolvedView?.customer || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F2544]/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#0F2544] truncate">
                {isNewManual
                  ? 'สร้างใบงานใหม่'
                  : isEditing
                  ? `แก้ไขใบงาน ${job?.jobCode}`
                  : `รายละเอียดใบงาน ${job?.jobCode}`}
              </h2>
            </div>
            {!isNewManual && job && (
              <div className="mt-1">
                <StatusText status={status} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isNewManual && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-[#0F2544] hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>แก้ไข</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!isEditing && job ? (
            <>
              {/* Quick Status Switcher */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">เปลี่ยนสถานะงาน</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(JOB_STATUS_CONFIG) as JobStatus[]).map((st) => {
                    const cfg = JOB_STATUS_CONFIG[st];
                    const active = status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleQuickStatusChange(st)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors text-left flex items-center justify-between cursor-pointer ${
                          active
                            ? `${cfg.bgSoftClass} ${cfg.borderClass} ${cfg.textClass}`
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{cfg.label}</span>
                        {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer & Contact Info */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0F2544]">
                    <User className="w-4 h-4 text-teal-700" />
                    <span>ข้อมูลลูกค้าและสถานที่</span>
                  </div>
                  {linkedCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCustomer(linkedCustomer.id);
                      }}
                      className="min-h-[36px] px-2.5 text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>ดูประวัติลูกค้า</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">ชื่อลูกค้า</dt>
                    <dd className="mt-0.5 font-medium text-[#0F2544]">
                      {displayOrUnspecified(resolvedView?.customerName)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">เบอร์โทรศัพท์</dt>
                    <dd className="mt-0.5 flex items-center gap-2">
                      {resolvedView?.phone ? (
                        <>
                          <a
                            href={`tel:${resolvedView.phone.replace(/[^0-9+]/g, '')}`}
                            className="font-mono-num font-medium text-teal-700 hover:underline inline-flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{resolvedView.phone}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(resolvedView.phone)}
                            className="text-xs text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
                          >
                            {copiedPhone ? 'คัดลอกแล้ว' : <Copy className="w-3 h-3" />}
                          </button>
                        </>
                      ) : (
                        <span className="text-amber-700 text-xs font-medium">
                          {UNSPECIFIED_TEXT}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">พื้นที่ / ย่าน</dt>
                    <dd className="mt-0.5 font-medium text-[#0F2544]">
                      {displayOrUnspecified(resolvedView?.area)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">นัดหมายวัน / เวลา</dt>
                    <dd className="mt-0.5 font-medium text-[#0F2544]">
                      <span className="font-mono-num">
                        {job.preferredDate
                          ? formatThaiDate(job.preferredDate)
                          : UNSPECIFIED_TEXT}
                      </span>
                      {job.preferredTime ? ` · ${job.preferredTime}` : ''}
                      {job.preferredDate && !job.preferredDateConfirmed ? (
                        <span className="block text-xs text-amber-700 mt-0.5">
                          (ยังไม่ยืนยันวันที่แน่นอน)
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>ที่อยู่ละเอียด</span>
                    </dt>
                    <dd className="mt-0.5 font-medium text-[#0F2544]">
                      {resolvedView?.address ? (
                        resolvedView.address
                      ) : (
                        <span className="text-amber-700 text-xs font-medium">
                          {UNSPECIFIED_TEXT}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* AC Details */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F2544]">
                  <Wrench className="w-4 h-4 text-teal-700" />
                  <span>ข้อมูลเครื่องปรับอากาศและอาการ</span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">ประเภทงาน</dt>
                    <dd className="mt-0.5 font-medium text-[#0F2544]">
                      {displayOrUnspecified(job.jobType)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">ยี่ห้อ</dt>
                    <dd className="mt-0.5 font-medium text-[#0F2544]">
                      {displayOrUnspecified(job.brand)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">ขนาด BTU</dt>
                    <dd className="mt-0.5 font-mono-num font-medium text-[#0F2544]">
                      {displayOrUnspecified(job.btu)}
                    </dd>
                  </div>
                  <div className="sm:col-span-3">
                    <dt className="text-xs text-slate-500">อาการ / รายละเอียด</dt>
                    <dd className="mt-0.5 font-medium text-[#0F2544]">
                      {displayOrUnspecified(job.symptom)}
                    </dd>
                  </div>
                  {job.technicianNotes && (
                    <div className="sm:col-span-3 pt-2 border-t border-slate-100">
                      <dt className="text-xs text-slate-500">บันทึกช่าง</dt>
                      <dd className="mt-0.5 text-sm text-slate-700">{job.technicianNotes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Follow-up Box */}
              {job.followUp.required && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <BellRing className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm">
                      <p className="font-semibold text-amber-950">
                        การติดตามงาน: {job.followUp.reason || 'ติดตามลูกค้า'}
                      </p>
                      <p className="mt-0.5 text-amber-800 font-mono-num">
                        กำหนดติดตาม:{' '}
                        {job.followUp.dueDate
                          ? formatThaiDate(job.followUp.dueDate)
                          : UNSPECIFIED_TEXT}{' '}
                        · {job.followUp.completed ? 'ติดตามแล้ว' : 'รอติดตาม'}
                      </p>
                      {job.followUp.note && (
                        <p className="mt-1 text-amber-900">{job.followUp.note}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Original LINE message if any */}
              {job.rawLineMessage && (
                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                  <p className="text-xs font-semibold text-slate-500">ข้อความลูกค้าจาก LINE</p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    “{job.rawLineMessage}”
                  </p>
                </div>
              )}
            </>
          ) : (
            <form id="job-edit-form" onSubmit={handleSaveForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    เชื่อมโยงลูกค้า
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F2544]"
                  >
                    <option value="__new__">+ สร้างเป็นลูกค้าใหม่ (เมื่อมีชื่อหรือเบอร์โทร)</option>
                    <option value="">ยังไม่เชื่อมกับลูกค้า</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.phone || 'ไม่มีเบอร์โทร'}
                        {c.area ? ` · ${c.area}` : ''}
                      </option>
                    ))}
                  </select>

                  {liveMatch?.noticeMessage && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-950 space-y-1.5">
                      <p className="font-medium">{liveMatch.noticeMessage}</p>
                      {liveMatch.candidateCustomers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {liveMatch.candidateCustomers.map((cand) => (
                            <button
                              key={cand.id}
                              type="button"
                              onClick={() => handleCustomerChange(cand.id)}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 text-xs font-semibold text-[#0F2544] cursor-pointer"
                            >
                              เชื่อมกับ: {cand.name} ({cand.phone || 'ไม่มีเบอร์โทร'})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อลูกค้า
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono-num text-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ประเภทงาน
                  </label>
                  <select
                    value={JOB_TYPE_OPTIONS.includes(jobType as any) ? jobType : 'อื่นๆ'}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F2544]"
                  >
                    {JOB_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สถานะใบงาน
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as JobStatus)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F2544]"
                  >
                    {(Object.keys(JOB_STATUS_CONFIG) as JobStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {JOB_STATUS_CONFIG[st].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ยี่ห้อแอร์
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ขนาด BTU
                  </label>
                  <input
                    type="text"
                    value={btu}
                    onChange={(e) => setBtu(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono-num text-[#0F2544]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    อาการของแอร์ / รายละเอียด
                  </label>
                  <input
                    type="text"
                    value={symptom}
                    onChange={(e) => setSymptom(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่ต้องการเข้าบริการ
                  </label>
                  <input
                    type="text"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    placeholder="เช่น 2026-11-21 หรือ วันเสาร์"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                  <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferredDateConfirmed}
                      onChange={(e) => setPreferredDateConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600"
                    />
                    <span>ยืนยันวันที่แน่นอนแล้ว</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เวลาที่ต้องการ
                  </label>
                  <input
                    type="text"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    พื้นที่ / ย่าน
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    บันทึกช่าง
                  </label>
                  <input
                    type="text"
                    value={technicianNotes}
                    onChange={(e) => setTechnicianNotes(e.target.value)}
                    placeholder="โน้ตเพิ่มเติมสำหรับช่าง"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ที่อยู่ละเอียด
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={UNSPECIFIED_TEXT}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#0F2544]"
                  />
                </div>
              </div>

              {/* Follow Up Editor */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F2544] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followUpRequired}
                    onChange={(e) => setFollowUpRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600"
                  />
                  <span>เปิดแจ้งเตือนติดตามงาน</span>
                </label>

                {followUpRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">สาเหตุ</label>
                      <select
                        value={followUpReason}
                        onChange={(e) => setFollowUpReason(e.target.value as FollowUpReason)}
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-[#0F2544]"
                      >
                        {FOLLOW_UP_REASON_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">วันติดตาม</label>
                      <input
                        type="date"
                        value={followUpDueDate}
                        onChange={(e) => setFollowUpDueDate(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-mono-num text-[#0F2544]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">โน้ตติดตาม</label>
                      <input
                        type="text"
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-[#0F2544]"
                      />
                    </div>
                    <label className="sm:col-span-3 inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={followUpCompleted}
                        onChange={(e) => setFollowUpCompleted(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600"
                      />
                      <span>ทำเครื่องหมายว่าติดตามแล้ว</span>
                    </label>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0 pb-safe">
          {!isNewManual && job ? (
            <button
              type="button"
              onClick={() => onDeleteRequest(job)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-rose-700 hover:bg-rose-50 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>ลบใบงาน</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isNewManual) onClose();
                    else setIsEditing(false);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  form="job-edit-form"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึก</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0F2544] text-white text-sm font-semibold hover:bg-[#163663] cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
