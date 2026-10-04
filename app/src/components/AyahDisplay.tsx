import React from 'react';

interface AyahDisplayProps {
  ayahText: string;
  ayahHighlight?: string;
  surahName: string;
  ayahNumber: number;
}

export const AyahDisplay: React.FC<AyahDisplayProps> = ({
  ayahText,
  ayahHighlight,
  surahName,
  ayahNumber,
}) => {
  const renderContent = () => {
    if (!ayahText) {
      return null;
    }

    if (!ayahHighlight) {
      return <span>{ayahText}</span>;
    }

    const index = ayahText.indexOf(ayahHighlight);
    if (index === -1) {
      return <span>{ayahText}</span>;
    }

    const before = ayahText.substring(0, index);
    const highlighted = ayahText.substring(index, index + ayahHighlight.length);
    const after = ayahText.substring(index + ayahHighlight.length);

    return (
      <>
        <span>{before}</span>
        <span className="bg-[rgba(176,138,62,0.18)] border-b-2 border-[#B08A3E] px-1 rounded-xs inline-block">
          {highlighted}
        </span>
        <span>{after}</span>
      </>
    );
  };

  return (
    <div className="text-center my-4 px-2">
      <div className="font-quran text-[#1D2B2A]">
        <span className="text-[#1F5F5B] font-bold mx-1">﴿</span>
        {renderContent()}
        <span className="text-[#1F5F5B] font-bold mx-1">﴾</span>
      </div>
      <div className="text-xs md:text-sm text-[#5B6B6B] mt-2 font-sans font-medium">
        [{surahName}: {ayahNumber}]
      </div>
    </div>
  );
};
