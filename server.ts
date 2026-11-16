import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

app.get('/api/ai/status', (_req, res) => {
  res.json({
    configured: isGeminiConfigured(),
    model: isGeminiConfigured() ? 'gemini-4-hydrogen' : null,
  });
});

app.post('/api/ai/parse-line-message', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!message) {
    res.status(400).json({ error: 'กรุณาวางข้อความจากลูกค้าก่อนวิเคราะห์' });
    return;
  }

  if (!isGeminiConfigured()) {
    res.status(200).json({
      available: false,
      reason: 'NO_API_KEY',
    });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const todayISO = new Date().toISOString().slice(0, 10);

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `ข้อความลูกค้าจาก LINE:\n"""\n${message}\n"""`,
      config: {
        systemInstruction: [
          `คุณคือระบบผู้ช่วยช่างแอร์อิสระในประเทศไทย ทำหน้าที่แยกข้อมูลสำคัญจากข้อความแชท LINE ของลูกค้าให้เป็นข้อมูลใบงานที่มีโครงสร้างชัดเจน`,
          `วันที่ปัจจุบันคือ ${todayISO}`,
          `กฎเหล็กที่ต้องปฏิบัติอย่างเคร่งครัด:`,
          `1. ห้ามเดาหรือแต่งข้อมูลที่ลูกค้าไม่ได้ระบุในข้อความเด็ดขาด หากไม่มีข้อมูลให้ใส่ค่าเป็น null`,
          `2. ห้ามสมมติชื่อลูกค้า เบอร์โทร บ้านเลขที่ หรือยี่ห้อแอร์เอง`,
          `3. หากลูกค้าระบุวันแบบไม่เจาะจงวันที่ เช่น "วันเสาร์", "พรุ่งนี้", "อาทิตย์หน้า" โดยไม่มีวันที่ชัดเจน ให้ใส่ preferredDateRaw ตามคำที่ลูกค้าพิมพ์, ตั้ง preferredDateISO เป็น null และตั้ง dateNeedsConfirmation เป็น true`,
          `4. หากลูกค้าระบุเพียงย่าน/พื้นที่ เช่น "แถวบางนา" แต่ไม่ระบุบ้านเลขที่/ซอย/หมู่บ้าน/คอนโด ให้ใส่ area = "บางนา" และ address = null (ห้ามคัดลอกพื้นที่ไปเป็น address)`,
          `5. jobType ให้เลือกจาก: "ล้างแอร์", "ซ่อมแอร์ / ตรวจเช็ค", "เติมน้ำยาแอร์", "ติดตั้งแอร์", "ย้ายแอร์", "อื่นๆ" หรือ null หากยังไม่ชัดเจน`,
          `6. suggestedQuestions ให้สร้างคำถามภาษาไทยที่สุภาพ สั้น กระชับ สำหรับส่งถามลูกค้ากลับทาง LINE เฉพาะเรื่องที่ยังขาดหรือไม่แน่ใจ`,
        ].join('\n'),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, nullable: true },
            phone: { type: Type.STRING, nullable: true },
            jobType: { type: Type.STRING, nullable: true },
            symptom: { type: Type.STRING, nullable: true },
            brand: { type: Type.STRING, nullable: true },
            btu: { type: Type.STRING, nullable: true },
            preferredDateRaw: { type: Type.STRING, nullable: true },
            preferredDateISO: { type: Type.STRING, nullable: true },
            dateNeedsConfirmation: { type: Type.BOOLEAN },
            preferredTime: { type: Type.STRING, nullable: true },
            area: { type: Type.STRING, nullable: true },
            address: { type: Type.STRING, nullable: true },
            uncertainFields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  label: { type: Type.STRING },
                  rawValue: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['key', 'label', 'rawValue', 'reason'],
              },
            },
            suggestedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['dateNeedsConfirmation', 'suggestedQuestions', 'uncertainFields'],
        },
      },
    });

    const parsedText = (response.text ?? '{}').trim();
    const data = JSON.parse(parsedText);

    res.json({
      available: true,
      mode: 'gemini',
      data,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({
      available: true,
      error: 'ไม่สามารถเชื่อมต่อ Gemini AI ได้ในขณะนี้ กรุณาลองใหม่หรือสลับใช้โหมดสาธิต',
      details: errMsg,
    });
  }
});

async function startServer() {
  const port = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ServiceFlow AI server running at http://localhost:${port}`);
  });
}

startServer();
