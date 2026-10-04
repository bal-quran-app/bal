import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[#1F5F5B]/15 bg-[#FAF7F0] py-8 text-center text-xs text-[#5B6B6B]">
      <div className="max-w-4xl mx-auto px-4 space-y-3">
        <p className="leading-relaxed">
          المعاني منقولة بنصها من مصادرها، والتصنيف بالذكاء الاصطناعي وقد يخطئ.
        </p>
        <div>
          <a
            href="#/sources"
            className="text-[#1F5F5B] hover:text-[#164845] font-semibold underline underline-offset-4"
          >
            المصادر والتراخيص
          </a>
        </div>
        <p className="text-[11px] text-[#8A9A9A] pt-2 border-t border-[#1F5F5B]/10">
          مشروع مشارك في تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي
        </p>
      </div>
    </footer>
  );
};
