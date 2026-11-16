import React, { useState } from 'react';
import {
  AlertCircle,
  Eraser,
  Info,
  Loader2,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { ParsedLineResult } from '../types/serviceflow';
import { analyzeLineMessage } from '../utils/aiClient';
import { SAMPLE_LINE_MESSAGES } from '../utils/constants';

interface AIJobCreatorViewProps {
  aiConfigured: boolean;
  initialText?: string;
  onParsed: (result: ParsedLineResult) => void;
}

export const AIJobCreatorView: React.FC<AIJobCreatorViewProps> = ({
  aiConfigured,
  initialText = '',
  onParsed,
}) => {
  const [messageText, setMessageText] = useState(initialText);
  const [useDemoMode, setUseDemoMode] = useState(!aiConfigured);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const effectiveDemo = !aiConfigured || useDemoMode;

  const handleAnalyze = async () => {
    const trimmed = messageText.trim();
    if (!trimmed) {
      setErrorMsg('กรุณาวางข้อความลูกค้าจาก LINE ก่อนกดวิเคราะห์');
      return;
    }
    setErrorMsg('');
    setIsAnalyzing(true);
    try {
      const result = await analyzeLineMessage(trimmed, effectiveDemo);
      onParsed(result);
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการวิเคราะห์ข้อความ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setMessageText('');
    setErrorMsg('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F2544]">
          สร้างใบงานจากข้อความ LINE
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          คัดลอกข้อความแชทลูกค้ามาวาง ระบบจะแยกข้อมูลที่พบและแจ้งส่วนที่ยังขาดให้ตรวจสอบก่อนบันทึก
        </p>
      </div>

      {/* Honest AI vs Demo Mode Banner */}
      <div
        className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
          effectiveDemo
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-teal-50/80 border-teal-200 text-teal-950'
        }`}
      >
        <div className="flex items-start gap-3">
          <Info
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              effectiveDemo ? 'text-amber-700' : 'text-teal-700'
            }`}
          />
          <div className="text-xs sm:text-sm leading-relaxed">
            {effectiveDemo ? (
              <>
                <p className="font-semibold">
                  โหมดสาธิต (Demo Mode) — ใช้กฎการแยกข้อความตัวอย่าง ไม่ใช่ AI จริง
                </p>
                <p className="mt-0.5 text-amber-800">
                  {aiConfigured
                    ? 'คุณเลือกสลับมาใช้โหมดสาธิตชั่วคราว (สามารถสลับกลับเป็น Gemini AI ได้)'
                    : 'ยังไม่ได้ตั้งค่า Gemini API Key บนเซิร์ฟเวอร์ ระบบจึงใช้ตัวแยกข้อความแบบกฎตัวอย่างเพื่อให้ทดลองใช้งานได้ครบทุกขั้นตอน'}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  เชื่อมต่อ Gemini AI พร้อมใช้งาน (Structured Output)
                </p>
                <p className="mt-0.5 text-teal-800">
                  วิเคราะห์ข้อความภาษาไทยผ่านเซิร์ฟเวอร์ และยังคงบังคับตรวจสอบก่อนบันทึกทุกครั้ง
                </p>
              </>
            )}
          </div>
        </div>

        {aiConfigured && (
          <button
            type="button"
            onClick={() => setUseDemoMode((prev) => !prev)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-current/20 bg-white/80 text-xs font-semibold hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {effectiveDemo ? 'สลับใช้ Gemini AI' : 'ทดลองโหมดสาธิต'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Input Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="line-message-input"
              className="text-sm font-semibold text-[#0F2544] flex items-center gap-2"
            >
              <MessageSquareText className="w-4 h-4 text-teal-700" />
              <span>ข้อความจากลูกค้า (LINE)</span>
            </label>
            <span className="text-xs text-slate-400 font-mono-num">
              {messageText.length} ตัวอักษร
            </span>
          </div>

          <textarea
            id="line-message-input"
            rows={7}
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="วางข้อความลูกค้าที่นี่ เช่น: แอร์ห้องนอนไม่ค่อยเย็นครับ เป็น Daikin 12000 BTU อยากให้เข้ามาดูวันเสาร์ช่วงบ่าย บ้านอยู่แถวบางนา"
            className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-base text-[#0F2544] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 focus:bg-white transition-colors resize-y min-h-[170px]"
          />

          {errorMsg && (
            <div
              role="alert"
              className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-[#0F2544] hover:bg-[#163663] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังวิเคราะห์ข้อความ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <span>วิเคราะห์ข้อความ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={isAnalyzing || !messageText}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eraser className="w-4 h-4" />
              <span>ล้างข้อความ</span>
            </button>
          </div>
        </div>

        {/* Sample Prompts & Extraction Rules */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5">
            <h2 className="text-sm font-semibold text-[#0F2544]">
              ตัวอย่างข้อความให้ทดลองกดวาง
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              แตะเพื่อใส่ข้อความลงในช่องด้านซ้ายทันที
            </p>
            <div className="mt-3 space-y-2.5">
              {SAMPLE_LINE_MESSAGES.map((sample) => (
                <button
                  key={sample.title}
                  type="button"
                  onClick={() => {
                    setMessageText(sample.text);
                    setErrorMsg('');
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold text-teal-800">{sample.title}</p>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    “{sample.text}”
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5">
            <h2 className="text-sm font-semibold text-[#0F2544]">หลักการทำงานของระบบ</h2>
            <ul className="mt-2.5 space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>1. แยกเฉพาะข้อมูลที่ลูกค้าพิมพ์มาจริง ไม่เดาชื่อ เบอร์ หรือที่อยู่เอง</li>
              <li>2. ข้อมูลที่ไม่พบจะแสดงเป็น “ยังไม่ได้ระบุ” เพื่อไม่ให้ช่างเข้าใจผิด</li>
              <li>3. หากลูกค้าระบุวันไม่ชัด เช่น “วันเสาร์” ระบบจะเตือนให้ยืนยันวันที่</li>
              <li>4. ช่างตรวจสอบและแก้ไขได้ทุกช่องก่อนกดบันทึกเป็นใบงาน</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
