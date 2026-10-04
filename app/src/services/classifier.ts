import type { QuranEntry, HadithEntry, Verdict } from '../../data/types';
import {
  GEMINI_MODELS,
  GEMINI_MODEL,
  CLASSIFIER_INSTRUCTION,
  ALLOWED_AI_VERDICTS,
  AiClassification,
  buildClassifierPrompt,
  normalize,
} from './classifierShared';

export {
  GEMINI_MODELS,
  GEMINI_MODEL,
  CLASSIFIER_INSTRUCTION,
  ALLOWED_AI_VERDICTS,
  buildClassifierPrompt,
  normalize,
};
export type { AiClassification };

/**
 * تصنيف فهم المستخدم بواسطة الذكاء الاصطناعي عبر مسار الخادم /api/classify
 * بمهلة 40 ثانية، وبدون استعمال أي مفتاح أو حزم SDK في المتصفح
 */
export async function classifyWithAI(
  entry: QuranEntry | HadithEntry,
  userAnswer: string,
  noCache?: boolean
): Promise<AiClassification & { error?: string; failed?: boolean }> {
  const kind = 'surahName' in entry ? 'quran' : 'hadith';
  const id = entry.id;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000);

  try {
    const response = await fetch('/api/classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind,
        id,
        userAnswer,
        noCache: Boolean(noCache),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      const errType =
        data.error === 'quota' || data.error === 'rate' ? data.error : 'failed';
      const err = new Error(errType) as any;
      err.error = errType;
      err.failed = true;
      throw err;
    }

    return {
      verdict: data.verdict as Verdict,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      note: data.note || '',
      model: data.model,
      cached: Boolean(data.cached),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err && err.error) {
      throw err;
    }

    const failureErr = new Error('failed') as any;
    failureErr.error = 'failed';
    failureErr.failed = true;
    throw failureErr;
  }
}
