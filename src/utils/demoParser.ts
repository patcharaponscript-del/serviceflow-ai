import {
  ExtractedFields,
  ExtractedFieldSummary,
  FollowUpReason,
  JobStatus,
  ParsedLineResult,
  UncertainFieldSummary,
} from '../types/serviceflow';

const BRAND_PATTERNS: { regex: RegExp; canonical: string }[] = [
  { regex: /\b(daikin|ไดกิ้น)\b/i, canonical: 'Daikin' },
  { regex: /\b(mitsubishi|mitsu|มิตซูบิชิ|มิตซู)\b/i, canonical: 'Mitsubishi' },
  { regex: /\b(carrier|แคเรียร์|แคเรีย)\b/i, canonical: 'Carrier' },
  { regex: /\b(haier|ไฮเออร์)\b/i, canonical: 'Haier' },
  { regex: /\b(lg|แอลจี)\b/i, canonical: 'LG' },
  { regex: /\b(samsung|ซัมซุง)\b/i, canonical: 'Samsung' },
  { regex: /\b(panasonic|พานาโซนิค|พานา)\b/i, canonical: 'Panasonic' },
  { regex: /\b(saijo\s*denki|ไซโจ|saijo)\b/i, canonical: 'Saijo Denki' },
  { regex: /\b(tcl|ทีซีแอล)\b/i, canonical: 'TCL' },
  { regex: /\b(hisense|ไฮเซ่นส์)\b/i, canonical: 'Hisense' },
  { regex: /\b(sharp|ชาร์ป)\b/i, canonical: 'Sharp' },
  { regex: /\b(york|ยอร์ค)\b/i, canonical: 'York' },
  { regex: /\b(trane|เทรน)\b/i, canonical: 'Trane' },
  { regex: /\b(gree|กรี)\b/i, canonical: 'Gree' },
  { regex: /\b(toshiba|โตชิบา)\b/i, canonical: 'Toshiba' },
];

const AREA_KEYWORDS = [
  'บางนา',
  'อ่อนนุช',
  'สุขุมวิท',
  'ลาดพร้าว',
  'รามคำแหง',
  'พระราม 2',
  'พระราม 3',
  'พระราม 4',
  'พระราม 9',
  'รัชดา',
  'ห้วยขวาง',
  'ดินแดง',
  'พญาไท',
  'อารีย์',
  'จตุจักร',
  'บางเขน',
  'สายไหม',
  'ดอนเมือง',
  'หลักสี่',
  'มีนบุรี',
  'ลาดกระบัง',
  'ประเวศ',
  'ศรีนครินทร์',
  'พัฒนาการ',
  'อุดมสุข',
  'แบริ่ง',
  'สำโรง',
  'สมุทรปราการ',
  'นนทบุรี',
  'ปากเกร็ด',
  'บางใหญ่',
  'รังสิต',
  'ปทุมธานี',
  'ปิ่นเกล้า',
  'บางแค',
  'ตลิ่งชัน',
  'ธนบุรี',
  'สาทร',
  'สีลม',
  'ทองหล่อ',
  'เอกมัย',
];

export const FIELD_LABELS: { key: keyof ExtractedFields; label: string }[] = [
  { key: 'customerName', label: 'ชื่อลูกค้า' },
  { key: 'phone', label: 'เบอร์โทรศัพท์' },
  { key: 'jobType', label: 'ประเภทงาน' },
  { key: 'symptom', label: 'อาการของแอร์' },
  { key: 'brand', label: 'ยี่ห้อ' },
  { key: 'btu', label: 'ขนาด BTU' },
  { key: 'preferredDateRaw', label: 'วันที่ต้องการเข้าบริการ' },
  { key: 'preferredTime', label: 'เวลาที่ต้องการ' },
  { key: 'area', label: 'พื้นที่' },
  { key: 'address', label: 'ที่อยู่ละเอียด' },
];

