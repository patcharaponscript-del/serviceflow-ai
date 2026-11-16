import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileJson,
  RotateCcw,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BackupValidationReport,
  canShareBackupFile,
  CurrentBackupSnapshot,
  downloadBackupFile,
  readCurrentBackupSnapshot,
  shareBackupFile,
  validateBackupJsonText,
} from '../utils/backup';
import type { QuarantineRecord } from '../utils/storage';

interface BackupSettingsModalProps {
  open: boolean;
  aiConfigured: boolean;
  inMemoryQuarantine?: QuarantineRecord[];
  quarantineSaved?: boolean;
  onClose: () => void;
  onResetSampleData: () => void;
  onClearAllData: () => void;
}

type ExportStep = 'idle' | 'confirm' | 'result';

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  open,
  aiConfigured,
  inMemoryQuarantine,
  quarantineSaved = true,
  onClose,
  onResetSampleData,
  onClearAllData,
}) => {
  const [snapshot, setSnapshot] = useState<CurrentBackupSnapshot | null>(null);
  const [exportStep, setExportStep] = useState<ExportStep>('idle');
  const [exportOutcome, setExportOutcome] = useState<{
    status: 'success' | 'error';
    message: string;
    fileName?: string;
    exportedAt?: string;
  } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Backup Validation Preview state (read-only inspection of current snapshot or uploaded .json)
  const [previewSourceLabel, setPreviewSourceLabel] = useState<string>('ข้อมูลปัจจุบันใน Browser');
  const [validationReport, setValidationReport] = useState<BackupValidationReport | null>(null);
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const current = readCurrentBackupSnapshot(inMemoryQuarantine);
    setSnapshot(current);
    setExportStep('idle');
    setExportOutcome(null);
    setCopiedJson(false);
    setPreviewSourceLabel('ข้อมูลปัจจุบันใน Browser (ก่อนส่งออก)');
    setValidationReport(current.validation);
    setFileReadError(null);
  }, [open, inMemoryQuarantine]);

  if (!open || !snapshot) return null;

  const handleOpenConfirm = () => {
    // Re-read fresh read-only snapshot right before confirmation
    const fresh = readCurrentBackupSnapshot(inMemoryQuarantine);
    setSnapshot(fresh);
    setExportOutcome(null);
    setCopiedJson(false);
    setPreviewSourceLabel('ข้อมูลปัจจุบันใน Browser (พร้อมส่งออก)');
    setValidationReport(fresh.validation);
    setFileReadError(null);
    setExportStep('confirm');
  };

  const handleConfirmExport = () => {
    const res = downloadBackupFile(snapshot.jsonText, snapshot.fileName);
    setExportStep('result');
    if (res.ok) {
      setExportOutcome({
        status: 'success',
        message: `ส่งออกไฟล์สำรอง "${snapshot.fileName}" เรียบร้อยแล้ว (ข้อมูลเดิมใน Browser ไม่ถูกแก้ไข)`,
        fileName: snapshot.fileName,
        exportedAt: snapshot.payload.exportedAt,
      });
    } else {
      setExportOutcome({
        status: 'error',
        message: `ไม่สามารถดาวน์โหลดไฟล์สำรองได้: ${res.error || 'กรุณาใช้ปุ่มแชร์หรือคัดลอก JSON ด้านล่างแทน'}`,
        fileName: snapshot.fileName,
      });
    }
  };

  const handleShareIOS = async () => {
    const res = await shareBackupFile(snapshot.jsonText, snapshot.fileName);
    if (res.cancelled) return;
    if (res.ok) {
      setExportOutcome({
        status: 'success',
        message: `ส่งต่อไฟล์สำรอง "${snapshot.fileName}" ผ่านเมนูแชร์เรียบร้อยแล้ว`,
        fileName: snapshot.fileName,
        exportedAt: snapshot.payload.exportedAt,
      });
    } else {
      setExportOutcome({
        status: 'error',
        message: res.error || 'ไม่สามารถเปิดเมนูแชร์ไฟล์ได้',
        fileName: snapshot.fileName,
      });
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(snapshot.jsonText);
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 2400);
    } catch {
      setExportOutcome({
        status: 'error',
        message: 'เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ กรุณากดดาวน์โหลดหรือใช้เมนูแชร์ไฟล์แทน',
      });
    }
  };

  const handleValidateSelectedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileReadError(null);

    try {
      const text = await file.text();
      const report = validateBackupJsonText(text);
      setPreviewSourceLabel(`ไฟล์ที่เลือก: ${file.name}`);
      setValidationReport(report);
    } catch (err) {
      setFileReadError(
        err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ที่เลือกได้'
      );
    } finally {
      e.target.value = '';
    }
  };

  const supportsFileShare = canShareBackupFile(snapshot.fileName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F2544]/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-settings-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
              Settings · ตั้งค่า
            </p>
            <h2 id="backup-settings-title" className="text-base sm:text-lg font-bold text-[#0F2544]">
              ตั้งค่าและสำรองข้อมูล (Backup &amp; Data Management)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างตั้งค่า"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Read-only Storage Error if any */}
          {snapshot.storageReadError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">ไม่สามารถอ่าน localStorage ได้ตามปกติ</p>
                <p className="mt-0.5">{snapshot.storageReadError}</p>
              </div>
            </div>
          )}

          {/* Section 1: Backup & Data Management */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0F2544]">
                    สำรองข้อมูลเป็นไฟล์ JSON (Backup &amp; Data Management)
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                    ส่งออกข้อมูลลูกค้า เครื่องแอร์ ใบงาน สถานะ การเชื่อมโยง ID และรายการติดตามทั้งหมดเก็บเป็นไฟล์สำรองโดยไม่แก้ไขข้อมูลในเครื่อง
                  </p>
                </div>
              </div>
            </div>

            {/* Live Read-Only Counts */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white rounded-xl border border-slate-200/90 p-3">
                <p className="text-[11px] text-slate-500">ลูกค้าในเครื่อง</p>
                <p className="mt-0.5 text-lg font-bold font-mono-num text-[#0F2544]">
                  {snapshot.payload.summary.customerCount}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/90 p-3">
                <p className="text-[11px] text-slate-500">ใบงานในเครื่อง</p>
                <p className="mt-0.5 text-lg font-bold font-mono-num text-[#0F2544]">
                  {snapshot.payload.summary.jobCount}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/90 p-3">
                <p className="text-[11px] text-slate-500">เครื่องแอร์ที่บันทึก</p>
                <p className="mt-0.5 text-lg font-bold font-mono-num text-teal-700">
                  {snapshot.payload.summary.acUnitCount}
                </p>
              </div>
            </div>

            {(snapshot.payload.hasQuarantineData || snapshot.validation.quarantineCount > 0) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    พบข้อมูลดิบที่กักกันไว้ (Quarantine):{' '}
                    <span className="font-mono-num">
                      {snapshot.validation.quarantineCount}
                    </span>{' '}
                    รายการ
                    {quarantineSaved === false || snapshot.payload.quarantineSource === 'memory'
                      ? ' (สำรองอยู่ในหน่วยความจำชั่วคราว)'
                      : ''}
                  </p>
                  <p className="mt-0.5 text-amber-900">
                    {quarantineSaved === false || snapshot.payload.quarantineSource === 'memory'
                      ? 'ไม่สามารถเขียน Quarantine ลง localStorage ได้ ระบบจึงเก็บข้อมูลดิบไว้ในหน่วยความจำชั่วคราว กรุณากด Export Backup (JSON) ทันทีเพื่อแนบข้อมูลดิบออกมาก่อนปิดหน้านี้'
                      : 'เมื่อกด Export Backup (JSON) ระบบจะแนบข้อมูลดิบที่กักกันไว้ในไฟล์สำรองให้ด้วยเพื่อให้ตรวจสอบหรือกู้คืนภายหลัง'}
                  </p>
                </div>
              </div>
            )}

            {/* Step: Idle -> Export Button */}
            {exportStep === 'idle' && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleOpenConfirm}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Backup (JSON)</span>
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  อ่านข้อมูลจริงจาก localStorage โดยตรง · ไม่เปลี่ยน ID · ไม่ลบหรือเขียนทับข้อมูลเดิม
                </p>
              </div>
            )}

            {/* Step: Confirmation Screen */}
            {exportStep === 'confirm' && (
              <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0F2544]">
                  <FileJson className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>ยืนยันการส่งออกไฟล์สำรองข้อมูล (Confirmation)</span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  <div>
                    <dt className="text-slate-500">จำนวนลูกค้า (Customer count)</dt>
                    <dd className="mt-0.5 font-mono-num font-bold text-[#0F2544]">
                      {snapshot.payload.summary.customerCount} ราย
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">จำนวนใบงาน (Job count)</dt>
                    <dd className="mt-0.5 font-mono-num font-bold text-[#0F2544]">
                      {snapshot.payload.summary.jobCount} ใบงาน
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">ชื่อไฟล์ที่จะส่งออก (Export file name)</dt>
                    <dd className="mt-0.5 font-mono-num font-semibold text-teal-800 break-all">
                      {snapshot.fileName}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-xl bg-teal-50/70 border border-teal-200 p-3 text-xs text-teal-950 leading-relaxed">
                  <strong>ยืนยันความปลอดภัย:</strong>{' '}
                  ไฟล์นี้เป็นเพียง<strong>สำเนา (Copy)</strong> ของข้อมูลปัจจุบันในเครื่องเท่านั้น
                  ระบบจะไม่แก้ไข ลบ สร้าง ID ใหม่ หรือเขียนทับข้อมูลเดิมใน Browser
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setExportStep('idle')}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmExport}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>ยืนยัน Export Backup (JSON)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step: Result + iPhone Safari Alternatives */}
            {exportStep === 'result' && exportOutcome && (
              <div className="space-y-3">
                <div
                  role="status"
                  className={`rounded-xl border p-3.5 text-xs sm:text-sm flex items-start gap-2.5 ${
                    exportOutcome.status === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-rose-200 bg-rose-50 text-rose-950'
                  }`}
                >
                  {exportOutcome.status === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {exportOutcome.status === 'success'
                        ? 'ส่งออกไฟล์สำรองสำเร็จ'
                        : 'เกิดข้อผิดพลาดในการส่งออกไฟล์'}
                    </p>
                    <p className="mt-0.5 leading-relaxed break-words">{exportOutcome.message}</p>
                    {exportOutcome.status === 'success' && (
                      <p className="mt-1 text-[11px] text-emerald-800">
                        บน iPhone Safari สามารถเปิดดูไฟล์ได้ที่แอป “ไฟล์ (Files)” → รายการดาวน์โหลด (Downloads)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmExport}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F2544] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดอีกครั้ง</span>
                  </button>

                  {supportsFileShare && (
                    <button
                      type="button"
                      onClick={handleShareIOS}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-teal-600 bg-teal-50/60 hover:bg-teal-50 text-xs font-semibold text-teal-800 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>บันทึกผ่าน Share (iPhone)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F2544] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-4 h-4 text-teal-700" />
                        <span>คัดลอก JSON แล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>คัดลอกข้อความ JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Backup Validation Preview (Strictly Read-Only) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <FileCheck2 className="w-5 h-5 text-[#0F2544] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[#0F2544]">
                    ตรวจสอบความถูกต้องไฟล์สำรอง (Backup Validation Preview)
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {previewSourceLabel} · ตรวจสอบอย่างเดียว ไม่กู้คืนหรือเขียนทับข้อมูลอัตโนมัติ
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleValidateSelectedFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-[#0F2544] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>เลือกไฟล์ .json มาตรวจ</span>
                </button>
              </div>
            </div>

            {fileReadError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                {fileReadError}
              </div>
            )}

            {validationReport && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl border border-slate-200 p-2.5">
                    <span className="text-slate-500 block">โครงสร้าง JSON</span>
                    <span
                      className={`mt-0.5 font-semibold inline-block ${
                        validationReport.isValidJson && validationReport.isValidStructure
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {validationReport.isValidJson && validationReport.isValidStructure
                        ? 'ถูกต้อง'
                        : 'ไม่ถูกต้อง'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-2.5">
                    <span className="text-slate-500 block">ลูกค้า / ใบงาน</span>
                    <span className="mt-0.5 font-mono-num font-bold text-[#0F2544] inline-block">
                      {validationReport.customerCount} / {validationReport.jobCount}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-2.5">
                    <span className="text-slate-500 block">ID ซ้ำซ้อน</span>
                    <span
                      className={`mt-0.5 font-mono-num font-semibold inline-block ${
                        validationReport.duplicateCustomerIds.length === 0 &&
                        validationReport.duplicateJobIds.length === 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {validationReport.duplicateCustomerIds.length +
                        validationReport.duplicateJobIds.length}{' '}
                      รายการ
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-2.5">
                    <span className="text-slate-500 block">อ้างอิงลูกค้าไม่พบ</span>
                    <span
                      className={`mt-0.5 font-mono-num font-semibold inline-block ${
                        validationReport.missingCustomerReferences.length === 0
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {validationReport.missingCustomerReferences.length} ใบงาน
                    </span>
                  </div>
                </div>

                {validationReport.errors.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>พบข้อผิดพลาดในไฟล์สำรอง:</span>
                    </p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {validationReport.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationReport.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                      <span>ข้อสังเกตจากการตรวจสอบ:</span>
                    </p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {validationReport.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    {validationReport.missingCustomerReferences.length > 0 && (
                      <p className="pt-1 font-mono-num text-[11px] text-amber-900">
                        ใบงานที่อ้างอิงไม่พบ:{' '}
                        {validationReport.missingCustomerReferences
                          .map((r) => `${r.jobCode} (${r.customerId})`)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {validationReport.errors.length === 0 && validationReport.warnings.length === 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      ผ่านการตรวจสอบครบถ้วน (JSON ถูกต้อง, ไม่มี ID ซ้ำ, ไม่มี customerId ที่อ้างอิงหาย
                      {validationReport.unlinkedJobCount > 0
                        ? `, มีใบงานที่ยังไม่ได้เชื่อมลูกค้า ${validationReport.unlinkedJobCount} ใบ`
                        : ''}
                      )
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section 3: Existing Data Management Actions (Preserved Safely) */}
          <section className="rounded-2xl border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-600">
                จัดการข้อมูลใน Browser ({aiConfigured ? 'เชื่อมต่อ Gemini AI แล้ว' : 'โหมดสาธิต Demo Mode'})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onResetSampleData();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-medium text-[#0F2544] flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>รีเซ็ตเป็นข้อมูลตัวอย่าง</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onClearAllData();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100/70 text-xs sm:text-sm font-medium text-rose-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ล้างข้อมูลทั้งหมดให้ว่าง</span>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex justify-end shrink-0 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0F2544] hover:bg-[#163663] text-white text-sm font-semibold cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
