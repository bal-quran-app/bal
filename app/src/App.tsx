/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { JourneyPage } from './pages/JourneyPage';
import { WordsPage } from './pages/WordsPage';
import { TestsPage } from './pages/TestsPage';
import { SourcesPage } from './pages/SourcesPage';
import { QURAN_ENTRIES, HADITH_ENTRIES } from '../data/bal-data';
import type { QuranEntry, HadithEntry, Confidence } from '../data/types';
import { evaluate, EvaluationResult } from './services/evaluate';
import { SourceQuoteBox } from './components/SourceQuoteBox';
import { AiCommentBox } from './components/AiCommentBox';
import { AyahDisplay } from './components/AyahDisplay';

// ===== بطاقة التضمين (#/card/ID) =====

// بطاقة لفظ واحد للتضمين في المواقع والتطبيقات الأخرى (#/card/ID).
// تُعرض وحدها دون الشريط العلوي والتذييل، ولا تحفظ شيئاً في المتصفح.

const APP_URL = 'https://bal-quran.ai.studio';

type CardItem =
  | { type: 'quran'; entry: QuranEntry }
  | { type: 'hadith'; entry: HadithEntry };

const findCardItem = (id: string): CardItem | null => {
  const q = QURAN_ENTRIES.find((e) => e.id === id);
  if (q) return { type: 'quran', entry: q };
  const h = HADITH_ENTRIES.find((e) => e.id === id);
  if (h) return { type: 'hadith', entry: h };
  return null;
};

