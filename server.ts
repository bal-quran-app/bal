import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI, Type } from '@google/genai';
import { QURAN_ENTRIES, HADITH_ENTRIES } from './data/bal-data';
import {
  GEMINI_MODELS,
  CLASSIFIER_INSTRUCTION,
  ALLOWED_AI_VERDICTS,
  buildClassifierPrompt,
  normalize,
} from './src/services/classifierShared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 1. تتبع معدل طلبات IP (30 طلباً في الدقيقة)
// ==========================================
const ipRateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // دقيقة واحدة
  const timestamps = ipRateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= 30) {
    ipRateLimitMap.set(ip, recent);
    return false;
  }

  recent.push(now);
  ipRateLimitMap.set(ip, recent);
  return true;
}

// ==========================================
// 2. تتبع توفر النماذج ومواعيد انتهاء حظرها
// ==========================================
const modelUnavailableUntil = new Map<string, number>();

function isModelAvailable(modelName: string): boolean {
  const until = modelUnavailableUntil.get(modelName);
  if (!until) return true;
  if (Date.now() >= until) {
    modelUnavailableUntil.delete(modelName);
    return true;
  }
  return false;
}

function getNext0700Utc(): number {
  const now = new Date();
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 0, 0, 0)
  );
  if (now.getTime() >= target.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime();
}

function markModelUnavailable(modelName: string, isDailyQuota: boolean) {
  const until = isDailyQuota ? getNext0700Utc() : Date.now() + 65 * 1000;
  modelUnavailableUntil.set(modelName, until);
  const reason = isDailyQuota ? 'حصة يومية حتى 07:00 UTC' : 'مؤقت لـ 65 ثانية';
  console.log(`Model [${modelName}] marked unavailable (${reason})`);
}

// ==========================================
// 3. ذاكرة التخزين المؤقت في الخادم
// ==========================================
interface CacheEntry {
  verdict: string;
  confidence: number;
  note: string;
  model: string;
  expiresAt: number;
}

const classificationCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 5000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 أيام

function getFromCache(key: string): CacheEntry | null {
  const entry = classificationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    classificationCache.delete(key);
    return null;
  }
  return entry;
}

function saveToCache(key: string, entry: Omit<CacheEntry, 'expiresAt'>) {
  if (classificationCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = classificationCache.keys().next().value;
    if (oldestKey) classificationCache.delete(oldestKey);
  }
  classificationCache.set(key, {
    ...entry,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ==========================================
// 4. استدعاء OpenRouter كطريق أساسي للتصنيف
// ==========================================
async function callOpenRouter(
  entry: any,
  userAnswer: string
): Promise<{ verdict: string; confidence: number; note: string } | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return null;
  }

  const prompt = buildClassifierPrompt(entry, userAnswer);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bal-quran.ai.studio',
        'X-Title': 'bal',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.8-flash',
        messages: [
          { role: 'system', content: CLASSIFIER_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'classification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                verdict: {
                  type: 'string',
                  enum: [
                    'صحيح',
                    'جزئي',
                    'خطأ',
                    'إحالة',
                    'رفض الاختلاق',
                    'تنبيه على النص',
                    'إجابة غير صالحة',
                    'ثبات الحكم',
                  ],
                },
                confidence: { type: 'number' },
                note: { type: 'string' },
              },
              required: ['verdict', 'confidence', 'note'],
              additionalProperties: false,
            },
          },
        },
        provider: { require_parameters: true },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let sanitized = errText;
      if (openRouterKey) {
        sanitized = sanitized.split(openRouterKey).join('[REDACTED]');
      }
      sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
      console.error(
        `OpenRouter failed [status ${res.status}]: ${sanitized.slice(0, 200)}`
      );
      return null;
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('OpenRouter failed: empty message content');
      return null;
    }

    const parsed = JSON.parse(content);
    if (
      !ALLOWED_AI_VERDICTS.includes(parsed.verdict) ||
      typeof parsed.confidence !== 'number'
    ) {
      console.error(
        `OpenRouter failed: invalid schema response [verdict=${parsed.verdict}, confidence=${parsed.confidence}]`
      );
      return null;
    }

    return {
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      note: parsed.note || '',
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    let rawMsg = String(err?.message || err || 'timeout');
    if (openRouterKey) {
      rawMsg = rawMsg.split(openRouterKey).join('[REDACTED]');
    }
    rawMsg = rawMsg.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
    console.error(`OpenRouter error: ${rawMsg.slice(0, 200)}`);
    return null;
  }
}

