import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  HelpCircle,
  MessageCircleQuestion,
  Save,
  UserCheck,
  X,
} from 'lucide-react';
import {
  Customer,
  FollowUpReason,
  Job,
  JobStatus,
  ParsedLineResult,
} from '../types/serviceflow';
import {
  FOLLOW_UP_REASON_OPTIONS,
  getTodayISO,
  JOB_STATUS_CONFIG,
  JOB_TYPE_OPTIONS,
  UNSPECIFIED_TEXT,
} from '../utils/constants';
import { matchCustomerForJob } from '../utils/customerMatcher';

interface ReviewJobViewProps {
  parsedResult: ParsedLineResult;
  customers: Customer[];
  onSaveJob: (draft: {
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
  }) => void;
  onBackToEditText: (rawMessage: string) => void;
  onCancel: () => void;
}

export const ReviewJobView: React.FC<ReviewJobViewProps> = ({
  parsedResult,
  customers,
  onSaveJob,
  onBackToEditText,
  onCancel,
}) => {
  const f = parsedResult.fields;

  // Strict customer matching: NEVER auto-match or merge by name alone
  const initialMatch = useMemo(
    () => matchCustomerForJob({ name: f.customerName, phone: f.phone }, customers),
    [customers, f.customerName, f.phone]
  );

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialMatch.autoSelectedCustomerId ?? '__new__'
  );
  const [customerName, setCustomerName] = useState(
    f.customerName || initialMatch.matchedCustomer?.name || ''
  );
  const [phone, setPhone] = useState(f.phone || initialMatch.matchedCustomer?.phone || '');
  const [jobType, setJobType] = useState(f.jobType || 'ซ่อมแอร์ / ตรวจเช็ค');
  const [symptom, setSymptom] = useState(f.symptom || '');
  const [brand, setBrand] = useState(f.brand || '');
  const [btu, setBtu] = useState(f.btu || '');
  const [preferredDate, setPreferredDate] = useState(
    f.preferredDateISO || f.preferredDateRaw || ''
  );
  const [preferredDateConfirmed, setPreferredDateConfirmed] = useState(
    Boolean(f.preferredDateISO && !f.dateNeedsConfirmation)
  );
  const [preferredTime, setPreferredTime] = useState(f.preferredTime || '');
  const [area, setArea] = useState(f.area || initialMatch.matchedCustomer?.area || '');
  const [address, setAddress] = useState(f.address || initialMatch.matchedCustomer?.address || '');

  const liveMatch = useMemo(() => {
    if (selectedCustomerId !== '__new__') return null;
    return matchCustomerForJob({ name: customerName, phone }, customers);
  }, [customers, customerName, phone, selectedCustomerId]);
  // Never default to confirmed automatically!
  const [status, setStatus] = useState<JobStatus>(
    parsedResult.suggestedStatus === 'confirmed' ? 'pending_confirmation' : parsedResult.suggestedStatus
  );
  const [technicianNotes, setTechnicianNotes] = useState('');

  const [followUpRequired, setFollowUpRequired] = useState(
    parsedResult.missingFields.length > 0 || parsedResult.uncertainFields.length > 0
  );
  const [followUpReason, setFollowUpReason] = useState<FollowUpReason | ''>(
    parsedResult.suggestedFollowUpReason || 'รอลูกค้าส่งที่อยู่'
  );
  const [followUpDueDate, setFollowUpDueDate] = useState(getTodayISO());
  const [followUpNote, setFollowUpNote] = useState('');
  const [copiedQuestions, setCopiedQuestions] = useState(false);

  const handleCustomerSelectChange = (val: string) => {
    setSelectedCustomerId(val);
    if (val !== '__new__' && val !== '__none__') {
      const cust = customers.find((c) => c.id === val);
      if (cust) {
        setCustomerName(cust.name);
        if (cust.phone) setPhone(cust.phone);
        if (cust.area && !area) setArea(cust.area);
        if (cust.address && !address) setAddress(cust.address);
      }
    }
  };

  const handleCopySuggestedReply = async () => {
    if (parsedResult.suggestedQuestions.length === 0) return;
    const lines = [
      'สวัสดีครับ เพื่อลงคิวช่างให้เรียบร้อย รบกวนขอข้อมูลเพิ่มเติมดังนี้ครับ:',
      ...parsedResult.suggestedQuestions.map((q, idx) => `${idx + 1}. ${q}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedQuestions(true);
      setTimeout(() => setCopiedQuestions(false), 2200);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveJob({
      customerId:
        selectedCustomerId !== '__new__' && selectedCustomerId !== '__none__'
          ? selectedCustomerId
          : null,
      createCustomerRecord:
        selectedCustomerId === '__new__' && (customerName.trim().length > 0 || phone.trim().length > 0),
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
      technicianNotes: technicianNotes.trim(),
      rawLineMessage: parsedResult.rawMessage,
      aiModeUsed: parsedResult.mode,
      followUpRequired,
      followUpReason,
      followUpDueDate,
      followUpNote: followUpNote.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => onBackToEditText(parsedResult.rawMessage)}
            className="min-h-[40px] -ml-2 px-2 text-xs font-medium text-slate-600 hover:text-[#0F2544] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับไปแก้ไขข้อความ</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F2544]">
            ตรวจสอบข้อมูลก่อนบันทึกใบงาน
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">{parsedResult.notice}</p>
        </div>
      </div>

      {/* Original LINE Message Reference */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-600">ข้อความต้นฉบับจากลูกค้า</p>
        <p className="mt-1 text-sm text-[#0F2544] leading-relaxed">
          “{parsedResult.rawMessage}”
        </p>
      </div>

      {/* Analysis Breakdown: Detected vs Missing vs Uncertain + Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Detected */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span>ข้อมูลที่ตรวจพบ ({parsedResult.detectedFields.length})</span>
          </div>
          {parsedResult.detectedFields.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">ไม่พบข้อมูลที่ชัดเจนจากข้อความ</p>
          ) : (
            <dl className="mt-3 space-y-2">
              {parsedResult.detectedFields.map((item) => (
                <div
                  key={item.key}
                  className="flex items-baseline justify-between gap-2 text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0"
                >
                  <dt className="text-slate-500 shrink-0">{item.label}</dt>
                  <dd className="font-medium text-[#0F2544] text-right">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Missing & Uncertain */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>ข้อมูลที่ยังขาด ({parsedResult.missingFields.length})</span>
            </div>
            {parsedResult.missingFields.length === 0 ? (
              <p className="mt-2 text-xs text-teal-700">ข้อมูลพื้นฐานครบถ้วน</p>
            ) : (
              <ul className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                {parsedResult.missingFields.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="text-amber-700 font-medium">{UNSPECIFIED_TEXT}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {parsedResult.uncertainFields.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                <AlertTriangle className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>ข้อมูลที่ต้องยืนยัน ({parsedResult.uncertainFields.length})</span>
              </div>
              <ul className="mt-2 space-y-2">
                {parsedResult.uncertainFields.map((u) => (
                  <li
                    key={u.key}
                    className="text-xs bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-2.5 text-indigo-950"
                  >
                    <p className="font-semibold">
                      {u.label}: “{u.rawValue}”
                    </p>
                    <p className="mt-0.5 text-indigo-800 leading-relaxed">{u.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Suggested Questions */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F2544]">
              <MessageCircleQuestion className="w-4 h-4 text-teal-700 shrink-0" />
              <span>คำถามที่ควรถามลูกค้าเพิ่มเติม</span>
            </div>
            {parsedResult.suggestedQuestions.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">ไม่มีคำถามเพิ่มเติม</p>
            ) : (
              <ul className="mt-2.5 space-y-2 text-xs text-slate-700 leading-relaxed">
                {parsedResult.suggestedQuestions.map((q, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono-num text-teal-700 font-semibold shrink-0">
                      {idx + 1}.
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {parsedResult.suggestedQuestions.length > 0 && (
            <button
              type="button"
              onClick={handleCopySuggestedReply}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-teal-600 text-teal-800 bg-teal-50/50 hover:bg-teal-50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copiedQuestions ? (
                <>
                  <Check className="w-4 h-4 text-teal-700" />
                  <span>คัดลอกข้อความถามลูกค้าแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>คัดลอกคำถามไปตอบใน LINE</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Editable Job Form */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-[#0F2544]">แบบฟอร์มใบงาน (แก้ไขได้ทุกช่อง)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ช่องที่ปล่อยว่างจะถูกบันทึกเป็น “{UNSPECIFIED_TEXT}”
            </p>
          </div>
          {initialMatch.matchedCustomer && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
              <UserCheck className="w-4 h-4" />
              <span>เบอร์โทรตรงกับลูกค้าเดิม: {initialMatch.matchedCustomer.name}</span>
            </span>
          )}
        </div>

        {/* Link Customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700">
              เชื่อมโยงรายชื่อลูกค้า
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelectChange(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0F2544] focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="__new__">+ สร้างเป็นลูกค้าใหม่ (เมื่อมีชื่อหรือเบอร์โทร)</option>
              <option value="__none__">ยังไม่เชื่อมกับลูกค้า (รอข้อมูลเพิ่มเติม)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  ลูกค้าเดิม: {c.name} · {c.phone || 'ไม่มีเบอร์โทร'}
                  {c.area ? ` · ${c.area}` : ''}
                </option>
              ))}
            </select>

            {liveMatch?.noticeMessage && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 space-y-2">
                <p className="font-medium">{liveMatch.noticeMessage}</p>
                {liveMatch.candidateCustomers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {liveMatch.candidateCustomers.map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => handleCustomerSelectChange(cand.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 text-xs font-semibold text-[#0F2544] cursor-pointer"
                      >
                        เชื่อมกับ: {cand.name} ({cand.phone || 'ไม่มีเบอร์โทร'}
                        {cand.area ? ` · ${cand.area}` : ''})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedCustomerId !== '__new__' &&
              selectedCustomerId !== '__none__' &&
              initialMatch.nameConflictWarning && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950">
                  {initialMatch.noticeMessage}
                </div>
              )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ชื่อลูกค้า
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              เบอร์โทรศัพท์
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-num text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ประเภทงาน
            </label>
            <select
              value={JOB_TYPE_OPTIONS.includes(jobType as any) ? jobType : 'อื่นๆ'}
              onChange={(e) => setJobType(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0F2544] focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {JOB_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              อาการของแอร์ / รายละเอียดงาน
            </label>
            <input
              type="text"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ยี่ห้อแอร์
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ขนาด BTU
            </label>
            <input
              type="text"
              value={btu}
              onChange={(e) => setBtu(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-num text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              วันที่ต้องการเข้าบริการ
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                placeholder="เช่น 2026-11-21 หรือ วันเสาร์"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer min-h-[32px]">
                <input
                  type="checkbox"
                  checked={!preferredDateConfirmed}
                  onChange={(e) => setPreferredDateConfirmed(!e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>ต้องยืนยันวันที่แน่นอนกับลูกค้า</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              เวลาที่ต้องการ
            </label>
            <input
              type="text"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              พื้นที่ / ย่าน
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              สถานะใบงานเริ่มต้น
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0F2544] focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {(['new', 'needs_info', 'pending_confirmation', 'confirmed'] as JobStatus[]).map(
                (st) => (
                  <option key={st} value={st}>
                    {JOB_STATUS_CONFIG[st].label}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ที่อยู่ละเอียด (บ้านเลขที่ / ซอย / หมู่บ้าน / คอนโด)
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={UNSPECIFIED_TEXT}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              บันทึกช่าง / หมายเหตุเพิ่มเติม
            </label>
            <input
              type="text"
              value={technicianNotes}
              onChange={(e) => setTechnicianNotes(e.target.value)}
              placeholder="เช่น เตรียมบันได 6 ฟุต หรือรอเช็คอะไหล่"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        {/* Follow-up setup */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#0F2544] cursor-pointer min-h-[40px]">
            <input
              type="checkbox"
              checked={followUpRequired}
              onChange={(e) => setFollowUpRequired(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            <span>ตั้งการแจ้งเตือนติดตามงานนี้</span>
          </label>

          {followUpRequired && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  สาเหตุที่ต้องติดตาม
                </label>
                <select
                  value={followUpReason}
                  onChange={(e) => setFollowUpReason(e.target.value as FollowUpReason)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F2544]"
                >
                  {FOLLOW_UP_REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  วันที่ต้องติดตาม
                </label>
                <input
                  type="date"
                  value={followUpDueDate}
                  onChange={(e) => setFollowUpDueDate(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono-num text-[#0F2544]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  โน้ตเตือนความจำ
                </label>
                <input
                  type="text"
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="เช่น ทักถามซ้ำช่วงเย็น"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F2544]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Review Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>ยกเลิก</span>
          </button>

          <button
            type="button"
            onClick={() => onBackToEditText(parsedResult.rawMessage)}
            className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#0F2544] text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับไปแก้ไข</span>
          </button>

          <button
            type="submit"
            className="min-h-[48px] px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกใบงาน</span>
          </button>
        </div>
      </div>
    </form>
  );
};
