'use client';

// Local draft persistence for in-progress tasting ratings, so a closed tab,
// refresh, or crash mid-tasting doesn't force someone to re-rate everything.
// Keyed per session + user so drafts never cross-contaminate between people
// sharing a device or reusing a URL.

type Ratings = Record<number, { aroma: number; appearance: number; taste: number; overall: number }>;
type TastingView = 'rating' | 'confirmation';

interface DraftState {
  ratings: Ratings;
  currentBeerIndex: number;
  view: TastingView;
  savedAt: number;
}

const DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days — stale drafts self-expire on read

function draftKey(sessionId: string, userName: string) {
  return `beer-tasting-draft:${sessionId}:${userName}`;
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const testKey = '__ls_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null; // private browsing / storage disabled / quota issues
  }
}

export function loadDraft(sessionId: string, userName: string): Omit<DraftState, 'savedAt'> | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(draftKey(sessionId, userName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      ls.removeItem(draftKey(sessionId, userName));
      return null;
    }
    return { ratings: parsed.ratings, currentBeerIndex: parsed.currentBeerIndex, view: parsed.view };
  } catch {
    return null;
  }
}

export function saveDraft(sessionId: string, userName: string, state: Omit<DraftState, 'savedAt'>) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(draftKey(sessionId, userName), JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // quota exceeded or blocked — silently no-op, don't break the UI
  }
}

export function clearDraft(sessionId: string, userName: string) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(draftKey(sessionId, userName));
  } catch {
    // noop
  }
}