const CardFooter: React.FC = () => (
  <div className="mt-4 pt-3 border-t border-[#1F5F5B]/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B6B6B]">
    <span>المعاني منقولة بنصها من مصادرها، والتصنيف بالذكاء الاصطناعي وقد يخطئ.</span>
    <a
      href={APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-[#1F5F5B] hover:text-[#164845] underline underline-offset-4"
    >
      افتح «بَلْ» ↗
    </a>
  </div>
);

interface CardPageProps {
  id: string;
}

const CardPage: React.FC<CardPageProps> = ({ id }) => {
  const item = findCardItem(id);

  const [userAnswer, setUserAnswer] = useState('');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [confidenceError, setConfidenceError] = useState(false);
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const resetCard = () => {
    setUserAnswer('');
    setConfidence(null);
    setConfidenceError(false);
    setInputWarning(null);
    setEvalResult(null);
  };

  const handleSubmitAnswer = async () => {
    if (!item) return;

    // لا يُرسل شيء قبل اختيار مدى التأكد
    if (!confidence) {
      setConfidenceError(true);
      return;
    }

    setIsEvaluating(true);
    setConfidenceError(false);
    setInputWarning(null);

    try {
      const position =
        item.type === 'quran'
          ? `${item.entry.surahName} ${item.entry.ayahNumber}`
          : `حديث: ${item.entry.takhrij}`;

      const res = await evaluate({
        word: item.entry.word,
        position,
        userAnswer,
        confidence,
      });

      // «طلب إدخال» و«إجابة غير صالحة»: تبقى البطاقة وتظهر الرسالة تحت المربع
      if (res.verdict === 'طلب إدخال' || res.verdict === 'إجابة غير صالحة') {
        let warning = res.message;
        if (res.verdict === 'إجابة غير صالحة') {
          warning += ' اكتب فهمك للفظ.';
        }
        setInputWarning(warning);
        return;
      }

      setEvalResult(res);
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!item) {
    return (
      <div className="w-full min-h-screen bg-[#FAF7F0] p-4 text-right">
        <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl p-4 sm:p-6 border border-[#1F5F5B]/15 shadow-sm">
          <p className="text-base text-[#1D2B2A] leading-relaxed">
            لم نجد هذا اللفظ في قائمة «بَلْ».
          </p>
          <CardFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#FAF7F0] p-4 text-right">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl p-4 sm:p-6 border border-[#1F5F5B]/15 shadow-sm">
        {/* موضع اللفظ */}
        {item.type === 'quran' ? (
          <div>
            <AyahDisplay
              ayahText={item.entry.ayahText}
              ayahHighlight={item.entry.ayahHighlight}
              surahName={item.entry.surahName}
              ayahNumber={item.entry.ayahNumber}
            />
            <div className="text-center font-bold text-lg text-[#1D2B2A] my-4 font-amiri">
              ما معنى «{item.entry.word}» في هذه الآية كما تفهمه؟
            </div>
          </div>
        ) : (
          <div className="text-center my-4">
            <div className="font-amiri text-3xl font-bold text-[#1F5F5B] mb-2">
              «{item.entry.word}»
            </div>
            <p className="text-sm text-[#5B6B6B] mb-4 font-sans">
              لفظ ورد في حديث نبوي صحيح، ويُعرض نصه بعد إجابتك.
            </p>
            <div className="font-bold text-lg text-[#1D2B2A] font-amiri">
              ما معنى «{item.entry.word}» في هذا الحديث كما تفهمه؟
            </div>
          </div>
        )}

        {!evalResult ? (
          <div className="mt-4 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="cardAnswer" className="block text-sm font-semibold text-[#1D2B2A]">
                  اكتب فهمك بكلماتك:
                </label>
                <span className="text-xs text-[#5B6B6B]">{userAnswer.length} / 300</span>
              </div>
              <textarea
                id="cardAnswer"
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

            {inputWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm font-medium">
                {inputWarning}
              </div>
            )}

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
          <div className="mt-4 space-y-4">
            <AiCommentBox
              verdict={evalResult.verdict}
              message={evalResult.message}
              decidedBy={evalResult.decidedBy}
              aiNote={evalResult.aiNote}
              aiConfidence={evalResult.aiConfidence}
              aiModel={evalResult.aiModel}
            />

            <div className="space-y-3">
              {item.type === 'quran' ? (
                <>
                  <SourceQuoteBox
                    title="المعنى في موسوعة التفسير (الدرر السنية)"
                    badgeText="نص منقول من المصدر"
                    quoteText={item.entry.sourceMeaning}
                    sourceName="موسوعة التفسير (الدرر السنية)"
                    sectionName={item.entry.sourceSection}
                    locationNote={item.entry.sourceLocationNote}
                    sourceUrl={item.entry.sourceUrl}
                  />
                  {item.entry.sirajMeaning && (
                    <SourceQuoteBox
                      title={
                        item.entry.sirajRelation === 'يوافقه في أصل المعنى'
                          ? 'ويوافقه في أصل المعنى في «السراج في بيان غريب القرآن»'
                          : 'ويوافقه في «السراج في بيان غريب القرآن»'
                      }
                      badgeText="نص منقول من المصدر"
                      quoteText={item.entry.sirajMeaning}
                      sourceName="السراج في بيان غريب القرآن"
                      sourceUrl={item.entry.sirajUrl}
                      isSubBox={true}
                    />
                  )}
                </>
              ) : (
                <>
                  <SourceQuoteBox
                    title="نص الحديث النبوي الشريف"
                    badgeText="نص منقول من المصدر"
                    quoteText={item.entry.hadithText}
                    sourceName="الموسوعة الحديثية (الدرر السنية)"
                    sectionName={`التخريج: ${item.entry.takhrij}`}
                    sourceUrl={item.entry.dorarUrl}
                  />
                  {item.entry.wordMeanings && (
                    <SourceQuoteBox
                      title="معاني ألفاظ الحديث"
                      badgeText="نص منقول من المصدر"
                      quoteText={item.entry.wordMeanings}
                      sourceName="موسوعة الأحاديث النبوية (HadeethEnc)"
                      sectionName={item.entry.hadeethEncRef}
                      sourceUrl={item.entry.hadeethEncUrl}
                      isSubBox={true}
                    />
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={resetCard}
              className="w-full py-3 bg-white hover:bg-[#1F5F5B]/5 text-[#1F5F5B] border border-[#1F5F5B] font-bold rounded-lg text-base transition-colors cursor-pointer"
            >
              جرّب مرة أخرى
            </button>
          </div>
        )}

        <CardFooter />
      </div>
    </div>
  );
};

// ===== صفحة الدمج (#/embed) =====

// صفحة الدمج (#/embed و#/embed/ID): معاينة بطاقة لفظ واحد، وشفرة تضمينها في موقع أو تطبيق آخر.

const QURAN_IN_MUSHAF_ORDER = [...QURAN_ENTRIES].sort(
  (a, b) => a.surahNumber - b.surahNumber || a.ayahNumber - b.ayahNumber
);

const ALL_OPTIONS = [
  ...QURAN_IN_MUSHAF_ORDER.map((q) => ({ id: q.id, label: `${q.word} — ${q.surahName} ${q.ayahNumber}` })),
  ...HADITH_ENTRIES.map((h) => ({ id: h.id, label: `${h.word} — حديث` })),
];

const DEFAULT_ID = ALL_OPTIONS.length > 0 ? ALL_OPTIONS[0].id : '';

// النسخ: واجهة الحافظة أولاً، ثم الطريقة القديمة. يرجع false إن فشل الاثنان.
const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ننتقل إلى الطريقة القديمة
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

interface EmbedPageProps {
  initialId?: string;
}

const EmbedPage: React.FC<EmbedPageProps> = ({ initialId }) => {
  const validInitial = initialId && findCardItem(initialId) ? initialId : DEFAULT_ID;
  const [selectedId, setSelectedId] = useState<string>(validInitial);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  // عند فتح #/embed/ID من صفحة الألفاظ يُختار اللفظ نفسه
  useEffect(() => {
    if (initialId && findCardItem(initialId)) {
      setSelectedId(initialId);
      setCopied(null);
    }
  }, [initialId]);

  const item = findCardItem(selectedId);
  const base = `${window.location.origin}${window.location.pathname}`;
  const cardUrl = `${base}#/card/${selectedId}`;
  const embedCode = `<iframe src="${cardUrl}" width="100%" height="640" style="border:0" title="بَلْ: ${
    item ? item.entry.word : ''
  }" loading="lazy"></iframe>`;

  const handleCopy = async (what: 'code' | 'link') => {
    const ok = await copyText(what === 'code' ? embedCode : cardUrl);
    setCopied(ok ? what : null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 text-right">
      <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#1F5F5B] mb-3">«بَلْ» في تطبيقك</h1>
      <p className="text-base text-[#1D2B2A] leading-relaxed mb-8">
        بطاقة «بَلْ» مكوّن مستقل يُضمَّن في أي تطبيق مصحف أو تفسير أو حديث أو منصة تحفيظ. تعرض اللفظ في
        موضعه، وتقارن فهم القارئ بالمعنى المنقول من المصدر، ثم تعرض المعنى بنصه ورابطه. لا تحتاج تسجيل دخول،
        ولا تحفظ شيئاً.
      </p>

      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#1F5F5B]/15 shadow-xs mb-6">
        <label htmlFor="embedWord" className="block text-sm font-semibold text-[#1D2B2A] mb-2">
          اختر اللفظ
        </label>
        <select
          id="embedWord"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setCopied(null);
          }}
          className="w-full p-3 border border-[#1F5F5B]/25 rounded-xl bg-[#FAF7F0]/40 text-[#1D2B2A] text-base focus:border-[#1F5F5B] outline-none"
        >
          {ALL_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-3">معاينة</h2>
      <div className="mb-8 rounded-xl overflow-hidden border border-[#1F5F5B]/20 bg-[#FAF7F0]">
        <iframe
          key={selectedId}
          src={cardUrl}
          title={`بَلْ: ${item ? item.entry.word : ''}`}
          className="w-full block"
          style={{ height: 640, border: 0 }}
        />
      </div>

      <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-3">شفرة التضمين</h2>
      <textarea
        readOnly
        dir="ltr"
        rows={4}
        value={embedCode}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full p-3 border border-[#1F5F5B]/25 rounded-xl text-sm font-mono text-[#1D2B2A] bg-[#FAF7F0]/40 text-left mb-3"
      />
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => handleCopy('code')}
          className="px-5 py-2.5 bg-[#1F5F5B] hover:bg-[#164845] text-white font-bold rounded-lg text-sm transition-colors cursor-pointer"
        >
          انسخ الشفرة
        </button>
        {copied === 'code' && <span className="text-sm font-semibold text-[#2E7D4F]">نُسخت الشفرة.</span>}
      </div>

      <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-3">رابط البطاقة</h2>
      <div
        dir="ltr"
        className="w-full p-3 border border-[#1F5F5B]/25 rounded-xl text-sm font-mono text-[#1D2B2A] bg-[#FAF7F0]/40 text-left mb-3 break-all"
      >
        {cardUrl}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-10">
        <button
          type="button"
          onClick={() => handleCopy('link')}
          className="px-5 py-2.5 bg-white hover:bg-[#1F5F5B]/5 text-[#1F5F5B] border border-[#1F5F5B] font-bold rounded-lg text-sm transition-colors cursor-pointer"
        >
          انسخ الرابط
        </button>
        {copied === 'link' && <span className="text-sm font-semibold text-[#2E7D4F]">نُسخ الرابط.</span>}
      </div>

      <p className="text-sm text-[#5B6B6B] leading-relaxed border-t border-[#1F5F5B]/15 pt-6">
        في هذه النسخة تُضمَّن البطاقة بإطار. والخطوة التالية بعد التحدي: واجهة برمجية تعرض في كل صفحة من المصحف
        ألفاظها التي يكثر الخطأ في فهمها.
      </p>
    </div>
  );
};

// ===== التطبيق =====

export default function App() {
  const [currentHash, setCurrentHash] = useState<string>(
    window.location.hash || '#/'
  );

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentHash(hash);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderPage = () => {
    const route = currentHash.replace(/\/+$/, '') || '#/';

    if (route === '#/journey') {
      return <JourneyPage />;
    }
    if (route === '#/words') {
      return <WordsPage />;
    }
    if (route === '#/tests') {
      return <TestsPage />;
    }
    if (route === '#/sources') {
      return <SourcesPage />;
    }
    if (route === '#/embed' || route.startsWith('#/embed/')) {
      const embedId = route.startsWith('#/embed/') ? decodeURIComponent(route.slice('#/embed/'.length)) : undefined;
      return <EmbedPage initialId={embedId} />;
    }
    return <HomePage />;
  };

  // بطاقة التضمين تُعرض وحدها دون الشريط العلوي والتذييل، لأنها تظهر داخل إطار في موقع آخر
  const cardRoute = (currentHash.replace(/\/+$/, '') || '#/');
  if (cardRoute.startsWith('#/card/')) {
    return <CardPage id={decodeURIComponent(cardRoute.slice('#/card/'.length))} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F0] text-[#1D2B2A]">
      <Navbar currentHash={currentHash} />
      <main className="flex-1 flex flex-col">{renderPage()}</main>
      <Footer />
    </div>
  );
}
