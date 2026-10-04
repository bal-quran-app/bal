export type Confidence = 'متأكد' | 'متردد' | 'لا أعرف';

export type Verdict =
  | 'صحيح' | 'جزئي' | 'خطأ' | 'خطأ واثق'
  | 'امتناع' | 'إحالة' | 'رفض الاختلاق' | 'تنبيه على النص' | 'بيان الخلاف'
  | 'طلب إدخال' | 'لم يُجب' | 'إجابة غير صالحة' | 'ثبات الحكم';

export interface QuranEntry {
  id: string;
  word: string;
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  ayahText: string;
  ayahPlain: string;
  ayahHighlight: string;
  sourceMeaning: string;
  sourceSection: string;
  sourceUrl: string;
  sourceLocationNote?: string;
  sirajMeaning: string;
  sirajRelation: string;
  sirajUrl: string;
  commonMisreading: string;
  note?: string;
}

export interface HadithEntry {
  id: string;
  word: string;
  takhrij: string;
  dorarUrl: string;
  hadithText: string;
  hadeethEncRef: string;
  hadeethEncUrl: string;
  meaningFromHadith: string;
  wordMeanings?: string;
  commonMisreading: string;
}

export interface OutOfListEntry {
  word: string;
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  sourceSection: string;
  sourceUrl: string;
}

export interface ExcludedEntry {
  word: string;
  surahName: string;
  ayahNumber: number | null;
  reason: string;
  isDisagreement: boolean;
}

export interface SourceInfo {
  name: string;
  description: string;
  version?: string;
  url?: string;
}
