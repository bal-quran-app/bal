import React, { useState } from 'react';
import { RefreshCw, ArrowLeft, Eye, CheckCircle } from 'lucide-react';
import { QURAN_ENTRIES, HADITH_ENTRIES } from '../../data/bal-data';
import type { QuranEntry, HadithEntry, Confidence, Verdict } from '../../data/types';
import { evaluate, EvaluationResult } from '../services/evaluate';
import { getProgress, saveSession, getTodayString } from '../services/storage';
import { SourceQuoteBox } from '../components/SourceQuoteBox';
import { AiCommentBox, getVerdictColor } from '../components/AiCommentBox';
import { AyahDisplay } from '../components/AyahDisplay';

export type JourneyItem =
  | { type: 'quran'; entry: QuranEntry; isReview?: boolean }
  | { type: 'hadith'; entry: HadithEntry; isReview?: boolean };

interface ItemRoundResult {
  itemId: string;
  itemWord: string;
  userAnswer: string;
  confidence: Confidence;
  evalResult: EvaluationResult;
  finalVerdict: Verdict;
  isSelfEvaluated?: boolean;
}

type JourneyStage = 'intro' | 'round1' | 'between' | 'round2' | 'summary';

export const JourneyPage: React.FC = () => {
  const [stage, setStage] = useState<JourneyStage>('intro');
  const [items, setItems] = useState<JourneyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // إحصائيات الرحلة المعروضة في شاشة البداية
  const [journeyStats, setJourneyStats] = useState<{ reviewCount: number; newCount: number }>({
    reviewCount: 0,
    newCount: 0,
  });

  // حالة الإدخال الحالية: مستوى التأكد غير مختار افتراضياً
  const [userAnswer, setUserAnswer] = useState('');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [confidenceError, setConfidenceError] = useState(false);
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showReviewSource, setShowReviewSource] = useState(false);

  // حالة التقييم الذاتي لحالة ضعف الثقة
  const [selfEvaluatedVerdict, setSelfEvaluatedVerdict] = useState<Verdict | null>(null);

  // نتائج الجولتين
  const [round1Results, setRound1Results] = useState<ItemRoundResult[]>([]);
  const [round2Order, setRound2Order] = useState<number[]>([]);
  const [round2Results, setRound2Results] = useState<ItemRoundResult[]>([]);

  // بدء رحلة جديدة بنظام المراجعة المتباعدة
  const startJourney = () => {
    const allPool: JourneyItem[] = [
      ...QURAN_ENTRIES.map((q) => ({ type: 'quran' as const, entry: q })),
      ...HADITH_ENTRIES.map((h) => ({ type: 'hadith' as const, entry: h })),
    ];

    if (allPool.length === 0) return;

    const progress = getProgress();
    const today = getTodayString();

    // 1. الألفاظ التي حلّ موعدها (due اليوم أو قبله)، الأقدم أولاً، وأقصاها 3
    const candidateDue = allPool
      .filter((it) => {
        const w = progress.words[it.entry.id];
        return w && w.due <= today;
      })
      .sort((a, b) => {
        const dueA = progress.words[a.entry.id]?.due || '';
        const dueB = progress.words[b.entry.id]?.due || '';
        return dueA.localeCompare(dueB);
      });

    const selectedDue = candidateDue.slice(0, 3).map((it) => ({ ...it, isReview: true }));
    const selectedIds = new Set(selectedDue.map((it) => it.entry.id));

    // 2. ثم ألفاظ لم يرها المستخدم من قبل، عشوائياً
    const candidateUnseen = allPool
      .filter((it) => !progress.words[it.entry.id] && !selectedIds.has(it.entry.id))
      .sort(() => Math.random() - 0.5);

    const neededAfterDue = 5 - selectedDue.length;
    const selectedUnseen = candidateUnseen
      .slice(0, neededAfterDue)
      .map((it) => ({ ...it, isReview: false }));
    selectedUnseen.forEach((it) => selectedIds.add(it.entry.id));

    // 3. ثم أي ألفاظ أخرى عشوائياً حتى تكتمل 5
    const neededAfterUnseen = 5 - (selectedDue.length + selectedUnseen.length);
    const candidateRemaining = allPool
      .filter((it) => !selectedIds.has(it.entry.id))
      .sort(() => Math.random() - 0.5);

    const selectedRemaining = candidateRemaining
      .slice(0, neededAfterUnseen)
      .map((it) => ({ ...it, isReview: false }));

    const selected = [...selectedDue, ...selectedUnseen, ...selectedRemaining];

    setJourneyStats({
      reviewCount: selectedDue.length,
      newCount: selectedUnseen.length,
    });

    setItems(selected);
    setCurrentIndex(0);
    setUserAnswer('');
    setConfidence(null);
    setConfidenceError(false);
    setInputWarning(null);
    setEvalResult(null);
    setSelfEvaluatedVerdict(null);
    setRound1Results([]);
    setRound2Results([]);

    // إعداد ترتيب عشوائي للجولة الثانية
    const indices = selected.map((_, idx) => idx);
    const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);
    setRound2Order(shuffledIndices);

    setStage('round1');
  };

  // بدء الجولة الثانية من شاشة ما بين الجولتين
  const startRound2 = () => {
    setStage('round2');
    setCurrentIndex(0);
    setUserAnswer('');
    setConfidence(null);
    setConfidenceError(false);
    setInputWarning(null);
    setEvalResult(null);
    setSelfEvaluatedVerdict(null);
    setShowReviewSource(false);
  };

  const currentItem =
    stage === 'round1'
      ? items[currentIndex]
      : stage === 'round2' && round2Order.length > 0
      ? items[round2Order[currentIndex]]
      : null;

  // إرسال الإجابة للتقييم
  const handleSubmitAnswer = async () => {
    if (!currentItem) return;

    // إن لم يختر المستخدم مستوى التأكد، لا ترسل شيئاً واعرض رسالة الخطأ
    if (!confidence) {
      setConfidenceError(true);
      return;
    }

    setIsEvaluating(true);
    setConfidenceError(false);
    setInputWarning(null);

    try {
      const position =
        currentItem.type === 'quran'
          ? `${currentItem.entry.surahName} ${currentItem.entry.ayahNumber}`
          : `حديث: ${currentItem.entry.takhrij}`;

      const res = await evaluate({
        word: currentItem.entry.word,
        position,
        userAnswer,
        confidence,
      });

      // إن كان الحكم «طلب إدخال» أو «إجابة غير صالحة»
      // تبقى البطاقة نفسها، ولا يُعرض المعنى، ولا يظهر زر التالي، ولا يُسجل شيء
      if (res.verdict === 'طلب إدخال' || res.verdict === 'إجابة غير صالحة') {
        let warning = res.message;
        if (res.verdict === 'إجابة غير صالحة') {
          warning += ' اكتب فهمك للفظ.';
        }
        setInputWarning(warning);
        return;
      }

      setEvalResult(res);
      setSelfEvaluatedVerdict(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  // معالجة التقييم الذاتي في حالة ضعف الثقة
  const handleSelfEvaluation = (verdict: Verdict) => {
    setSelfEvaluatedVerdict(verdict);
  };

  // هل نحن في حالة "امتناع لضعف الثقة"؟
  const isWeakConfidence =
    evalResult?.verdict === 'امتناع' && evalResult?.decidedBy === 'ai';

  // الانتقال للفظ التالي أو للمرحلة التالية
  const handleNext = () => {
    if (!currentItem || !evalResult || !confidence) return;

    const finalVerdict = selfEvaluatedVerdict || evalResult.verdict;
    const isSelfEval = isWeakConfidence && selfEvaluatedVerdict !== null;

    const roundResult: ItemRoundResult = {
      itemId: currentItem.entry.id,
      itemWord: currentItem.entry.word,
      userAnswer,
      confidence,
      evalResult,
      finalVerdict,
      isSelfEvaluated: isSelfEval,
    };

    if (stage === 'round1') {
      const updated = [...round1Results, roundResult];
      setRound1Results(updated);

      if (currentIndex + 1 < items.length) {
        setCurrentIndex(currentIndex + 1);
        setUserAnswer('');
        setConfidence(null);
        setConfidenceError(false);
        setInputWarning(null);
        setEvalResult(null);
        setSelfEvaluatedVerdict(null);
      } else {
        // الانتقال لشاشة ما بين الجولتين
        setStage('between');
      }
    } else if (stage === 'round2') {
      const updated = [...round2Results, roundResult];
      setRound2Results(updated);

      if (currentIndex + 1 < items.length) {
        setCurrentIndex(currentIndex + 1);
        setUserAnswer('');
        setConfidence(null);
        setConfidenceError(false);
        setInputWarning(null);
        setEvalResult(null);
        setSelfEvaluatedVerdict(null);
        setShowReviewSource(false);
      } else {
        // انتهاء الرحلة وحفظ النتيجة في localStorage (وتحديث المراجعة المتباعدة)
        const beforeResults = updated.map((r2) => {
          const r1 = round1Results.find((r) => r.itemId === r2.itemId);
          return {
            id: r2.itemId,
            before: r1 ? r1.finalVerdict : ('امتناع' as Verdict),
            after: r2.finalVerdict,
          };
        });

        const confidentWrongBefore = round1Results.filter(
          (r) => r.finalVerdict === 'خطأ واثق'
        ).length;
        const confidentWrongAfter = updated.filter(
          (r) => r.finalVerdict === 'خطأ واثق'
        ).length;

        saveSession({
          date: new Date().toISOString(),
          items: beforeResults,
          confidentWrongBefore,
          confidentWrongAfter,
        });

        setStage('summary');
      }
    }
  };

  // 1. شاشة البداية
  if (stage === 'intro') {
    // حساب الألفاظ المستحقة للمراجعة والجديدة قبل البدء لعرضها في المقدمة
    const progress = getProgress();
    const today = getTodayString();
    const allPoolCount = QURAN_ENTRIES.length + HADITH_ENTRIES.length;
    const dueCount = Object.values(progress.words).filter((w) => w.due <= today).length;
    const seenCount = Object.keys(progress.words).length;
    const newAvailable = Math.max(0, allPoolCount - seenCount);

    const plannedReview = Math.min(3, dueCount);
    const plannedNew = Math.min(5 - plannedReview, newAvailable);

    // سطر «في هذه الرحلة: X للمراجعة، وY جديدة.» (يُحذف الجزء الذي قيمته 0)
    let compositionText = '';
    if (plannedReview > 0 && plannedNew > 0) {
      compositionText = `في هذه الرحلة: ${plannedReview} للمراجعة، و${plannedNew} جديدة.`;
    } else if (plannedReview > 0) {
      compositionText = `في هذه الرحلة: ${plannedReview} للمراجعة.`;
    } else if (plannedNew > 0) {
      compositionText = `في هذه الرحلة: ${plannedNew} جديدة.`;
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl p-8 border border-[#1F5F5B]/15 shadow-sm">
          <div className="inline-flex p-3 rounded-full bg-[#1F5F5B]/10 text-[#1F5F5B] mb-4">
            <RefreshCw className="w-8 h-8" />
          </div>
          <h2 className="font-amiri text-3xl font-bold text-[#1F5F5B] mb-3">
            رحلة قياس الفهم والخطأ الواثق
          </h2>
          <p className="text-base sm:text-lg text-[#1D2B2A] leading-relaxed mb-4">
            رحلة من 5 ألفاظ في جولتين. في الجولة الأولى تكتب فهمك لكل لفظ ثم ترى معناه في المصدر. وفي الجولة الثانية تعود إلى الألفاظ نفسها، فنقيس الفرق. وفي آخرها يظهر ملخص رحلتك.
          </p>

          {compositionText && (
            <div className="inline-block bg-[#FAF7F0] border border-[#1F5F5B]/20 text-[#1F5F5B] font-bold text-sm px-4 py-2 rounded-lg mb-6">
              {compositionText}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={startJourney}
              className="w-full sm:w-auto px-10 py-3.5 bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold rounded-lg text-base shadow-sm transition-colors cursor-pointer"
            >
              ابدأ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. شاشة بين الجولتين
  if (stage === 'between') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl p-8 border border-[#1F5F5B]/15 shadow-sm">
          <div className="inline-flex p-3 rounded-full bg-[#1F5F5B]/10 text-[#1F5F5B] mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="font-amiri text-3xl font-bold text-[#1F5F5B] mb-3">
            انتهت الجولة الأولى
          </h2>
          <p className="text-base sm:text-lg text-[#1D2B2A] leading-relaxed mb-6">
            في الجولة الثانية تعود إلى الألفاظ نفسها بترتيب آخر، فتكتب فهمك لكل منها مرة أخرى. ثم يظهر ملخص رحلتك: الخطأ الواثق قبل الرحلة وبعدها.
          </p>
          <div>
            <button
              type="button"
              onClick={startRound2}
              className="w-full sm:w-auto px-10 py-3.5 bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold rounded-lg text-base shadow-sm transition-colors cursor-pointer"
            >
              ابدأ الجولة الثانية
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. شاشة الملخص
  if (stage === 'summary') {
    const totalItems = items.length;
    const confidentWrongBefore = round1Results.filter(
      (r) => r.finalVerdict === 'خطأ واثق'
    ).length;
    const confidentWrongAfter = round2Results.filter(
      (r) => r.finalVerdict === 'خطأ واثق'
    ).length;

    // جمع ألفاظ هذه الرحلة بحسب intervalDays
    const progress = getProgress();
    const daysCounts: Record<number, number> = {};
    items.forEach((item) => {
      const wordProg = progress.words[item.entry.id];
      const d = wordProg ? wordProg.intervalDays : 1;
      daysCounts[d] = (daysCounts[d] || 0) + 1;
    });

    const parts: string[] = [];
    const sortedDays = Object.keys(daysCounts)
      .map(Number)
      .sort((a, b) => a - b);

    for (const d of sortedDays) {
      const count = daysCounts[d];
      let durationDesc = '';
      if (d === 1) {
        durationDesc = 'غداً';
      } else if (d === 2) {
        durationDesc = 'بعد يومين';
      } else if (d >= 3 && d <= 10) {
        durationDesc = `بعد ${d} أيام`;
      } else {
        durationDesc = `بعد ${d} يوماً`;
      }

      parts.push(`${count} ${durationDesc}`);
    }

    const returnSentence =
      parts.length > 0 ? `تعود إليك هذه الألفاظ للمراجعة: ${parts.join('، و')}.` : '';

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-right">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-full bg-[#1F5F5B]/10 text-[#1F5F5B] mb-2">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="font-amiri text-3xl font-bold text-[#1F5F5B]">
              ملخص رحلتك
            </h2>
          </div>

          {/* بطاقات مقارنة الخطأ الواثق */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/20 text-center">
              <div className="text-xs text-[#5B6B6B] mb-1 font-semibold">الخطأ الواثق قبل الرحلة</div>
              <div className="text-2xl font-bold text-[#1D2B2A]">
                {confidentWrongBefore} من {totalItems}
              </div>
            </div>
            <div className="bg-[#FAF7F0] p-4 rounded-xl border border-[#1F5F5B]/20 text-center">
              <div className="text-xs text-[#5B6B6B] mb-1 font-semibold">الخطأ الواثق بعد الرحلة</div>
              <div className="text-2xl font-bold text-[#1F5F5B]">
                {confidentWrongAfter} من {totalItems}
              </div>
            </div>
          </div>

          {/* موعد عودة ألفاظ هذه الرحلة للمراجعة */}
          {returnSentence && (
            <div className="text-center text-sm font-semibold text-[#1F5F5B] bg-[#FAF7F0] border border-[#1F5F5B]/20 rounded-lg p-3 my-4">
              {returnSentence}
            </div>
          )}

          {/* جدول المقارنة */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1F5F5B]/20 bg-[#FAF7F0] text-[#1D2B2A]">
                  <th className="p-3 font-semibold">اللفظ</th>
                  <th className="p-3 font-semibold">حكم الجولة الأولى</th>
                  <th className="p-3 font-semibold">حكم الجولة الثانية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const r1 = round1Results.find((r) => r.itemId === item.entry.id);
                  const r2 = round2Results.find((r) => r.itemId === item.entry.id);
                  const v1 = r1 ? r1.finalVerdict : 'لم يُجب';
                  const v2 = r2 ? r2.finalVerdict : 'لم يُجب';

                  return (
                    <tr key={item.entry.id} className="hover:bg-gray-50/50">
                      <td className="p-3 font-amiri text-lg font-bold text-[#1D2B2A]">
                        <span>{item.entry.word}</span>
                        {item.isReview && (
                          <span className="text-xs text-[#5B6B6B] font-sans font-normal mr-2">
                            (من رحلة سابقة)
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-sm font-semibold text-xs inline-block"
                            style={{
                              color: getVerdictColor(v1),
                              backgroundColor: `${getVerdictColor(v1)}15`,
                            }}
                          >
                            {v1}
                          </span>
                          {r1?.isSelfEvaluated && (
                            <span className="text-[11px] text-[#5B6B6B] font-medium">
                              (تقييم ذاتي)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-sm font-semibold text-xs inline-block"
                            style={{
                              color: getVerdictColor(v2),
                              backgroundColor: `${getVerdictColor(v2)}15`,
                            }}
                          >
                            {v2}
                          </span>
                          {r2?.isSelfEvaluated && (
                            <span className="text-[11px] text-[#5B6B6B] font-medium">
                              (تقييم ذاتي)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-[#1F5F5B]/10">
            <button
              type="button"
              onClick={startJourney}
              className="w-full sm:w-auto px-6 py-3 bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              رحلة جديدة
            </button>
            <a
              href="#/"
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-black/5 text-[#1D2B2A] border border-[#1F5F5B]/20 font-medium rounded-lg text-center transition-colors"
            >
              الرئيسية
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 3. بطاقة اللفظ في الجولة الأولى والجولة الثانية
  if (!currentItem) return null;

  const currentDisplayNumber = currentIndex + 1;
  const totalNumber = items.length;
  const roundTitle = stage === 'round1' ? 'الجولة الأولى' : 'الجولة الثانية';

  // شريط تقدم موحد للرحلة كلها (الجولتان معاً)
  const totalJourneySteps = 2 * totalNumber;
  const currentJourneyStep =
    stage === 'round1'
      ? currentDisplayNumber
      : totalNumber + currentDisplayNumber;
  const journeyProgressPercent =
    totalJourneySteps > 0 ? (currentJourneyStep / totalJourneySteps) * 100 : 0;

  // هل هذا هو اللفظ الأخير في الجولة الثانية؟
  const isLastInRound2 =
    stage === 'round2' && currentIndex + 1 === items.length;

  // مصدر المعنى هل يُعرض؟
  // في الجولة الثانية: يُطوى تحت زر ما لم تكن الحالة "امتناع لضعف الثقة" أو ضغط المستخدم على العرض
  const shouldShowSource =
    stage === 'round1' || showReviewSource || isWeakConfidence;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-right">
      {/* سطر التقدم وشريط التقدم الموحد */}
      <div className="flex items-center justify-between text-sm font-bold text-[#1D2B2A] mb-2">
        <div className="flex items-center gap-2">
          <span>
            {roundTitle}: اللفظ {currentDisplayNumber} من {totalNumber}
          </span>
          {currentItem.isReview && (
            <span className="text-xs bg-[#1F5F5B]/10 text-[#1F5F5B] px-2 py-0.5 rounded-sm font-semibold">
              من رحلة سابقة
            </span>
          )}
        </div>
      </div>
      <div className="w-full bg-[#FAF7F0] border border-[#1F5F5B]/20 h-2 rounded-full mb-6 overflow-hidden">
        <div
          className="bg-[#1F5F5B] h-full transition-all duration-300"
          style={{ width: `${journeyProgressPercent}%` }}
        />
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-sm">
        {/* عرض موضع اللفظ */}
        {currentItem.type === 'quran' ? (
          <div>
            <AyahDisplay
              ayahText={currentItem.entry.ayahText}
              ayahHighlight={currentItem.entry.ayahHighlight}
              surahName={currentItem.entry.surahName}
              ayahNumber={currentItem.entry.ayahNumber}
            />
            <div className="text-center font-bold text-lg text-[#1D2B2A] my-4 font-amiri">
              ما معنى «{currentItem.entry.word}» في هذه الآية كما تفهمه؟
            </div>
          </div>
        ) : (
          <div className="text-center my-6">
            <div className="font-amiri text-3xl font-bold text-[#1F5F5B] mb-2">
              «{currentItem.entry.word}»
            </div>
            <p className="text-sm text-[#5B6B6B] mb-4 font-sans">
              لفظ ورد في حديث نبوي صحيح، ويُعرض نصه بعد إجابتك.
            </p>
            <div className="font-bold text-lg text-[#1D2B2A] font-amiri">
              ما معنى «{currentItem.entry.word}» في هذا الحديث كما تفهمه؟
            </div>
          </div>
        )}

        {/* نموذج الإدخال إن لم يتم التقييم بنجاح بعد */}
        {!evalResult ? (
          <div className="mt-6 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="userAnswer"
                  className="block text-sm font-semibold text-[#1D2B2A]"
                >
                  اكتب فهمك بكلماتك:
                </label>
                <span className="text-xs text-[#5B6B6B]">
                  {userAnswer.length} / 300
                </span>
              </div>
              <textarea
                id="userAnswer"
                rows={3}
                maxLength={300}
                value={userAnswer}
                onChange={(e) => {
                  setUserAnswer(e.target.value);
                  if (inputWarning) setInputWarning(null);
                }}
                placeholder="اكتب فهمك بكلماتك…"
                className="w-full p-3.5 border border-[#1F5F5B]/25 rounded-xl focus:border-[#1F5F5B] focus:ring-1 focus:ring-[#1F5F5B] outline-none text-[#1D2B2A] text-base leading-relaxed bg-[#FAF7F0]/40 transition-colors"
              />
            </div>

            {/* رسالة التنبيه إن كانت الإجابة طلباً للإدخال أو غير صالحة */}
            {inputWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm font-medium">
                {inputWarning}
              </div>
            )}

            {/* مستوى التأكد: أزرار الراديو الثلاثة */}
            <div>
              <div className="block text-sm font-semibold text-[#1D2B2A] mb-2.5">
                ما مدى تأكدك من هذا الفهم؟
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {(['متأكد', 'متردد', 'لا أعرف'] as Confidence[]).map((level) => {
                  const isSelected = confidence === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setConfidence(level);
                        setConfidenceError(false);
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-[#1F5F5B] text-white border-[#1F5F5B] shadow-2xs'
                          : 'bg-[#FAF7F0] text-[#1D2B2A] border-[#1F5F5B]/20 hover:bg-[#1F5F5B]/5'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>

              {confidenceError && (
                <div className="text-xs text-[#B42318] font-bold mt-2">
                  يرجى تحديد مدى تأكدك قبل المتابعة.
                </div>
              )}
            </div>

            {/* زر الإرسال للمقارنة */}
            <button
              type="button"
              onClick={handleSubmitAnswer}
              disabled={isEvaluating}
              className="w-full py-3.5 bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold rounded-lg text-base shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEvaluating ? 'جارٍ المقارنة…' : 'قارن فهمي'}
            </button>
          </div>
        ) : (
          /* عرض النتيجة بعد التقييم */
          <div className="mt-6 space-y-4">
            {/* صندوق تعليق الذكاء الاصطناعي */}
            <AiCommentBox
              verdict={evalResult.verdict}
              message={evalResult.message}
              decidedBy={evalResult.decidedBy}
              aiNote={evalResult.aiNote}
              aiConfidence={evalResult.aiConfidence}
              aiModel={evalResult.aiModel}
            />

            {/* في الجولة الثانية (إذا لم تكن حالة ضعف الثقة): يُطوى المعنى تحت زر */}
            {stage === 'round2' && !shouldShowSource && (
              <div className="text-center py-2">
                <button
                  type="button"
                  onClick={() => setShowReviewSource(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-[#1F5F5B]/30 rounded-lg text-sm font-medium text-[#1F5F5B] hover:bg-[#1F5F5B]/5 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>اعرض المعنى في المصدر</span>
                </button>
              </div>
            )}

            {/* عرض النصوص المنقولة من المصادر */}
            {shouldShowSource && (
              <div className="space-y-3">
                {currentItem.type === 'quran' ? (
                  <>
                    <SourceQuoteBox
                      title="المعنى في موسوعة التفسير (الدرر السنية)"
                      badgeText="نص منقول من المصدر"
                      quoteText={currentItem.entry.sourceMeaning}
                      sourceName="موسوعة التفسير (الدرر السنية)"
                      sectionName={currentItem.entry.sourceSection}
                      locationNote={currentItem.entry.sourceLocationNote}
                      sourceUrl={currentItem.entry.sourceUrl}
                    />

                    {currentItem.entry.sirajMeaning && (
                      <SourceQuoteBox
                        title={
                          currentItem.entry.sirajRelation === 'يوافقه في أصل المعنى'
                            ? 'ويوافقه في أصل المعنى في «السراج في بيان غريب القرآن»'
                            : 'ويوافقه في «السراج في بيان غريب القرآن»'
                        }
                        badgeText="نص منقول من المصدر"
                        quoteText={currentItem.entry.sirajMeaning}
                        sourceName="السراج في بيان غريب القرآن"
                        sourceUrl={currentItem.entry.sirajUrl}
                        isSubBox={true}
                      />
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    <SourceQuoteBox
                      title="نص الحديث النبوي الشريف"
                      badgeText="نص منقول من المصدر"
                      quoteText={currentItem.entry.hadithText}
                      sourceName="الموسوعة الحديثية (الدرر السنية)"
                      sectionName={`التخريج: ${currentItem.entry.takhrij}`}
                      sourceUrl={currentItem.entry.dorarUrl}
                    />

                    {currentItem.entry.wordMeanings && (
                      <SourceQuoteBox
                        title="معاني ألفاظ الحديث"
                        badgeText="نص منقول من المصدر"
                        quoteText={currentItem.entry.wordMeanings}
                        sourceName="موسوعة الأحاديث النبوية (HadeethEnc)"
                        sectionName={currentItem.entry.hadeethEncRef}
                        sourceUrl={currentItem.entry.hadeethEncUrl}
                        isSubBox={true}
                      />
                    )}
                  </div>
                )}

                {/* قسم التقييم الذاتي في حالة "امتناع لضعف الثقة" */}
                {isWeakConfidence && (
                  <div className="bg-[#FAF7F0] border border-[#1F5F5B]/25 rounded-xl p-4 my-3 text-right">
                    <div className="text-sm font-bold text-[#1D2B2A] mb-3">
                      قارن فهمك بنص المصدر، ثم قيّم نفسك:
                    </div>

                    {selfEvaluatedVerdict ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#2E7D4F] bg-white p-2.5 rounded-lg border border-[#2E7D4F]/20">
                        <CheckCircle className="w-4 h-4" />
                        <span>تم تسجيل تقييمك الذاتي: {selfEvaluatedVerdict}</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleSelfEvaluation('صحيح')}
                          className="px-4 py-2 bg-[#2E7D4F] hover:bg-[#256640] text-white text-sm font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                        >
                          فهمي يوافقه
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSelfEvaluation(
                              confidence === 'متأكد' ? 'خطأ واثق' : 'خطأ'
                            )
                          }
                          className="px-4 py-2 bg-[#C05621] hover:bg-[#9c4217] text-white text-sm font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                        >
                          فهمي يخالفه
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* زر التالي / اعرض ملخص رحلتك */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3.5 bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold rounded-lg text-base shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{isLastInRound2 ? 'اعرض ملخص رحلتك' : 'التالي'}</span>
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