export function buildExtractionAnalysis(
  rawMessage: string,
  fields: ExtractedFields,
  mode: 'gemini' | 'demo',
  notice: string,
  aiSuggestedQuestions?: string[],
  aiUncertainFields?: UncertainFieldSummary[]
): ParsedLineResult {
  const detectedFields: ExtractedFieldSummary[] = [];
  const missingFields: { key: keyof ExtractedFields; label: string }[] = [];
  const uncertainFields: UncertainFieldSummary[] = aiUncertainFields ? [...aiUncertainFields] : [];

  const checkKeys: { key: keyof ExtractedFields; label: string }[] = [
    { key: 'customerName', label: 'ชื่อลูกค้า' },
    { key: 'phone', label: 'เบอร์โทรศัพท์' },
    { key: 'jobType', label: 'ประเภทงาน' },
    { key: 'symptom', label: 'อาการของแอร์' },
    { key: 'brand', label: 'ยี่ห้อ' },
    { key: 'btu', label: 'ขนาด BTU' },
    { key: 'preferredDateRaw', label: 'วันที่ต้องการเข้าบริการ' },
    { key: 'preferredTime', label: 'เวลาที่ต้องการ' },
    { key: 'area', label: 'พื้นที่' },
    { key: 'address', label: 'ที่อยู่ละเอียด' },
  ];

  for (const item of checkKeys) {
    const val = fields[item.key];
    if (typeof val === 'string' && val.trim().length > 0) {
      detectedFields.push({ key: item.key, label: item.label, value: val.trim() });
    } else {
      missingFields.push({ key: item.key, label: item.label });
    }
  }

  if (
    fields.dateNeedsConfirmation &&
    fields.preferredDateRaw &&
    !uncertainFields.some((u) => u.key === 'preferredDateRaw')
  ) {
    uncertainFields.push({
      key: 'preferredDateRaw',
      label: 'วันที่ต้องการเข้าบริการ',
      rawValue: fields.preferredDateRaw,
      reason: `ลูกค้าระบุเพียง "${fields.preferredDateRaw}" โดยไม่มีวันที่/เดือนแน่นอน ต้องยืนยันวันที่กับลูกค้า`,
    });
  }

  if (fields.area && !fields.address && !uncertainFields.some((u) => u.key === 'address')) {
    uncertainFields.push({
      key: 'address',
      label: 'ที่อยู่ละเอียด',
      rawValue: fields.area,
      reason: `ทราบเพียงพื้นที่ "${fields.area}" ยังไม่ทราบบ้านเลขที่ ซอย หรือชื่อหมู่บ้าน/คอนโด`,
    });
  }

  const questions: string[] =
    aiSuggestedQuestions && aiSuggestedQuestions.length > 0 ? [...aiSuggestedQuestions] : [];

  if (questions.length === 0) {
    if (!fields.customerName) {
      questions.push('ขอทราบชื่อคุณลูกค้าเพื่อบันทึกนัดหมายครับ');
    }
    if (!fields.phone) {
      questions.push('ขอเบอร์โทรศัพท์ติดต่อกลับสำหรับช่างหน้างานครับ');
    }
    if (!fields.address) {
      questions.push(
        fields.area
          ? `ขอทราบที่อยู่ละเอียดแถว${fields.area} (บ้านเลขที่/ซอย/หมู่บ้าน หรือส่งโลเคชั่น) ครับ`
          : 'ขอทราบที่อยู่หน้างานโดยละเอียด หรือส่งโลเคชั่นทาง LINE ครับ'
      );
    }
    if (fields.dateNeedsConfirmation && fields.preferredDateRaw) {
      questions.push(
        `ที่สะดวกเป็น "${fields.preferredDateRaw}" รบกวนยืนยันเป็นวันที่แน่นอน (เช่น เสาร์ที่เท่าไหร่) เพื่อลงคิวช่างครับ`
      );
    } else if (!fields.preferredDateRaw) {
      questions.push('ลูกค้าสะดวกให้ช่างเข้าไปบริการวันไหนครับ');
    }
    if (!fields.preferredTime) {
      questions.push('ช่วงเวลาที่สะดวกเข้าบริการเป็นช่วงเช้าหรือช่วงบ่ายครับ');
    }
    if (!fields.jobType && !fields.symptom) {
      questions.push('รบกวนแจ้งอาการแอร์หรือบริการที่ต้องการ (เช่น ล้างแอร์ หรือตรวจเช็คซ่อม) ครับ');
    }
  }

  let suggestedStatus: JobStatus = 'new';
  let suggestedFollowUpReason: FollowUpReason | '' = '';

  if (!fields.address || !fields.phone || !fields.customerName) {
    suggestedStatus = 'needs_info';
    suggestedFollowUpReason = !fields.address ? 'รอลูกค้าส่งที่อยู่' : 'รอติดต่อกลับ';
  } else if (fields.dateNeedsConfirmation || !fields.preferredDateRaw) {
    suggestedStatus = 'pending_confirmation';
    suggestedFollowUpReason = 'รอลูกค้ายืนยันวันนัด';
  } else {
    suggestedStatus = 'pending_confirmation';
    suggestedFollowUpReason = 'รอลูกค้ายืนยันวันนัด';
  }

  return {
    mode,
    notice,
    rawMessage,
    fields,
    detectedFields,
    missingFields,
    uncertainFields,
    suggestedQuestions: questions,
    suggestedStatus,
    suggestedFollowUpReason,
  };
}

