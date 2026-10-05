import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  RotateCw,
  Download,
  AlertOctagon,
  Clock,
  Filter,
} from 'lucide-react';
import { CRITICAL_TESTS, CriticalCase } from '../../data/critical-tests';
import { DOCUMENTED_RUN, DocumentedCase } from '../../data/test-runs';
import { GEMINI_MODEL } from '../services/classifier';
import { evaluate, EvaluationResult } from '../services/evaluate';
import type { Confidence, Verdict } from '../../data/types';
import { getVerdictColor } from '../components/AiCommentBox';

export type CaseStatus = 'مطابقة' | 'غير مطابقة' | 'حرج' | 'لم يكتمل';

export interface CaseTestResult {
  id: number;
  expected: string;
  also_acceptable: string;
  verdict: Verdict;
  decidedBy: 'rule' | 'ai';
  aiNote?: string;
  aiConfidence?: number;
  model?: string;
  failed?: boolean;
  status: CaseStatus;
}

export interface TestsRunStorage {
  runDate: string;
  durationMs: number;
  model: string;
  testsVersion: string;
  results: Record<number, CaseTestResult>;
}

const STORAGE_KEY = 'bal.tests.lastRun';

/**
 * تحديد حالة الاختبار وفق قواعد المرحلة 4 بدقة
 */
export function determineCaseStatus(
  c: CriticalCase,
  res: EvaluationResult
): CaseStatus {
  if (res.failed) {
    return 'لم يكتمل';
  }

  const actual = res.verdict;
  const expected = (c.expected || '').trim();
  const also = (c.also_acceptable || '').trim();

  // النتيجة «مطابقة» إن كان الحكم يساوي expected أو also_acceptable
  const isMatch = actual === expected || (also !== '' && actual === also);
  if (isMatch) {
    return 'مطابقة';
  }

  // الخطأ الحرج 1: حَكَم التطبيق «صحيح» أو «جزئي» والمتوقع غير ذلك، ولا يقبل also_acceptable ذلك الحكم
  if (
    (actual === 'صحيح' || actual === 'جزئي') &&
    expected !== 'صحيح' &&
    expected !== 'جزئي' &&
    also !== actual
  ) {
    return 'حرج';
  }

  // الخطأ الحرج 2: المتوقع من أحكام الامتناع والتنبيه وحكم التطبيق صريحاً
  const restrainedVerdicts = [
    'امتناع',
    'إحالة',
    'رفض الاختلاق',
    'بيان الخلاف',
    'إجابة غير صالحة',
    'ثبات الحكم',
    'تنبيه على النص',
  ];
  const activeVerdicts = ['صحيح', 'جزئي', 'خطأ', 'خطأ واثق'];

  if (
    restrainedVerdicts.includes(expected) &&
    activeVerdicts.includes(actual) &&
    also !== actual
  ) {
    return 'حرج';
  }

  return 'غير مطابقة';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatRiyadhDateTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  } catch {
    return dateStr;
  }
}

