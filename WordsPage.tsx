import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, BookOpen, ScrollText } from 'lucide-react';
import { QURAN_ENTRIES, HADITH_ENTRIES, EXCLUDED } from '../../data/bal-data';
import { normalize } from '../services/evaluate';
import { AyahDisplay } from '../components/AyahDisplay';
import { SourceQuoteBox } from '../components/SourceQuoteBox';

export const WordsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ترتيب الألفاظ القرآنية بترتيب المصحف (رقم السورة ثم رقم الآية)
  const sortedQuran = useMemo(() => {
    return [...QURAN_ENTRIES].sort((a, b) => {
      if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
      return a.ayahNumber - b.ayahNumber;
    });
  }, []);

  const normQuery = normalize(searchQuery);

  // تصفية الألفاظ بالبحث
  const filteredQuran = useMemo(() => {
    if (!normQuery) return sortedQuran;
    return sortedQuran.filter(
      (q) =>
        normalize(q.word).includes(normQuery) ||
        normalize(q.surahName).includes(normQuery) ||
        normalize(q.ayahText).includes(normQuery)
    );
  }, [sortedQuran, normQuery]);

  const filteredHadith = useMemo(() => {
    if (!normQuery) return HADITH_ENTRIES;
    return HADITH_ENTRIES.filter(
      (h) =>
        normalize(h.word).includes(normQuery) ||
        normalize(h.takhrij).includes(normQuery) ||
        normalize(h.hadithText).includes(normQuery)
    );
  }, [normQuery]);

  // فحص المستبعد إن لم تكن هناك أي نتائج
  const excludedMatch = useMemo(() => {
    if (!normQuery) return null;
    if (filteredQuran.length > 0 || filteredHadith.length > 0) return null;
    return EXCLUDED.find((ex) => normalize(ex.word) === normQuery || normQuery.includes(normalize(ex.word)));
  }, [normQuery, filteredQuran.length, filteredHadith.length]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const hasResults = filteredQuran.length > 0 || filteredHadith.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 text-right">
      <div className="mb-8">
        <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#1F5F5B] mb-2">
          مرجع الألفاظ
        </h1>
        <p className="text-sm text-[#5B6B6B]">
          تصفّح قائمة الألفاظ القرآنية والنبوية الموثقة في «بَلْ».
        </p>
      </div>

      {/* شريط البحث */}
      <div className="relative mb-8">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن لفظ أو سورة…"
          className="w-full pr-11 pl-4 py-3 bg-white border border-[#1F5F5B]/20 rounded-xl text-base focus:border-[#1F5F5B] focus:ring-1 focus:ring-[#1F5F5B] outline-hidden shadow-xs font-sans"
        />
        <Search className="w-5 h-5 text-[#8A9A9A] absolute right-3.5 top-3.5" />
      </div>

      {/* إن لم يطابق البحث شيئاً */}
      {!hasResults && normQuery && (
        <div className="bg-white rounded-xl p-6 border border-[#1F5F5B]/15 shadow-xs mb-8">
          {excludedMatch ? (
            excludedMatch.isDisagreement ? (
              <div className="space-y-2">
                <div className="text-sm font-bold text-[#1F5F5B]">بيان الخلاف</div>
                <p className="text-base text-[#1D2B2A] leading-relaxed">
                  لم نُدرج هذا اللفظ في قائمتنا لاختلاف في معناه: {excludedMatch.reason} فلا نحكم على فهمك له. ارجع فيه إلى كتب التفسير وأهل العلم.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-bold text-[#4A6572]">لفظ مستبعد</div>
                <p className="text-base text-[#1D2B2A] leading-relaxed">
                  هذا اللفظ في هذا الموضع ليس في قائمة «بَلْ» الموثقة، فلا نحكم على فهمك له ولا نعرض له معنى. يمكنك الرجوع إلى موسوعة التفسير.
                </p>
                <div>
                  <a
                    href="https://dorar.net/tafseer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1F5F5B] hover:text-[#164845] font-semibold underline underline-offset-4 text-sm inline-flex items-center gap-1"
                  >
                    <span>موسوعة التفسير بالدرر السنية</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <p className="text-base text-[#1D2B2A] leading-relaxed">
                هذا اللفظ في هذا الموضع ليس في قائمة «بَلْ» الموثقة، فلا نحكم على فهمك له ولا نعرض له معنى. يمكنك الرجوع إلى موسوعة التفسير.
              </p>
              <div>
                <a
                  href="https://dorar.net/tafseer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1F5F5B] hover:text-[#164845] font-semibold underline underline-offset-4 text-sm inline-flex items-center gap-1"
                >
                  <span>موسوعة التفسير بالدرر السنية</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* قسم الألفاظ القرآنية */}
      {filteredQuran.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#1F5F5B]/15">
            <BookOpen className="w-5 h-5 text-[#1F5F5B]" />
            <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A]">
              الألفاظ القرآنية ({filteredQuran.length})
            </h2>
          </div>

          <div className="space-y-3">
            {filteredQuran.map((q) => {
              const isOpen = expandedId === q.id;
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-[#1F5F5B]/15 shadow-xs overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(q.id)}
                    className="w-full p-4 flex items-center justify-between text-right hover:bg-[#FAF7F0]/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-amiri text-2xl font-bold text-[#1F5F5B]">
                        {q.word}
                      </span>
                      <span className="text-xs text-[#5B6B6B] bg-[#FAF7F0] px-2.5 py-1 rounded-sm border border-[#1F5F5B]/10 font-sans">
                        سورة {q.surahName}: {q.ayahNumber}
                      </span>
                    </div>
                    <div className="text-[#5B6B6B]">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-0 border-t border-[#1F5F5B]/10 bg-[#FAF7F0]/20">
                      <AyahDisplay
                        ayahText={q.ayahText}
                        ayahHighlight={q.ayahHighlight}
                        surahName={q.surahName}
                        ayahNumber={q.ayahNumber}
                      />

                      <SourceQuoteBox
                        title="المعنى في موسوعة التفسير (الدرر السنية)"
                        badgeText="نص منقول من المصدر"
                        quoteText={q.sourceMeaning}
                        sourceName="موسوعة التفسير (الدرر السنية)"
                        sectionName={q.sourceSection}
                        locationNote={q.sourceLocationNote}
                        sourceUrl={q.sourceUrl}
                      />

                      {q.sirajMeaning && (
                        <SourceQuoteBox
                          title={
                            q.sirajRelation === 'يوافقه في أصل المعنى'
                              ? 'ويوافقه في أصل المعنى في «السراج في بيان غريب القرآن»'
                              : 'ويوافقه في «السراج في بيان غريب القرآن»'
                          }
                          badgeText="نص منقول من المصدر"
                          quoteText={q.sirajMeaning}
                          sourceName="السراج في بيان غريب القرآن"
                          sourceUrl={q.sirajUrl}
                          isSubBox={true}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* قسم الأحاديث */}
      {filteredHadith.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#1F5F5B]/15">
            <ScrollText className="w-5 h-5 text-[#1F5F5B]" />
            <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A]">
              الأحاديث ({filteredHadith.length})
            </h2>
          </div>

          <div className="space-y-3">
            {filteredHadith.map((h) => {
              const isOpen = expandedId === h.id;
              return (
                <div
                  key={h.id}
                  className="bg-white rounded-xl border border-[#1F5F5B]/15 shadow-xs overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(h.id)}
                    className="w-full p-4 flex items-center justify-between text-right hover:bg-[#FAF7F0]/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-amiri text-2xl font-bold text-[#1F5F5B]">
                        {h.word}
                      </span>
                      <span className="text-xs text-[#5B6B6B] bg-[#FAF7F0] px-2.5 py-1 rounded-sm border border-[#1F5F5B]/10 font-sans">
                        {h.takhrij}
                      </span>
                    </div>
                    <div className="text-[#5B6B6B]">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-0 border-t border-[#1F5F5B]/10 bg-[#FAF7F0]/20">
                      <SourceQuoteBox
                        title="نص الحديث النبوي الشريف"
                        badgeText="نص منقول من المصدر"
                        quoteText={h.hadithText}
                        sourceName="الموسوعة الحديثية (الدرر السنية)"
                        sectionName={`التخريج: ${h.takhrij}`}
                        sourceUrl={h.dorarUrl}
                      />

                      {h.wordMeanings && (
                        <SourceQuoteBox
                          title="معاني ألفاظ الحديث"
                          badgeText="نص منقول من المصدر"
                          quoteText={h.wordMeanings}
                          sourceName="موسوعة الأحاديث النبوية (HadeethEnc)"
                          sectionName={h.hadeethEncRef}
                          sourceUrl={h.hadeethEncUrl}
                          isSubBox={true}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
