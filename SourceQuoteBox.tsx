import React from 'react';

interface SourceQuoteBoxProps {
  title?: string;
  badgeText?: string;
  quoteText: string;
  sourceName: string;
  sectionName?: string;
  locationNote?: string;
  sourceUrl?: string;
  isSubBox?: boolean;
}

export const SourceQuoteBox: React.FC<SourceQuoteBoxProps> = ({
  title,
  badgeText = 'نص منقول من المصدر',
  quoteText,
  sourceName,
  sectionName,
  locationNote,
  sourceUrl,
  isSubBox = false,
}) => {
  return (
    <div
      className={`rounded-lg bg-[#F4EFE3] text-[#1D2B2A] border-r-4 border-[#1F5F5B] p-4 my-3 text-right shadow-xs ${
        isSubBox ? 'text-sm' : ''
      }`}
    >
      {/* الوسم العلوي */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#1F5F5B] bg-[#1F5F5B]/10 px-2 py-0.5 rounded-sm">
          {badgeText}
        </span>
        {title && <span className="text-xs font-medium text-[#5B6B6B]">{title}</span>}
      </div>

      {/* النص المنقول بخط Amiri */}
      <div className={`font-amiri text-lg leading-relaxed text-[#1D2B2A] mb-3 whitespace-pre-line ${isSubBox ? 'text-base' : 'text-lg md:text-xl'}`}>
        {quoteText}
      </div>

      {/* الموضع إن وُجد */}
      {locationNote && (
        <div className="text-xs text-[#5B6B6B] mb-2 font-sans">
          موضع الشرح: {locationNote}
        </div>
      )}

      {/* المصدر والرابط */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1F5F5B]/15 text-xs text-[#5B6B6B]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[#164845]">{sourceName}</span>
          {sectionName && (
            <>
              <span className="text-[#8A9A9A]">·</span>
              <span>{sectionName}</span>
            </>
          )}
        </div>

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1F5F5B] hover:text-[#164845] font-medium underline underline-offset-4 flex items-center gap-1"
          >
            <span>افتح في المصدر</span>
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </div>
  );
};
