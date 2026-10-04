import { QURAN_ENTRIES, HADITH_ENTRIES, EXCLUDED } from '../../data/bal-data';
import type { Confidence, Verdict, QuranEntry, HadithEntry, ExcludedEntry } from '../../data/types';
import { classifyWithAI, ALLOWED_AI_VERDICTS, AiClassification } from './classifier';

export interface EvaluationInput {
  word: string;
  position: string;
  userAnswer: string;
  confidence: Confidence;
  noCache?: boolean;
}

export interface EvaluationResult {
  verdict: Verdict;
  decidedBy: 'rule' | 'ai';
  message: string;
  aiNote?: string;
  aiConfidence?: number;
  aiModel?: string;
  quran?: QuranEntry;
  hadith?: HadithEntry;
  excluded?: ExcludedEntry;
  failed?: boolean;
}

export type FoundEntry = {
  type: 'quran' | 'hadith';
  entry: QuranEntry | HadithEntry;
  quran?: QuranEntry;
  hadith?: HadithEntry;
};

/**
 * يحذف الحركات والتطويل ويوحد الألفات ويحذف علامات الترقيم والأقواس ويختصر المسافات
 */
export function normalize(text: string): string {
  if (!text) return '';
  return text
    // U+0610–U+061A, U+064B–U+065F (تنوين وحركات), U+0670 (ألف خنجرية), U+06D6–U+06ED (علامات ضبط ومصاحف)
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // التطويل U+0640
    .replace(/\u0640/g, '')
    // توحيد أ إ آ ٱ إلى ا
    .replace(/[أإآٱ]/g, 'ا')
    // علامات الترقيم والأقواس «» ﴿﴾ () وغيرها
    .replace(/[«»﴿﴾()[\]{}.,،:؛!؟?/\-"'ـ]/g, ' ')
    // اختصار المسافات وقص الأطراف
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * يبحث عن اللفظ في موضعه
 * position صيغته «اسم السورة رقم الآية» مثل «البقرة 46»، أو للحديث «حديث: » متبوعاً بـ takhrij
 */
export function findEntry(word: string, position: string): FoundEntry | null {
  const normWord = normalize(word);
  const cleanPos = (position || '').trim();

  // فحص الأحاديث: إذا بدأ position بـ «حديث»
  const isHadithPos = cleanPos.startsWith('حديث') || cleanPos.includes('حديث:');

  if (isHadithPos) {
    for (const h of HADITH_ENTRIES) {
      const parts = h.word.split('/').map((p) => normalize(p));
      const wordMatches = parts.includes(normWord) || normalize(h.word) === normWord;
      if (wordMatches) {
        return {
          type: 'hadith',
          entry: h,
          hadith: h,
        };
      }
    }
  }

  // فحص القرآن
  // استخراج اسم السورة ورقم الآية من position مثل «البقرة 46» أو «سورة البقرة: 46»
  const cleanSurahAyah = cleanPos
    .replace(/^سورة\s+/, '')
    .replace(/[:،,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = cleanSurahAyah.match(/^(.*?)\s+(\d+)$/);
  const surahNameQuery = match ? normalize(match[1]) : '';
  const ayahNumQuery = match ? parseInt(match[2], 10) : null;

  for (const q of QURAN_ENTRIES) {
    const wordMatches = normalize(q.word) === normWord;
    if (!wordMatches) continue;

    if (ayahNumQuery !== null && surahNameQuery) {
      if (normalize(q.surahName) === surahNameQuery && q.ayahNumber === ayahNumQuery) {
        return {
          type: 'quran',
          entry: q,
          quran: q,
        };
      }
    } else {
      // تطابق اللفظ إن لم يُذكر رقم محدد في الموضع
      return {
        type: 'quran',
        entry: q,
        quran: q,
      };
    }
  }

  // محاولة أخيرة في الأحاديث إن لم يُعثر عليه في القرآن
  for (const h of HADITH_ENTRIES) {
    const parts = h.word.split('/').map((p) => normalize(p));
    const wordMatches = parts.includes(normWord) || normalize(h.word) === normWord;
    if (wordMatches) {
      return {
        type: 'hadith',
        entry: h,
        hadith: h,
      };
    }
  }

  return null;
}

/**
 * فحص الألفاظ المستبعدة
 */
function findExcluded(word: string, position: string): ExcludedEntry | null {
  const normWord = normalize(word);
  const cleanPos = (position || '')
    .replace(/^سورة\s+/, '')
    .replace(/[:،,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = cleanPos.match(/^(.*?)\s+(\d+)$/);
  const surahNameQuery = match ? normalize(match[1]) : '';
  const ayahNumQuery = match ? parseInt(match[2], 10) : null;

  for (const ex of EXCLUDED) {
    if (normalize(ex.word) === normWord) {
      if (surahNameQuery && normalize(ex.surahName) === surahNameQuery) {
        if (ex.ayahNumber === null || ex.ayahNumber === ayahNumQuery) {
          return ex;
        }
      } else if (!surahNameQuery) {
        return ex;
      }
    }
  }
  return null;
}

/**
 * دالة مساعدة لإرجاع نص الرسالة الثابتة لكل حكم
 */
function getMessageForVerdict(verdict: Verdict, found: FoundEntry): string {
  switch (verdict) {
    case 'صحيح':
      return 'فهمك يوافق المعنى المنقول.';
    case 'جزئي':
      return 'فهمك قريب، وفاته شيء من المعنى المنقول.';
    case 'خطأ':
      return 'بَلْ… المعنى في المصدر غير ما فهمت.';
    case 'خطأ واثق':
      return 'بَلْ… كنت متأكداً، والمعنى في المصدر غير ما فهمت. وهذا ما نسميه «الخطأ الواثق».';
    case 'إحالة':
      return 'سؤالك خارج ما يجيب عنه «بَلْ»، فنحن نعرض معنى اللفظ في موضعه فقط. ارجع في الأحكام والتفسير الموسّع وأسباب النزول إلى كتب التفسير وأهل العلم.';
    case 'رفض الاختلاق':
      return 'لا نأتي بحديث أو دليل من عندنا، ولم نجد في مصادرنا ما يطابق طلبك. هذا معنى اللفظ كما نُقل من المصدر.';
    case 'تنبيه على النص':
      if (found.type === 'quran' && (found.entry as QuranEntry).ayahText && (found.entry as QuranEntry).ayahText.trim()) {
        return `في النص الذي كتبته اختلاف عن نص الآية. هذا نصها كما في المصحف: ${(found.entry as QuranEntry).ayahText}`;
      }
      return 'في النص الذي كتبته اختلاف عن نص الآية.';
    case 'إجابة غير صالحة':
      return 'هذه ليست إجابة عن معنى اللفظ، فلا يمكن تصنيفها.';
    case 'ثبات الحكم':
      return 'التصنيف مبني على مقارنة فهمك بنص المصدر، ولا يتغير بالطلب. اكتب فهمك للفظ لنقارنه.';
    default:
      return 'التصنيف مبني على مقارنة فهمك بنص المصدر، ولا يتغير بالطلب. اكتب فهمك للفظ لنقارنه.';
  }
}

/**
 * تقييم إجابة المستخدم
 */
export async function evaluate(input: EvaluationInput): Promise<EvaluationResult> {
  const { word, position, userAnswer, confidence, noCache } = input;
  const trimmedAnswer = (userAnswer || '').trim();
  const normAnswer = normalize(trimmedAnswer);

  // 1. الإجابة فارغة بعد القص، والتأكد ليس «لا أعرف» ← «طلب إدخال».
  if (trimmedAnswer === '' && confidence !== 'لا أعرف') {
    return {
      verdict: 'طلب إدخال',
      decidedBy: 'rule',
      message: 'اكتب ما تفهمه من اللفظ أولاً، أو اختر «لا أعرف».',
    };
  }

  // 2. التأكد «لا أعرف»، أو الإجابة «لا أعرف» بعد normalize ← «لم يُجب»، مع إرفاق اللفظ إن وُجد ليُعرض معناه.
  if (
    confidence === 'لا أعرف' ||
    normAnswer === 'لا اعرف' ||
    normAnswer === 'ما اعرف' ||
    normAnswer === 'لست اعلم'
  ) {
    const foundBefore = findEntry(word, position);
    return {
      verdict: 'لم يُجب',
      decidedBy: 'rule',
      message: 'لا بأس. هذا معنى اللفظ في المصدر.',
      quran: foundBefore?.type === 'quran' ? (foundBefore.entry as QuranEntry) : undefined,
      hadith: foundBefore?.type === 'hadith' ? (foundBefore.entry as HadithEntry) : undefined,
    };
  }

  // 3. شرط الكتابة بالعربية: بعد خطوة «لم يُجب» وقبل البحث عن اللفظ بـ findEntry
  // عُدّ كل الحروف \p{L} وحروف العربية \p{L} مع \p{Script=Arabic}
  const allLetters = trimmedAnswer.match(/\p{L}/gu) || [];
  const arabicLetterRegex = /\p{Script=Arabic}/u;
  const arabicLettersCount = allLetters.filter((ch) => arabicLetterRegex.test(ch)).length;
  const totalLettersCount = allLetters.length;

  if (arabicLettersCount === 0 || arabicLettersCount < totalLettersCount / 2) {
    return {
      verdict: 'طلب إدخال',
      decidedBy: 'rule',
      message: 'اكتب فهمك باللغة العربية.',
    };
  }

  // البحث عن اللفظ في موضعه
  const found = findEntry(word, position);

  // 3. اللفظ غير موجود في موضعه بـ findEntry
  if (!found) {
    const excluded = findExcluded(word, position);
    if (excluded) {
      if (excluded.isDisagreement) {
        return {
          verdict: 'بيان الخلاف',
          decidedBy: 'rule',
          message: `لم نُدرج هذا اللفظ في قائمتنا لاختلاف في معناه: ${excluded.reason} فلا نحكم على فهمك له. ارجع فيه إلى كتب التفسير وأهل العلم.`,
          excluded,
        };
      }
      return {
        verdict: 'امتناع',
        decidedBy: 'rule',
        message:
          'هذا اللفظ في هذا الموضع ليس في قائمة «بَلْ» الموثقة، فلا نحكم على فهمك له ولا نعرض له معنى. يمكنك الرجوع إلى موسوعة التفسير.',
        excluded,
      };
    }

    return {
      verdict: 'امتناع',
      decidedBy: 'rule',
      message:
        'هذا اللفظ في هذا الموضع ليس في قائمة «بَلْ» الموثقة، فلا نحكم على فهمك له ولا نعرض له معنى. يمكنك الرجوع إلى موسوعة التفسير.',
    };
  }

  // 4. اللفظ موجود ← استدعاء classifyWithAI مع مهلة 40 ثانية والتحقق من النتيجة
  const timeoutMs = 40000;
  let aiRawResult: AiClassification | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_40S')), timeoutMs)
    );

    aiRawResult = await Promise.race([
      classifyWithAI(found.entry, trimmedAnswer, noCache),
      timeoutPromise,
    ]);
  } catch (err: any) {
    // إن تأخر الرد أكثر من 25 ثانية أو فشل الاتصال أو حدث تجاوز للحصة
    const isRateOrQuota = err?.error === 'quota' || err?.error === 'rate';
    return {
      verdict: 'امتناع',
      decidedBy: 'rule',
      message: isRateOrQuota
        ? 'بلغ التصنيف الآلي حدّ الاستخدام مؤقتاً. هذا المعنى في المصدر، فقارن فهمك به بنفسك.'
        : 'تعذّر الوصول إلى التصنيف الآلي الآن. هذا المعنى في المصدر، فقارن فهمك به بنفسك.',
      quran: found.type === 'quran' ? (found.entry as QuranEntry) : undefined,
      hadith: found.type === 'hadith' ? (found.entry as HadithEntry) : undefined,
      failed: true,
    };
  }

  // إن جاء verdict خارج القيم المسموحة
  if (!aiRawResult || !ALLOWED_AI_VERDICTS.includes(aiRawResult.verdict)) {
    const isRateOrQuota =
      (aiRawResult as any)?.error === 'quota' ||
      (aiRawResult as any)?.error === 'rate';
    return {
      verdict: 'امتناع',
      decidedBy: 'rule',
      message: isRateOrQuota
        ? 'بلغ التصنيف الآلي حدّ الاستخدام مؤقتاً. هذا المعنى في المصدر، فقارن فهمك به بنفسك.'
        : 'تعذّر الوصول إلى التصنيف الآلي الآن. هذا المعنى في المصدر، فقارن فهمك به بنفسك.',
      quran: found.type === 'quran' ? (found.entry as QuranEntry) : undefined,
      hadith: found.type === 'hadith' ? (found.entry as HadithEntry) : undefined,
      failed: true,
    };
  }

  // إن كان confidence أقل من 0.6 ← «امتناع» برسالة «امتناع لضعف الثقة»
  if (typeof aiRawResult.confidence === 'number' && aiRawResult.confidence < 0.6) {
    return {
      verdict: 'امتناع',
      decidedBy: 'ai',
      message: 'لم نستطع الحكم على إجابتك بثقة كافية. قارن فهمك بنص المصدر بنفسك.',
      aiNote: aiRawResult.note,
      aiConfidence: aiRawResult.confidence,
      aiModel: aiRawResult.model,
      quran: found.type === 'quran' ? (found.entry as QuranEntry) : undefined,
      hadith: found.type === 'hadith' ? (found.entry as HadithEntry) : undefined,
    };
  }

  // إن كان الحكم «خطأ» والتأكد «متأكد» ← «خطأ واثق»
  if (aiRawResult.verdict === 'خطأ' && confidence === 'متأكد') {
    return {
      verdict: 'خطأ واثق',
      decidedBy: 'ai',
      message: 'بَلْ… كنت متأكداً، والمعنى في المصدر غير ما فهمت. وهذا ما نسميه «الخطأ الواثق».',
      aiNote: aiRawResult.note,
      aiConfidence: aiRawResult.confidence,
      aiModel: aiRawResult.model,
      quran: found.type === 'quran' ? (found.entry as QuranEntry) : undefined,
      hadith: found.type === 'hadith' ? (found.entry as HadithEntry) : undefined,
    };
  }

  // غير ذلك: الحكم كما جاء، والرسالة الثابتة لذلك الحكم
  return {
    verdict: aiRawResult.verdict,
    decidedBy: 'ai',
    message: getMessageForVerdict(aiRawResult.verdict, found),
    aiNote: aiRawResult.note,
    aiConfidence: aiRawResult.confidence,
    aiModel: aiRawResult.model,
    quran: found.type === 'quran' ? (found.entry as QuranEntry) : undefined,
    hadith: found.type === 'hadith' ? (found.entry as HadithEntry) : undefined,
  };
}