// تنظيف دوري للذاكرة كل 10 دقائق
setInterval(() => {
  const now = Date.now();
  // تنظيف IP
  for (const [ip, times] of ipRateLimitMap.entries()) {
    const valid = times.filter((t) => now - t < 60 * 1000);
    if (valid.length === 0) ipRateLimitMap.delete(ip);
    else ipRateLimitMap.set(ip, valid);
  }
  // تنظيف الكاش منتهي الصلاحية
  for (const [key, item] of classificationCache.entries()) {
    if (now > item.expiresAt) {
      classificationCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '64kb' }));

  // مسار التصنيف
  app.post('/api/classify', async (req, res) => {
    // 1. فحص معدل الطلبات لكل IP: 30 طلباً في الدقيقة
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown';

    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'rate' });
    }

    // 2. التحقق من المدخلات: kind, id, userAnswer (<= 300 حرف)
    const { kind, id, userAnswer, noCache } = req.body || {};

    if (
      (kind !== 'quran' && kind !== 'hadith') ||
      typeof id !== 'string' ||
      !id.trim() ||
      typeof userAnswer !== 'string' ||
      userAnswer.length > 300
    ) {
      return res.status(400).json({ error: 'invalid_input' });
    }

    // 3. التحقق من وجود اللفظ في القائمة المعتمدة
    const entry =
      kind === 'quran'
        ? QURAN_ENTRIES.find((q) => q.id === id)
        : HADITH_ENTRIES.find((h) => h.id === id);

    if (!entry) {
      return res.status(400).json({ error: 'entry_not_found' });
    }

    // 4. فحص الذاكرة المؤقتة (ما لم يُطلب noCache: true)
    const cacheKey = `${kind}:${id}:${normalize(userAnswer)}`;
    if (!noCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return res.json({
          verdict: cached.verdict,
          confidence: cached.confidence,
          note: cached.note,
          model: cached.model,
          cached: true,
        });
      }
    }

    // 5. محاولة التصنيف عبر OpenRouter كطريق أساسي (إن توفر المفتاح)
    if (process.env.OPENROUTER_API_KEY) {
      const openRouterResult = await callOpenRouter(entry, userAnswer);
      if (openRouterResult) {
        saveToCache(cacheKey, {
          verdict: openRouterResult.verdict,
          confidence: openRouterResult.confidence,
          note: openRouterResult.note,
          model: 'gemini-3.8-flash (OpenRouter)',
        });

        return res.json({
          verdict: openRouterResult.verdict,
          confidence: openRouterResult.confidence,
          note: openRouterResult.note,
          model: 'gemini-3.8-flash (OpenRouter)',
          cached: false,
        });
      }
    }

    // 6. الاحتياط: استدعاء النماذج بالترتيب من سلسلة GEMINI_MODELS
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Server Configuration Error: GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'failed' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contents = buildClassifierPrompt(entry, userAnswer);
    let lastError: any = null;
    let anyModelAttempted = false;

    for (const modelName of GEMINI_MODELS) {
      // تخطي النماذج المعلَّمة غير متاحة حالياً
      if (!isModelAvailable(modelName)) {
        continue;
      }

      anyModelAttempted = true;

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: CLASSIFIER_INSTRUCTION,
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verdict: {
                  type: Type.STRING,
                  enum: [
                    'صحيح',
                    'جزئي',
                    'خطأ',
                    'إحالة',
                    'رفض الاختلاق',
                    'تنبيه على النص',
                    'إجابة غير صالحة',
                    'ثبات الحكم',
                  ],
                },
                confidence: {
                  type: Type.NUMBER,
                },
                note: {
                  type: Type.STRING,
                },
              },
              required: ['verdict', 'confidence', 'note'],
            },
          },
        });

        const text = response.text || '{}';
        const parsed = JSON.parse(text);

        const verdict = parsed.verdict;
        const confidence =
          typeof parsed.confidence === 'number' ? parsed.confidence : 0;
        const note = parsed.note || '';

        // حفظ في الكاش عند النجاح
        saveToCache(cacheKey, {
          verdict,
          confidence,
          note,
          model: modelName,
        });

        return res.json({
          verdict,
          confidence,
          note,
          model: modelName,
          cached: false,
        });
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.statusCode || 500;
        let rawMsg = String(err?.message || err || '');

        if (apiKey) {
          rawMsg = rawMsg.split(apiKey).join('[REDACTED]');
        }
        rawMsg = rawMsg.replace(/key=[^&\s]+/gi, 'key=[REDACTED]');

        console.error(
          `Model [${modelName}] failed [code: ${status}]: ${rawMsg.slice(0, 150)}`
        );

        const is429or503 =
          status === 429 ||
          status === 503 ||
          rawMsg.includes('RESOURCE_EXHAUSTED') ||
          rawMsg.includes('429') ||
          rawMsg.includes('503');

        if (is429or503) {
          const isDaily =
            rawMsg.includes('PerDay') ||
            rawMsg.includes('Daily') ||
            rawMsg.includes('free_tier_requests') ||
            rawMsg.includes('PerProjectPerModel-FreeTier');

          markModelUnavailable(modelName, isDaily);
          // الانتقال فوراً للنموذج التالي
          continue;
        } else {
          // خطأ آخر غير 429 وغير 503 ← لا نكمل ونرجع failed
          return res.status(500).json({ error: 'failed' });
        }
      }
    }

    // إذا لم يبق نموذج متاح أو نفدت جميع النماذج
    console.error('All Gemini models exhausted or unavailable');
    return res.status(429).json({ error: 'quota' });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