export function parseLineMessageDemo(rawMessage: string): ParsedLineResult {
  const text = rawMessage.trim();

  // 1. Phone number
  const phoneMatch = text.match(/(?:0[689]\d[-.\s]?\d{3}[-.\s]?\d{4}|02[-.\s]?\d{3}[-.\s]?\d{4})/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, '-') : null;

  // 2. Customer name (strict: only if explicit pattern like ชื่อ..., คุณ...)
  let customerName: string | null = null;
  const nameMatch = text.match(
    /(?:ชื่อ(?:เล่น)?|ผม|หนู|ดิฉัน)\s*(?:ชื่อ)?\s*([ก-๙a-zA-Z]{2,20})(?=\s*(?:นะ|ค่ะ|ครับ|โทร|เบอร์|,|$))/i
  );
  if (nameMatch && !['แอร์', 'บ้าน', 'คอนโด', 'อยาก', 'อยู่'].includes(nameMatch[1])) {
    customerName = nameMatch[1].trim();
  } else {
    const khunMatch = text.match(/(คุณ[ก-๙a-zA-Z]{2,20})/);
    if (khunMatch && khunMatch[1] !== 'คุณลูกค้า') {
      customerName = khunMatch[1].trim();
    }
  }

  // 3. Brand
  let brand: string | null = null;
  for (const b of BRAND_PATTERNS) {
    if (b.regex.test(text)) {
      brand = b.canonical;
      break;
    }
  }

  // 4. BTU
  let btu: string | null = null;
  const btuMatch = text.match(/(\d{1,2}[,\s]?\d{3})\s*(?:btu|บีทียู)/i);
  if (btuMatch) {
    const numeric = btuMatch[1].replace(/[,\s]/g, '');
    btu = `${Number(numeric).toLocaleString('en-US')} BTU`;
  }

  // 5. Symptom & Job Type
  const symptomParts: string[] = [];
  if (/ไม่ค่อยเย็น|ไม่เย็น|ลมร้อน|มีแต่ลม/i.test(text)) symptomParts.push('แอร์ไม่ค่อยเย็น');
  if (/น้ำหยด|น้ำรั่ว|น้ำไหล/i.test(text)) symptomParts.push('น้ำหยด / น้ำรั่ว');
  if (/เสียงดัง|สั่น/i.test(text)) symptomParts.push('เสียงดังผิดปกติ');
  if (/เหม็น|กลิ่นอับ|กลิ่น/i.test(text)) symptomParts.push('มีกลิ่นอับ');
  if (/เปิดไม่ติด|ไฟกระพริบ|ตัดบ่อย|ดับเอง/i.test(text)) symptomParts.push('เครื่องมีปัญหาไฟ / เปิดไม่ติด');
  if (/ห้องนอน/i.test(text) && symptomParts.length > 0) {
    symptomParts[0] = `${symptomParts[0]} (ห้องนอน)`;
  } else if (/ห้องนั่งเล่น|ห้องรับแขก/i.test(text) && symptomParts.length > 0) {
    symptomParts[0] = `${symptomParts[0]} (ห้องนั่งเล่น)`;
  }
  const symptom = symptomParts.length > 0 ? symptomParts.join(', ') : null;

  let jobType: string | null = null;
  if (/ติดตั้งแอร์|ติดแอร์/i.test(text)) {
    jobType = 'ติดตั้งแอร์';
  } else if (/ย้ายแอร์|ถอดย้าย/i.test(text)) {
    jobType = 'ย้ายแอร์';
  } else if (/เติมน้ำยา/i.test(text)) {
    jobType = 'เติมน้ำยาแอร์';
  } else if (/ล้างแอร์|ล้าง/i.test(text) && symptomParts.length === 0) {
    jobType = 'ล้างแอร์';
  } else if (/ล้างแอร์|ล้าง/i.test(text) && symptomParts.length > 0) {
    jobType = 'ซ่อมแอร์ / ตรวจเช็ค';
  } else if (/ซ่อม|เข้ามาดู|เช็ค|ตรวจ|เสีย|ไม่เย็น|น้ำหยด|เสียงดัง/i.test(text)) {
    jobType = 'ซ่อมแอร์ / ตรวจเช็ค';
  }

  // 6. Date & confirmation detection
  let preferredDateRaw: string | null = null;
  let preferredDateISO: string | null = null;
  let dateNeedsConfirmation = false;

  const exactDateMatch = text.match(/(\d{1,2})\s*(?:\/|-)\s*(\d{1,2})(?:\s*(?:\/|-)\s*(\d{2,4}))?/);
  const relativeDayMatch = text.match(
    /(วันจันทร์|วันอังคาร|วันพุธ|วันพฤหัส(?:บดี)?|วันศุกร์|วันเสาร์|วันอาทิตย์|พรุ่งนี้|มะรืน|เสาร์อาทิตย์|สุดสัปดาห์)/i
  );

  if (exactDateMatch) {
    const day = Number(exactDateMatch[1]);
    const month = Number(exactDateMatch[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = exactDateMatch[3]
        ? Number(exactDateMatch[3]) > 2500
          ? Number(exactDateMatch[3]) - 543
          : Number(exactDateMatch[3]) < 100
          ? 2000 + Number(exactDateMatch[3])
          : Number(exactDateMatch[3])
        : new Date().getFullYear();
      preferredDateISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      preferredDateRaw = exactDateMatch[0];
      dateNeedsConfirmation = false;
    }
  } else if (relativeDayMatch) {
    preferredDateRaw = relativeDayMatch[1];
    dateNeedsConfirmation = true;
  }

  // 7. Time
  const timeMatches: string[] = [];
  const exactTime = text.match(/(\d{1,2}[:.]\d{2}\s*(?:น\.|โมง)?)/);
  if (exactTime) timeMatches.push(exactTime[1].trim());
  const periodTime = text.match(
    /(ช่วงเช้า|ตอนเช้า|ช่วงสาย|ตอนสาย|ช่วงเที่ยง|ตอนเที่ยง|ช่วงบ่าย|ตอนบ่าย|ช่วงเย็น|ตอนเย็น)/
  );
  if (periodTime) {
    if (!timeMatches.some((t) => t.includes(periodTime[1]))) {
      timeMatches.push(periodTime[1]);
    }
  } else {
    const loosePeriod = text.match(/(?:วัน[^\s]*\s*|เวลา\s*)(เช้า|สาย|เที่ยง|บ่าย)/);
    if (loosePeriod) {
      timeMatches.push(`ช่วง${loosePeriod[1]}`);
    }
  }
  const preferredTime = timeMatches.length > 0 ? timeMatches.join(' ') : null;

  // 8. Area
  let area: string | null = null;
  for (const kw of AREA_KEYWORDS) {
    if (text.includes(kw)) {
      area = kw;
      break;
    }
  }

  // 9. Detailed Address (only if explicit house number, soi with number, condo/village name)
  let address: string | null = null;
  const houseNoMatch = text.match(/(?:บ้านเลขที่|เลขที่)?\s*\d{1,4}\/\d{1,4}[^\n,.]*/);
  const condoMatch = text.match(/(?:คอนโด|หมู่บ้าน|ซอย|ถ\.|ถนน)[^\s,]+(?:\s+[^\s,]+){0,3}/);
  if (houseNoMatch) {
    address = houseNoMatch[0].trim();
  } else if (condoMatch && /\d+|หมู่บ้าน|คอนโด/.test(condoMatch[0])) {
    address = condoMatch[0].trim();
  }

  const fields: ExtractedFields = {
    customerName,
    phone,
    jobType,
    symptom,
    brand,
    btu,
    preferredDateRaw,
    preferredDateISO,
    dateNeedsConfirmation,
    preferredTime,
    area,
    address,
  };

  return buildExtractionAnalysis(
    text,
    fields,
    'demo',
    'โหมดสาธิต (Demo Mode) — ใช้กฎการแยกข้อความตัวอย่าง ไม่ใช่การเรียก AI จริง'
  );
}
