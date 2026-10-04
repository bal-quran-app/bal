import type { Verdict } from '../../data/types';

export interface SessionHistoryItem {
  id: string;
  before: Verdict;
  after: Verdict;
}

export interface SessionRecord {
  date: string;
  items: SessionHistoryItem[];
  confidentWrongBefore: number;
  confidentWrongAfter: number;
}

export interface WordProgress {
  seen: number;
  lastBefore: Verdict;
  lastAfter: Verdict;
  lastDate: string;
  intervalDays: number;
  due: string; // YYYY-MM-DD
}

export interface ProgressStorage {
  sessions: SessionRecord[];
  words: Record<string, WordProgress>;
}

const STORAGE_KEY = 'bal.progress.v1';

export function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getProgress(): ProgressStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], words: {} };
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
      words: parsed?.words && typeof parsed.words === 'object' ? parsed.words : {},
    };
  } catch {
    return { sessions: [], words: {} };
  }
}

export function saveSession(session: SessionRecord): void {
  try {
    const current = getProgress();
    current.sessions.unshift(session);
    // الاحتفاظ بآخر 20 رحلة كحد أقصى لتفادي تراكم التخزين
    if (current.sessions.length > 20) {
      current.sessions = current.sessions.slice(0, 20);
    }

    // تحديث المراجعة المتباعدة لكل لفظ في الرحلة
    session.items.forEach((item) => {
      const prev = current.words[item.id];
      const isBothCorrect = item.before === 'صحيح' && item.after === 'صحيح';
      let intervalDays = 1;
      if (isBothCorrect) {
        intervalDays = prev && prev.intervalDays > 0 ? prev.intervalDays * 2 : 3;
      } else {
        intervalDays = 1;
      }

      const due = addDaysToToday(intervalDays);
      const seen = (prev?.seen || 0) + 1;

      current.words[item.id] = {
        seen,
        lastBefore: item.before,
        lastAfter: item.after,
        lastDate: getTodayString(),
        intervalDays,
        due,
      };
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // تجاهل أخطاء التخزين بدون إيقاف التطبيق
  }
}

export function getLastSession(): SessionRecord | null {
  try {
    const progress = getProgress();
    return progress.sessions.length > 0 ? progress.sessions[0] : null;
  } catch {
    return null;
  }
}

export function getDueWordsCount(): number {
  try {
    const progress = getProgress();
    const today = getTodayString();
    return Object.values(progress.words).filter((w) => w.due <= today).length;
  } catch {
    return 0;
  }
}

export function getSeenWordsCount(): number {
  try {
    const progress = getProgress();
    return Object.keys(progress.words).length;
  } catch {
    return 0;
  }
}

export function clearProgress(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
