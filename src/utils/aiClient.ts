import { ExtractedFields, ParsedLineResult, UncertainFieldSummary } from '../types/serviceflow';
import { buildExtractionAnalysis, parseLineMessageDemo } from './demoParser';

export interface AIStatusResponse {
  configured: boolean;
  model: string | null;
}

export async function fetchAIStatus(): Promise<AIStatusResponse> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) {
      return { configured: false, model: null };
    }
    return (await res.json()) as AIStatusResponse;
  } catch {
    return { configured: false, model: null };
  }
}

export async function analyzeLineMessage(
  rawMessage: string,
  preferDemo = false
): Promise<ParsedLineResult> {
  if (preferDemo) {
    return parseLineMessageDemo(rawMessage);
  }

  try {
    const res = await fetch('/api/ai/parse-line-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: rawMessage }),
    });

    const payload = await res.json();

    if (!res.ok) {
      // Fall back clearly to demo mode with honest notice if Gemini request fails
      const demo = parseLineMessageDemo(rawMessage);
      return {
        ...demo,
        notice: `${payload?.error || 'เรียก Gemini AI ไม่สำเร็จ'} — ระบบสลับใช้โหมดสาธิต (Demo Mode) แทน`,
      };
    }

    if (!payload.available || !payload.data) {
      return parseLineMessageDemo(rawMessage);
    }

    const d = payload.data;
    const fields: ExtractedFields = {
      customerName: d.customerName || null,
      phone: d.phone || null,
      jobType: d.jobType || null,
      symptom: d.symptom || null,
      brand: d.brand || null,
      btu: d.btu || null,
      preferredDateRaw: d.preferredDateRaw || null,
      preferredDateISO: d.preferredDateISO || null,
      dateNeedsConfirmation: Boolean(d.dateNeedsConfirmation),
      preferredTime: d.preferredTime || null,
      area: d.area || null,
      address: d.address || null,
    };

    const uncertainFromAI: UncertainFieldSummary[] = Array.isArray(d.uncertainFields)
      ? d.uncertainFields.map((u: UncertainFieldSummary) => ({
          key: (u.key || 'preferredDateRaw') as keyof ExtractedFields,
          label: u.label || 'ข้อมูลที่ต้องตรวจสอบ',
          rawValue: u.rawValue || '',
          reason: u.reason || 'กรุณาตรวจสอบกับลูกค้า',
        }))
      : [];

    const questionsFromAI: string[] = Array.isArray(d.suggestedQuestions)
      ? d.suggestedQuestions.filter((q: unknown) => typeof q === 'string' && q.trim().length > 0)
      : [];

    return buildExtractionAnalysis(
      rawMessage,
      fields,
      'gemini',
      'วิเคราะห์ข้อความด้วย Gemini AI (Structured Output) สำเร็จ — กรุณาตรวจสอบข้อมูลก่อนบันทึกทุกครั้ง',
      questionsFromAI,
      uncertainFromAI
    );
  } catch {
    return parseLineMessageDemo(rawMessage);
  }
}