function renderStatusBadge(status: string | undefined) {
  if (!status) return <span className="text-gray-300">—</span>;
  if (status === 'مطابقة') {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-[#2E7D4F]">
        <span>✓</span>
        <span>مطابقة</span>
      </span>
    );
  }
  if (status === 'حرج') {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-white font-bold bg-[#B42318] text-[11px]">
        حرج
      </span>
    );
  }
  if (status === 'لم يكتمل') {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-white font-medium bg-[#4A6572] text-[11px]">
        لم يكتمل
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[#C05621]">
      <span>✗</span>
      <span>غير مطابقة</span>
    </span>
  );
}

export const TestsPage: React.FC = () => {
  const [results, setResults] = useState<Record<number, CaseTestResult>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [filterNonMatching, setFilterNonMatching] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [confirmFullRunOpen, setConfirmFullRunOpen] = useState(false);

  // بيانات آخر تشغيل محلي
  const [lastRunDate, setLastRunDate] = useState<string | null>(null);
  const [lastRunDurationMs, setLastRunDurationMs] = useState<number | null>(null);

  const stopRequestedRef = useRef(false);

  // استرجاع آخر تشغيل من localStorage عند الفتح
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: TestsRunStorage = JSON.parse(saved);
        if (parsed && parsed.results) {
          setResults(parsed.results);
          setLastRunDate(parsed.runDate);
          setLastRunDurationMs(parsed.durationMs);
        }
      }
    } catch {
      // تجاهل أخطاء التخزين
    }
  }, []);

  const cases = CRITICAL_TESTS.cases || [];

  // خريطة الحالات الموثقة بالـ id
  const docCasesMap = useMemo(() => {
    const map = new Map<number, DocumentedCase>();
    if (DOCUMENTED_RUN.cases && Array.isArray(DOCUMENTED_RUN.cases)) {
      for (const dc of DOCUMENTED_RUN.cases) {
        map.set(dc.id, dc);
      }
    }
    return map;
  }, []);

  const hasDocumentedRun =
    Boolean(DOCUMENTED_RUN.cases && DOCUMENTED_RUN.cases.length > 0);

  // إحصائيات الملخص لتشغيل المستخدم الحالي
  const userSummaryStats = useMemo(() => {
    const evaluatedResults = Object.values(results);
    const totalCases = cases.length;
    const evaluatedCount = evaluatedResults.length;

    const matched = evaluatedResults.filter((r) => r.status === 'مطابقة').length;
    const critical = evaluatedResults.filter((r) => r.status === 'حرج').length;
    const incomplete = evaluatedResults.filter((r) => r.status === 'لم يكتمل').length;
    const nonMatching = evaluatedResults.filter((r) => r.status === 'غير مطابقة').length;

    const completed = matched + critical + nonMatching;
    const matchPercentage =
      completed > 0 ? Math.round((matched / completed) * 100) : 0;

    return {
      totalCases,
      evaluatedCount,
      completed,
      matched,
      critical,
      incomplete,
      nonMatching,
      matchPercentage,
    };
  }, [results, cases.length]);

  // تشغيل حالة واحدة مع إعادة المحاولة حتى 3 مرات
  const runSingleCase = async (c: CriticalCase): Promise<CaseTestResult> => {
    let attempt = 0;
    let evalRes: EvaluationResult | null = null;

    while (attempt < 3) {
      if (stopRequestedRef.current) break;
      attempt++;

      evalRes = await evaluate({
        word: c.word,
        position: c.position,
        userAnswer: c.user_answer,
        confidence: c.confidence as Confidence,
        noCache: true,
      });

      if (!evalRes.failed) {
        break;
      }

      // إن فشلت النتيجة وكان هناك محاولات متبقية، ننتظر 20 ثانية
      if (attempt < 3 && !stopRequestedRef.current) {
        setStatusMessage(
          `فشل الاتصال بالحالة ${c.id}، إعادة المحاولة ${attempt + 1}/3 بعد 20 ثانية…`
        );
        for (let sec = 0; sec < 20; sec++) {
          if (stopRequestedRef.current) break;
          await sleep(1000);
        }
      }
    }

    if (!evalRes) {
      evalRes = {
        verdict: 'امتناع',
        decidedBy: 'rule',
        message: 'تم إيقاف التشغيل.',
        failed: true,
      };
    }

    const status = determineCaseStatus(c, evalRes);

    const testRes: CaseTestResult = {
      id: c.id,
      expected: c.expected,
      also_acceptable: c.also_acceptable,
      verdict: evalRes.verdict,
      decidedBy: evalRes.decidedBy,
      aiNote: evalRes.aiNote,
      aiConfidence: evalRes.aiConfidence,
      model: evalRes.aiModel,
      failed: evalRes.failed,
      status,
    };

    return testRes;
  };

  // تشغيل كل الحالات
  const handleRunAll = async () => {
    if (cases.length === 0 || isRunning) return;

    setIsRunning(true);
    stopRequestedRef.current = false;
    const startTime = Date.now();
    const updatedResults = { ...results };

    try {
      for (let i = 0; i < cases.length; i++) {
        if (stopRequestedRef.current) {
          setStatusMessage('تم إيقاف التشغيل بناءً على طلبك.');
          break;
        }

        const c = cases[i];
        setCurrentRunningIndex(i + 1);
        setStatusMessage(`جارٍ تقييم الحالة ${c.id} (${c.word})…`);

        const res = await runSingleCase(c);
        updatedResults[c.id] = res;
        setResults({ ...updatedResults });

        // حفظ دوري
        const duration = Date.now() - startTime;
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              runDate: new Date().toISOString(),
              durationMs: duration,
              model: GEMINI_MODEL,
              testsVersion: CRITICAL_TESTS.version || '1.0',
              results: updatedResults,
            })
          );
        } catch {}

        // انتظر 3 ثوانٍ بين كل حالة والتي بعدها
        if (i < cases.length - 1 && !stopRequestedRef.current) {
          for (let sec = 3; sec > 0; sec--) {
            if (stopRequestedRef.current) break;
            setStatusMessage(`انتظار ${sec} ثوانٍ قبل الحالة التالية…`);
            await sleep(1000);
          }
        }
      }

      const totalDuration = Date.now() - startTime;
      setLastRunDurationMs(totalDuration);
      setLastRunDate(new Date().toISOString());

      if (!stopRequestedRef.current) {
        setStatusMessage('اكتمل تشغيل جميع الحالات بنجاح.');
      }
    } finally {
      setIsRunning(false);
      setCurrentRunningIndex(null);
    }
  };

  // إيقاف التشغيل
  const handleStop = () => {
    stopRequestedRef.current = true;
    setStatusMessage('جارٍ إيقاف التشغيل…');
  };

  // تشغيل حالة مفردة
  const handleRerunCase = async (c: CriticalCase) => {
    if (isRunning) return;
    setRetryingId(c.id);
    setStatusMessage(`جارٍ تشغيل الحالة ${c.id}…`);

    try {
      const res = await runSingleCase(c);
      const newResults = { ...results, [c.id]: res };
      setResults(newResults);

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            runDate: lastRunDate || new Date().toISOString(),
            durationMs: lastRunDurationMs || 0,
            model: GEMINI_MODEL,
            testsVersion: CRITICAL_TESTS.version || '1.0',
            results: newResults,
          })
        );
      } catch {}

      setStatusMessage(`اكتمل تشغيل الحالة ${c.id}.`);
    } finally {
      setRetryingId(null);
    }
  };

  // تنزيل نتائج تشغيل المستخدم الحالية
  const handleDownloadUserJson = () => {
    const dataToExport = {
      runDate: lastRunDate || new Date().toISOString(),
      model: GEMINI_MODEL,
      testsVersion: CRITICAL_TESTS.version || '',
      summary: userSummaryStats,
      cases: cases.map((c) => {
        const r = results[c.id];
        return {
          id: c.id,
          category: c.category,
          content_level: c.content_level,
          word: c.word,
          position: c.position,
          source_text: c.source_text,
          user_answer: c.user_answer,
          confidence: c.confidence,
          expected: c.expected,
          also_acceptable: c.also_acceptable,
          verdict: r ? r.verdict : null,
          decidedBy: r ? r.decidedBy : null,
          model: r?.model || (r?.decidedBy === 'rule' ? 'قاعدة' : null),
          aiNote: r?.aiNote || '',
          aiConfidence: r?.aiConfidence ?? null,
          status: r ? r.status : null,
        };
      }),
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bal-tests-user-run-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // تنزيل النتيجة الموثقة كما هي
  const handleDownloadDocumentedJson = () => {
    const blob = new Blob([JSON.stringify(DOCUMENTED_RUN, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bal-documented-test-run.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // تصفية الحالات المعروضة في الجدول
  const displayedCases = useMemo(() => {
    if (!filterNonMatching) return cases;
    return cases.filter((c) => {
      const userRes = results[c.id];
      const docCase = docCasesMap.get(c.id);
      if (userRes) {
        return userRes.status !== 'مطابقة';
      }
      if (docCase) {
        return docCase.status !== 'مطابقة';
      }
      return true;
    });
  }, [cases, results, docCasesMap, filterNonMatching]);

  // تنسيق المدة
  const formatDuration = (ms: number) => {
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min === 0) return `${sec} ثانية`;
    return `${min} دقيقة و${sec} ثانية`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-right">
      {/* 1. الترويسة الرئيسية */}
      <div className="mb-8">
        <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#1F5F5B] mb-2">
          اختبار الحالات الحرجة
        </h1>
        <p className="text-base text-[#1D2B2A] leading-relaxed">
          50 حالة تختبر موثوقية التصنيف قبل التجربة مع المستخدمين: إجابات صحيحة بصياغات مختلفة، وأخطاء واثقة، وإجابات جزئية، وألفاظ ليست في القائمة، وأسئلة خارج النطاق، ومحاولات لتوجيه النموذج. تمر كل حالة بالمسار نفسه الذي تمر به إجابة المستخدم.
        </p>
      </div>

      {/* أ. النتيجة الموثقة (تظهر أولاً إن كان الملف يحتوي على حالات) */}
      {hasDocumentedRun && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#1F5F5B]/20 shadow-xs mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="font-amiri text-2xl font-bold text-[#1F5F5B] mb-1">
                النتيجة الموثقة
              </h2>
              <p className="text-sm text-[#5B6B6B] leading-relaxed">
                تشغيل موثق للحالات الخمسين، بتاريخ{' '}
                <span className="font-medium text-[#1D2B2A] font-sans">
                  {formatRiyadhDateTime(DOCUMENTED_RUN.runDate)}
                </span>{' '}
                (بتوقيت الرياض)، والنموذج:{' '}
                <span className="font-mono text-[#1F5F5B] font-semibold">
                  {DOCUMENTED_RUN.model}
                </span>
                ، وإصدار الحالات:{' '}
                <span className="font-medium text-[#1D2B2A]">
                  {DOCUMENTED_RUN.testsVersion}
                </span>
                .
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadDocumentedJson}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FAF7F0] hover:bg-[#1F5F5B]/10 text-[#1F5F5B] border border-[#1F5F5B]/30 font-semibold rounded-lg text-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>نزّل النتيجة الموثقة (JSON)</span>
            </button>
          </div>

          {/* بطاقات ملخص النتيجة الموثقة */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                نسبة المطابقة
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#1F5F5B]">
                {DOCUMENTED_RUN.summary.matchPercentage}%
              </div>
            </div>

            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                المطابقة
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#2E7D4F]">
                {DOCUMENTED_RUN.summary.matched} من{' '}
                {DOCUMENTED_RUN.summary.completed || DOCUMENTED_RUN.summary.totalCases}
              </div>
            </div>

            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                الأخطاء الحرجة
              </div>
              <div
                className={`text-2xl sm:text-3xl font-bold ${
                  DOCUMENTED_RUN.summary.critical > 0
                    ? 'text-[#B42318]'
                    : 'text-[#5B6B6B]'
                }`}
              >
                {DOCUMENTED_RUN.summary.critical}
              </div>
            </div>

            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                لم يكتمل
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#4A6572]">
                {DOCUMENTED_RUN.summary.incomplete}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ج. ملخص تشغيل الزائر الآن (يظهر بعد إجراء أي تقييم محلي) */}
      {Object.keys(results).length > 0 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#1F5F5B]/20 shadow-xs mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-1">
                تشغيلك الآن
              </h2>
              {lastRunDate && (
                <div className="text-xs text-[#5B6B6B] font-sans">
                  تاريخ التشغيل: {formatRiyadhDateTime(lastRunDate)} (بتوقيت الرياض)
                  {lastRunDurationMs !== null && (
                    <span> · مدة التشغيل: {formatDuration(lastRunDurationMs)}</span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadUserJson}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-black/5 text-[#1D2B2A] border border-[#1F5F5B]/20 font-medium rounded-lg text-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#1F5F5B]" />
              <span>نزّل نتائج التشغيل (JSON)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                نسبة المطابقة
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#1F5F5B]">
                {userSummaryStats.matchPercentage}%
              </div>
            </div>

            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                المطابقة
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#2E7D4F]">
                {userSummaryStats.matched} من {userSummaryStats.completed}
              </div>
            </div>

            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                الأخطاء الحرجة
              </div>
              <div
                className={`text-2xl sm:text-3xl font-bold ${
                  userSummaryStats.critical > 0 ? 'text-[#B42318]' : 'text-[#5B6B6B]'
                }`}
              >
                {userSummaryStats.critical}
              </div>
            </div>

            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/15 text-center">
              <div className="text-xs text-[#5B6B6B] font-semibold mb-1">
                لم يكتمل
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#4A6572]">
                {userSummaryStats.incomplete}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ب. جدول الحالات */}
      <div className="space-y-4 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A]">
            تفاصيل الحالات ({displayedCases.length})
          </h2>

          <label className="flex items-center gap-2 text-xs sm:text-sm text-[#1D2B2A] cursor-pointer bg-white px-3 py-2 rounded-lg border border-[#1F5F5B]/20">
            <Filter className="w-4 h-4 text-[#1F5F5B]" />
            <input
              type="checkbox"
              checked={filterNonMatching}
              onChange={(e) => setFilterNonMatching(e.target.checked)}
              className="rounded text-[#1F5F5B] focus:ring-[#1F5F5B]"
            />
            <span>اعرض غير المطابقة فقط</span>
          </label>
        </div>

        <div className="bg-white rounded-xl border border-[#1F5F5B]/15 overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-[#FAF7F0] border-b border-[#1F5F5B]/20 text-[#1D2B2A]">
                  <th className="p-3 font-semibold w-12 text-center">#</th>
                  <th className="p-3 font-semibold">الفئة</th>
                  <th className="p-3 font-semibold">المستوى</th>
                  <th className="p-3 font-semibold">اللفظ</th>
                  <th className="p-3 font-semibold">الموضع</th>
                  <th className="p-3 font-semibold min-w-[140px]">إجابة المستخدم</th>
                  <th className="p-3 font-semibold">التأكد</th>
                  <th className="p-3 font-semibold min-w-[120px]">المتوقع</th>
                  <th className="p-3 font-semibold min-w-[130px]">الحكم الموثق</th>
                  <th className="p-3 font-semibold min-w-[130px]">الحكم الآن</th>
                  <th className="p-3 font-semibold">المصدر</th>
                  <th className="p-3 font-semibold min-w-[160px]">تعليق Gemini</th>
                  <th className="p-3 font-semibold text-center w-28">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedCases.map((c) => {
                  const docCase = docCasesMap.get(c.id);
                  const res = results[c.id];
                  const isRetrying = retryingId === c.id;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        (res?.status === 'حرج' || (!res && docCase?.status === 'حرج'))
                          ? 'bg-red-50/30'
                          : (res?.status === 'غير مطابقة' || (!res && docCase?.status === 'غير مطابقة'))
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* الرقم */}
                      <td className="p-3 text-center font-mono font-medium text-gray-500">
                        {c.id}
                      </td>

                      {/* الفئة */}
                      <td className="p-3 text-xs text-[#5B6B6B] whitespace-nowrap">
                        {c.category}
                      </td>

                      {/* المستوى */}
                      <td className="p-3 text-xs text-[#5B6B6B] whitespace-nowrap">
                        {c.content_level}
                      </td>

                      {/* اللفظ */}
                      <td className="p-3 font-amiri text-base font-bold text-[#1F5F5B] whitespace-nowrap">
                        {c.word}
                      </td>

                      {/* الموضع */}
                      <td className="p-3 text-xs text-[#5B6B6B] whitespace-nowrap">
                        {c.position}
                      </td>

                      {/* إجابة المستخدم */}
                      <td className="p-3 text-xs text-[#1D2B2A] max-w-[200px]">
                        {c.user_answer}
                      </td>

                      {/* التأكد */}
                      <td className="p-3 text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {c.confidence}
                        </span>
                      </td>

                      {/* المتوقع */}
                      <td className="p-3 text-xs font-semibold whitespace-nowrap">
                        <span className="text-[#1D2B2A]">{c.expected}</span>
                        {c.also_acceptable && (
                          <span className="text-[#5B6B6B] font-normal block text-[11px]">
                            أو {c.also_acceptable}
                          </span>
                        )}
                      </td>

                      {/* الحكم الموثق */}
                      <td className="p-3 text-xs whitespace-nowrap">
                        {docCase ? (
                          <div className="flex flex-col gap-1">
                            <span
                              className="px-2 py-0.5 rounded-sm font-bold w-fit"
                              style={{
                                color: getVerdictColor(docCase.verdict as Verdict),
                                backgroundColor: `${getVerdictColor(docCase.verdict as Verdict)}15`,
                              }}
                            >
                              {docCase.verdict}
                            </span>
                            <div>{renderStatusBadge(docCase.status)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* الحكم الآن */}
                      <td className="p-3 text-xs whitespace-nowrap">
                        {res ? (
                          <div className="flex flex-col gap-1">
                            <span
                              className="px-2 py-0.5 rounded-sm font-bold w-fit"
                              style={{
                                color: getVerdictColor(res.verdict),
                                backgroundColor: `${getVerdictColor(res.verdict)}15`,
                              }}
                            >
                              {res.verdict}
                            </span>
                            <div>{renderStatusBadge(res.status)}</div>
                            {res.model && (
                              <span className="text-[11px] font-mono text-[#5B6B6B]">
                                {res.model}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* مصدر الحكم */}
                      <td className="p-3 text-xs whitespace-nowrap">
                        {res ? (
                          <span className="text-gray-600">
                            {res.decidedBy === 'ai' ? 'Gemini' : 'قاعدة'}
                          </span>
                        ) : docCase ? (
                          <span className="text-gray-600">
                            {docCase.decidedBy === 'ai' ? 'Gemini' : 'قاعدة'}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* تعليق Gemini */}
                      <td className="p-3 text-xs text-[#5B6B6B] max-w-[240px] leading-relaxed">
                        {res?.aiNote ? (
                          res.aiNote
                        ) : docCase?.aiNote ? (
                          docCase.aiNote
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* زر تشغيل هذه الحالة وحدها */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRerunCase(c)}
                          disabled={isRunning || isRetrying}
                          title="شغّل هذه الحالة وحدها"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1F5F5B]/30 hover:bg-[#1F5F5B]/10 text-[#1F5F5B] text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RotateCw
                            className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`}
                          />
                          <span>شغّل هذه الحالة</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ج. التشغيل الكامل في آخر الصفحة */}
      <div className="mt-8 pt-8 border-t border-[#1F5F5B]/15 flex flex-col items-center justify-center gap-4 text-center">
        {!isRunning ? (
          <button
            type="button"
            onClick={() => setConfirmFullRunOpen(true)}
            disabled={cases.length === 0}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold rounded-xl text-base shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>شغّل الحالات الخمسين كلها</span>
          </button>
        ) : (
          <div className="w-full max-w-xl space-y-4">
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>أوقف التشغيل</span>
            </button>

            {statusMessage && (
              <div className="text-sm font-semibold text-[#5B6B6B]">
                {statusMessage}
              </div>
            )}

            {currentRunningIndex !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#5B6B6B] font-medium">
                  <span>جارٍ التشغيل…</span>
                  <span>
                    الحالة {currentRunningIndex} من {cases.length}
                  </span>
                </div>
                <div className="w-full bg-[#FAF7F0] border border-[#1F5F5B]/20 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#1F5F5B] h-full transition-all duration-300"
                    style={{
                      width: `${(currentRunningIndex / cases.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* نافذة التأكيد للتشغيل الكامل */}
      {confirmFullRunOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl border border-[#1F5F5B]/20 text-right space-y-5">
            <div className="flex items-center gap-3 text-[#B7791F]">
              <AlertOctagon className="w-6 h-6 shrink-0" />
              <h3 className="font-amiri text-2xl font-bold text-[#1D2B2A]">
                تأكيد تشغيل الحالات كلها
              </h3>
            </div>
            <p className="text-base text-[#1D2B2A] leading-relaxed">
              يرسل التشغيل الكامل 42 طلباً للتصنيف الآلي، ويستغرق بضع دقائق. ويمكنك بدلاً من ذلك تشغيل أي حالة بمفردها. هل تريد المتابعة؟
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmFullRunOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmFullRunOpen(false);
                  handleRunAll();
                }}
                className="px-6 py-2.5 rounded-lg bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
              >
                تابع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
