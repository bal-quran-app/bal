import React, { useState } from 'react';
import { SOURCES, EXCLUDED } from '../../data/bal-data';
import { GEMINI_MODELS } from '../services/classifier';
import { clearProgress } from '../services/storage';
import { Trash2, AlertCircle, CheckCircle } from 'lucide-react';

export const SourcesPage: React.FC = () => {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearedStatus, setClearedStatus] = useState<string | null>(null);

  const handleClearProgress = () => {
    const success = clearProgress();
    if (success) {
      setClearedStatus('تم مسح جميع بيانات تقدّمك والمراجعة المتباعدة بنجاح من هذا المتصفح.');
    } else {
      setClearedStatus('تعذر مسح البيانات.');
    }
    setConfirmClearOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-right">
      <h1 className="font-amiri text-3xl sm:text-4xl font-bold text-[#1F5F5B] mb-8">
        المصادر والتراخيص
      </h1>

      {/* أ. كيف يعمل «بَلْ» */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">
          أ. كيف يعمل «بَلْ»
        </h2>
        <ol className="list-decimal list-inside space-y-3 text-sm sm:text-base text-[#1D2B2A] leading-relaxed">
          <li>يُبحث عن اللفظ في موضعه (السورة والآية، أو الحديث) في القائمة الموثقة.</li>
          <li>
            أحكام بقواعد ثابتة لا يدخل فيها الذكاء الاصطناعي: «طلب إدخال» إن كانت الإجابة فارغة أو مكتوبة بغير العربية، و«لم يُجب» إن اختار المستخدم «لا أعرف»، و«امتناع» إن لم يكن اللفظ في موضعه في القائمة، و«بيان الخلاف» إن كان من الألفاظ التي استبعدناها لاختلاف في معناها.
          </li>
          <li>
            في ما سوى ذلك يقارن Gemini إجابة المستخدم بنص المصدر وحده، ويُرجع حكماً من ثمانية مع درجة ثقته: صحيح، جزئي، خطأ، إحالة، رفض الاختلاق، تنبيه على النص، إجابة غير صالحة، ثبات الحكم.
          </li>
          <li>
            إن قلّت ثقته عن 0.6، أو تعذّر الاتصال به، يمتنع التطبيق عن الحكم ويعرض نص المصدر ليقارن المستخدم بنفسه.
          </li>
          <li>
            «خطأ» مع «متأكد» يصير «خطأ واثق»، وهو ما يقيسه التطبيق قبل الرحلة وبعدها.
          </li>
          <li>
            المعنى المعروض منقول بنصه من مصدره دائماً، ولا يكتبه الذكاء الاصطناعي.
          </li>
        </ol>
      </section>

      {/* ب. المصادر */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">
          ب. المصادر
        </h2>
        {SOURCES.length > 0 ? (
          <div className="space-y-4">
            {SOURCES.map((source, index) => (
              <div key={index} className="p-4 bg-[#FAF7F0] rounded-lg border border-[#1F5F5B]/10">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-bold text-[#164845] text-base">{source.name}</h3>
                  {source.version && (
                    <span className="text-xs text-[#5B6B6B]">{source.version}</span>
                  )}
                </div>
                <p className="text-sm text-[#1D2B2A] leading-relaxed mb-2">{source.description}</p>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1F5F5B] hover:text-[#164845] font-semibold underline underline-offset-4 inline-flex items-center gap-1"
                  >
                    <span>زيارة المصدر</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#5B6B6B] italic font-sans">
            تُضاف المصادر مع البيانات الكاملة.
          </p>
        )}
      </section>

      {/* ج. قواعد اختيار المعنى */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">
          ج. قواعد اختيار المعنى
        </h2>
        <ol className="list-decimal list-inside space-y-3 text-sm sm:text-base text-[#1D2B2A] leading-relaxed">
          <li>اللفظ له مدخل في «غريب الكلمات» في موضعه: نص الموسوعة هو المعنى.</li>
          <li>مشروح في موضع آخر للكلمة بالمعنى نفسه: يُنقل ذلك النص ويُذكر موضعه، ويبقى اللفظ في الآية التي يقع فيها الفهم الخاطئ.</li>
          <li>ليس له مدخل في «غريب الكلمات»، ونص التفسير يصرّح بمعناه: تُنقل جملة التفسير بنصها مع اسم القسم.</li>
          <li>لا تذكر الموسوعة المعنى، أو يخالفها «السراج»، أو لا يؤيد معناها أن الفهم الشائع خطأ: يُستبعد اللفظ، ويُذكر سبب استبعاده.</li>
        </ol>
      </section>

      {/* د. مستويات المحتوى */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">
          د. مستويات المحتوى
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF7F0] border-b border-[#1F5F5B]/20 text-[#1D2B2A]">
                <th className="p-3 font-semibold w-1/4">المستوى (من الحزمة العلمية)</th>
                <th className="p-3 font-semibold w-1/3">التعامل المعتمد</th>
                <th className="p-3 font-semibold">في «بَلْ»</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1F5F5B]">أ: معلومات أصلية مستقرة</td>
                <td className="p-3">الإجابة المباشرة الموثقة بالمصدر</td>
                <td className="p-3">نص الآية والسورة ورقم الآية</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1F5F5B]">ب: شرح وتعريف واستدلال</td>
                <td className="p-3">الإجابة من المادة المعتمدة مع إظهار المرجع</td>
                <td className="p-3">معنى اللفظ من موسوعة التفسير مع رابطه</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1F5F5B]">ج: مسائل خلافية أو عالية الحساسية</td>
                <td className="p-3">إجابة مقيدة بما هو معتمد، أو بيان وجود الخلاف</td>
                <td className="p-3">الألفاظ المستبعدة لاختلاف المصادر أو المفسرين</td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1F5F5B]">د: فتوى أو حالة شخصية</td>
                <td className="p-3">لا يقدم النظام حكماً مستقلاً؛ يوضح المعلومات العامة</td>
                <td className="p-3">أسئلة الأحكام: إحالة مع معنى اللفظ فقط</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* هـ. ألفاظ استبعدناها */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">
          هـ. ألفاظ استبعدناها ({EXCLUDED.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF7F0] border-b border-[#1F5F5B]/20 text-[#1D2B2A]">
                <th className="p-3 font-semibold w-1/5">اللفظ</th>
                <th className="p-3 font-semibold w-1/4">الموضع</th>
                <th className="p-3 font-semibold">سبب الاستبعاد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {EXCLUDED.map((ex, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="p-3 font-amiri text-base font-bold text-[#1F5F5B]">
                    {ex.word}
                  </td>
                  <td className="p-3 text-xs text-[#5B6B6B]">
                    سورة {ex.surahName}
                    {ex.ayahNumber ? `: ${ex.ayahNumber}` : ''}
                  </td>
                  <td className="p-3 text-xs leading-relaxed text-[#1D2B2A]">
                    {ex.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* و. التراخيص */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">
          و. التراخيص
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF7F0] border-b border-[#1F5F5B]/20 text-[#1D2B2A]">
                <th className="p-3 font-semibold w-1/3">العنصر</th>
                <th className="p-3 font-semibold">الترخيص والشروط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 leading-relaxed text-xs sm:text-sm">
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  نص القرآن الكريم وخط المصحف (مجمع الملك فهد لطباعة المصحف الشريف)
                </td>
                <td className="p-3">
                  نص الآيات منقول دون تعديل. رخصة الخط: يجوز استخدامه ونسخه وتوزيعه مجاناً، ولا يجوز بيعه ولا تعديله.
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  موسوعة التفسير والموسوعة الحديثية (الدرر السنية)
                </td>
                <td className="p-3">
                  من المرجعية المعتمدة في الحزمة العلمية للتحدي. يُنقل النص دون تعديل، مع ذكر الدرر السنية ورابط الصفحة.
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  موسوعة القرآن الكريم المترجمة (QuranEnc)
                </td>
                <td className="p-3">
                  عدم التعديل أو الإضافة أو الحذف، والإشارة بوضوح إلى الناشر والمصدر (QuranEnc.com)، وذكر رقم الإصدار عند إعادة النشر، وإبقاء معلومات نسخة الترجمة، وإفادة المصدر بأي ملاحظة، ومتابعة الإصدارات الجديدة، وعدم عرض إعلانات لا تليق بمعاني القرآن الكريم.
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  موسوعة الأحاديث النبوية (HadeethEnc)
                </td>
                <td className="p-3">
                  عدم التعديل أو الإضافة أو الحذف، والإشارة بوضوح إلى الناشر والمصدر (HadeethEnc.com)، وذكر رقم الإصدار عند إعادة النشر، وعدم عرض إعلانات لا تليق بالمحتوى.
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  خطوط Noto Sans Arabic وAmiri وAmiri Quran (Google Fonts)
                </td>
                <td className="p-3">
                  رخصة SIL Open Font License 1.1.
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  واجهة Gemini البرمجية
                </td>
                <td className="p-3">
                  شروط خدمة Google لواجهة Gemini:{' '}
                  <a
                    href="https://ai.google.dev/gemini-api/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1F5F5B] underline underline-offset-4"
                  >
                    https://ai.google.dev/gemini-api/terms
                  </a>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  OpenRouter
                </td>
                <td className="p-3">
                  شروط خدمة OpenRouter:{' '}
                  <a
                    href="https://openrouter.ai/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1F5F5B] underline underline-offset-4"
                  >
                    https://openrouter.ai/terms
                  </a>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-[#1D2B2A]">
                  شفرة المشروع والمحتوى الذي أعدّه الفريق
                </td>
                <td className="p-3">
                  الحقوق محفوظة للفريق، مع ترخيص غير حصري لمؤسسة باذل الأهلية وفق البند 13 من شروط التحدي.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ز. الشفافية */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">الشفافية</h2>
        <p className="text-base text-[#1D2B2A] leading-relaxed mb-3">
          التصنيف (صحيح، جزئي، خطأ، خطأ واثق) يجريه نموذج Gemini من Google، وهو ذكاء اصطناعي قد يخطئ. أما المعاني فلا يكتبها الذكاء الاصطناعي: كل معنى منقول بنصه من مصدره مع رابطه، ويظهر في إطار «نص منقول من المصدر».
        </p>
        <p className="text-sm text-[#5B6B6B] font-sans leading-relaxed">
          يجري التصنيف بنموذج gemini-3.8-flash من Google عبر OpenRouter. وإن تعذّر ذلك، فعبر Gemini API مباشرة بهذه النماذج بالترتيب: {GEMINI_MODELS.join('، ')}.
        </p>
      </section>

      {/* الخصوصية */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-[#1F5F5B]/15 shadow-xs mb-8">
        <h2 className="font-amiri text-2xl font-bold text-[#1D2B2A] mb-4">الخصوصية</h2>
        <p className="text-base text-[#1D2B2A] leading-relaxed mb-6">
          لا يتطلب «بَلْ» تسجيل دخول، ولا يجمع أي بيانات شخصية. يُحفظ تقدّمك في متصفحك على هذا الجهاز فقط، ويمكنك مسحه في أي وقت. وتُرسل الإجابة التي تكتبها وحدها عبر OpenRouter إلى Gemini من Google لتصنيفها، دون أي معلومة تعرّف بك.
        </p>

        {clearedStatus && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{clearedStatus}</span>
          </div>
        )}

        {!confirmClearOpen ? (
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>امسح تقدّمي من هذا المتصفح</span>
          </button>
        ) : (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>هل أنت متأكد من مسح جميع بيانات تقدّمك وجلساتك السابقة من هذا الجهاز؟</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearProgress}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors cursor-pointer"
              >
                نعم، امسح الآن
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
