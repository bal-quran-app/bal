import React from 'react';
import type { Verdict } from '../../data/types';

interface AiCommentBoxProps {
  verdict: Verdict;
  message: string;
  decidedBy: 'rule' | 'ai';
  aiNote?: string;
  aiConfidence?: number;
  aiModel?: string;
}

export function getVerdictColor(verdict: Verdict): string {
  switch (verdict) {
    case 'صحيح':
      return '#2E7D4F';
    case 'جزئي':
      return '#B7791F';
    case 'خطأ':
      return '#C05621';
    case 'خطأ واثق':
      return '#B42318';
    default:
      return '#4A6572';
  }
}

export const AiCommentBox: React.FC<AiCommentBoxProps> = ({
  verdict,
  message,
  decidedBy,
  aiNote,
  aiModel,
}) => {
  const verdictColor = getVerdictColor(verdict);
  const badgeLabel =
    decidedBy === 'rule'
      ? 'حكم بقاعدة ثابتة في التطبيق'
      : 'تصنيف آلي بالذكاء الاصطناعي (Gemini) — قد يخطئ';

  return (
    <div className="bg-white rounded-lg border border-dashed border-[#8A9A9A] p-4 my-3 text-right shadow-xs">
      {/* الوسم العلوي */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
        <span className="text-xs text-[#5B6B6B] font-medium flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: verdictColor }}
          />
          {badgeLabel}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-sm"
          style={{
            color: verdictColor,
            backgroundColor: `${verdictColor}15`,
          }}
        >
          {verdict}
        </span>
      </div>

      {/* نص الرسالة والحكم */}
      <div className="text-base md:text-lg leading-relaxed text-[#1D2B2A] font-sans font-medium mb-1">
        {message}
      </div>

      {/* الملاحظة إن وُجدت */}
      {aiNote && (
        <div className="text-xs text-[#5B6B6B] mt-2 pt-2 border-t border-gray-100 font-sans">
          {aiNote}
        </div>
      )}

      {/* اسم النموذج إن وُجد */}
      {aiModel && (
        <div className="text-[11px] text-[#8A9A9A] mt-2 font-sans font-medium">
          النموذج: <span className="font-mono text-[#1F5F5B]">{aiModel}</span>
        </div>
      )}
    </div>
  );
};
