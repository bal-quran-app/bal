import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Compass, ShieldAlert } from 'lucide-react';
import { QURAN_ENTRIES, HADITH_ENTRIES } from '../../data/bal-data';
import {
  getLastSession,
  SessionRecord,
  getProgress,
  getTodayString,
} from '../services/storage';

export const HomePage: React.FC = () => {
  const [lastSession, setLastSession] = useState<SessionRecord | null>(null);
  const [dueCount, setDueCount] = useState<number>(0);
  const [seenCount, setSeenCount] = useState<number>(0);
  const [nextReviewDate, setNextReviewDate] = useState<string | null>(null);
  const [nextReviewCount, setNextReviewCount] = useState<number>(0);

  useEffect(() => {
    setLastSession(getLastSession());

    const progress = getProgress();
    const today = getTodayString();
    const seen = Object.keys(progress.words).length;
    setSeenCount(seen);

    const due = Object.values(progress.words).filter((w) => w.due <= today).length;
    setDueCount(due);

    const futureWords = Object.values(progress.words).filter((w) => w.due > today);
    if (futureWords.length > 0) {
      const dates = futureWords.map((w) => w.due).sort();
      const earliest = dates[0];
      const countAtEarliest = futureWords.filter((w) => w.due === earliest).length;
      setNextReviewDate(earliest);
      setNextReviewCount(countAtEarliest);
    } else {
      setNextReviewDate(null);
      setNextReviewCount(0);
    }
  }, []);

  const quranCount = QURAN_ENTRIES.length;
  const hadithCount = HADITH_ENTRIES.length;
  const totalWords = quranCount + hadithCount;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16 text-center">
      {/* العنوان الكبير */}
      <h1 className="font-amiri text-6xl sm:text-7xl md:text-8xl font-bold text-[#1F5F5B] mb-4 tracking-tight">
        بَلْ
      </h1>

      <p className="text-xl sm:text-2xl font-amiri font-bold text-[#1D2B2A] mb-3 leading-snug">
        ألفاظ في القرآن الكريم والحديث الشريف تظن أنك تعرف معناها
      </p>

      <p className="text-sm sm:text-base text-[#5B6B6B] font-amiri mb-6 max-w-xl mx-auto">
        «بَلْ» حرف يُصحَّح به ما قبله: ليس المعنى ما ظننت، بَلْ ما في المصدر.
      </p>

      {/* الفقرة التعريفية */}
      <div className="bg-white rounded-xl p-6 shadow-xs border border-[#1F5F5B]/10 mb-8 max-w-2xl mx-auto text-right">
        <p className="text-base sm:text-lg leading-relaxed text-[#1D2B2A]">
          في القرآن والحديث ألفاظ مألوفة نفهمها على معناها في كلامنا اليوم، ومعناها في موضعها غير ذلك. اكتب ما تفهمه، وحدد مدى تأكدك، ثم قارن فهمك بالمعنى المنقول من موسوعة التفسير.
        </p>
      </div>

      {/* الخطوات الثلاث */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-right max-w-2xl mx-auto">
        <div className="bg-[#FAF7F0] border border-[#1F5F5B]/15 rounded-lg p-4">
          <div className="text-xs font-bold text-[#1F5F5B] mb-1">الخطوة 1</div>
          <div className="text-sm font-semibold text-[#1D2B2A]">اقرأ اللفظ في موضعه</div>
        </div>
        <div className="bg-[#FAF7F0] border border-[#1F5F5B]/15 rounded-lg p-4">
          <div className="text-xs font-bold text-[#1F5F5B] mb-1">الخطوة 2</div>
          <div className="text-sm font-semibold text-[#1D2B2A]">اكتب فهمك وحدد مدى تأكدك</div>
        </div>
        <div className="bg-[#FAF7F0] border border-[#1F5F5B]/15 rounded-lg p-4">
          <div className="text-xs font-bold text-[#1F5F5B] mb-1">الخطوة 3</div>
          <div className="text-sm font-semibold text-[#1D2B2A]">قارن فهمك بالمعنى المنقول من المصدر</div>
        </div>
      </div>

      {/* سطر الأعداد */}
      <div className="text-sm sm:text-base font-semibold text-[#164845] mb-8">
        الألفاظ القرآنية: {quranCount} · الأحاديث: {hadithCount}
      </div>

      {/* تنبيه المراجعة المتباعدة إن مرّ المستخدم بألفاظ */}
      {seenCount > 0 && (
        <div className="bg-[#FAF7F0] border border-[#1F5F5B]/25 rounded-lg p-4 mb-4 text-right max-w-xl mx-auto text-sm space-y-1">
          {dueCount > 0 ? (
            <div className="font-bold text-[#1F5F5B]">
              حان موعد مراجعة {dueCount} من الألفاظ.
            </div>
          ) : nextReviewDate ? (
            <div className="font-bold text-[#1F5F5B]">
              أقرب مراجعة: {nextReviewDate} ({nextReviewCount} من الألفاظ).
            </div>
          ) : null}
          <div className="text-xs text-[#5B6B6B]">
            الألفاظ التي مررت بها: {seenCount} من {totalWords}.
          </div>
        </div>
      )}

      {/* إحصائية آخر رحلة إن وُجدت */}
      {lastSession && (
        <div className="bg-[#F4EFE3] border-r-4 border-[#1F5F5B] rounded-lg p-4 mb-8 text-right max-w-xl mx-auto text-sm">
          <div className="font-semibold text-[#1D2B2A]">
            آخر رحلة: الخطأ الواثق قبلها {lastSession.confidentWrongBefore} من {lastSession.items.length}، وبعدها {lastSession.confidentWrongAfter} من {lastSession.items.length}.
          </div>
        </div>
      )}

      {/* أزرار العمليات */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto">
        <a
          href="#/journey"
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1F5F5B] hover:bg-[#164845] text-white px-8 py-3.5 rounded-lg font-bold text-base transition-colors shadow-sm"
        >
          <span>ابدأ الرحلة</span>
          <ArrowLeft className="w-5 h-5" />
        </a>

        <a
          href="#/words"
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-black/5 text-[#1D2B2A] border border-[#1F5F5B]/20 px-6 py-3.5 rounded-lg font-medium text-base transition-colors"
        >
          <BookOpen className="w-4 h-4 text-[#1F5F5B]" />
          <span>تصفّح الألفاظ</span>
        </a>

        <a
          href="#/tests"
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-transparent hover:bg-black/5 text-[#5B6B6B] hover:text-[#1D2B2A] px-4 py-3.5 rounded-lg text-sm transition-colors"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>اختبار الحالات الحرجة</span>
        </a>
      </div>
    </div>
  );
};
