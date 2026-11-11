/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Quran Page Data Provider (Read-Only Interface)
 * 
 * Contains verified, authentic Uthmani Quranic Arabic text for Surah Al-Baqarah
 * (Ayahs 1 to 286, Pages 2 to 49) and Surah Al-Fatihah (Ayahs 1 to 7, Page 1).
 * Formatted into standard 15-line Mushaf pages with Ayahs, verse markers, and
 * stable word identifiers.
 */

import verifiedPagesJson from './quranSurahBaqarah.json';

export interface MushafWord {
  id: string; // e.g. "p4_l9_w3"
  pageNumber: number;
  lineNumber: number; // 1 to 15
  wordIndex: number; // 1 to ~12
  text: string; // Verified Arabic word
  ayahNumber?: number;
  isAyahEnd?: boolean;
  ayahMarker?: string; // e.g. " ﴿٥﴾ "
}

export interface MushafLine {
  lineNumber: number; // 1 to 15
  isHeaderLine?: boolean;
  isBismillahLine?: boolean;
  words: MushafWord[];
}

export interface MushafPage {
  pageNumber: number;
  juzNumber: number; // 1 to 30
  surahName: string;
  surahEnglishName?: string;
  surahNumber: number;
  hasSurahHeader?: boolean;
  hasBismillah?: boolean;
  startAyah?: number;
  endAyah?: number;
  lines: MushafLine[];
}

export interface WordLocation {
  page: number;
  line: number;
  wordIndex: number;
  wordId: string;
}

// Fixed Surah names metadata for pages beyond 49
const SURAH_NAMES_METADATA: { [pageRangeStart: number]: { name: string; urduName: string; num: number } } = {
  1: { name: 'Al-Fatihah', urduName: 'الفاتحة', num: 1 },
  2: { name: 'Al-Baqarah', urduName: 'البقرة', num: 2 },
  50: { name: 'Ali \'Imran', urduName: 'آل عمران', num: 3 },
  77: { name: 'An-Nisa', urduName: 'النساء', num: 4 },
  106: { name: 'Al-Ma\'idah', urduName: 'المائدة', num: 5 },
  128: { name: 'Al-An\'am', urduName: 'الأنعام', num: 6 },
  151: { name: 'Al-A\'raf', urduName: 'الأعراف', num: 7 },
  177: { name: 'Al-Anfal', urduName: 'الأنفال', num: 8 },
  187: { name: 'At-Tawbah', urduName: 'التوبة', num: 9 },
  208: { name: 'Yunus', urduName: 'يونس', num: 10 },
};

function getSurahForPage(pageNumber: number) {
  const starts = Object.keys(SURAH_NAMES_METADATA)
    .map(Number)
    .sort((a, b) => b - a);
  for (const start of starts) {
    if (pageNumber >= start) {
      return SURAH_NAMES_METADATA[start];
    }
  }
  return { name: 'Surah', urduName: 'سورۃ', num: 1 };
}

// In-memory cache
const verifiedPages: Record<number, MushafPage> = verifiedPagesJson as unknown as Record<number, MushafPage>;
const fallbackCache: Map<number, MushafPage> = new Map();

/**
 * Standard 15-line Mushaf Page Getter
 * Returns verified Arabic text for Surah Al-Baqarah (Pages 2-49) and Al-Fatihah (Page 1).
 */
export function getPage(pageNumber: number): MushafPage {
  const validPage = Math.max(1, Math.min(604, Math.floor(pageNumber)));

  // 1. Check verified Surah Al-Baqarah / Al-Fatihah pages
  if (verifiedPages[validPage]) {
    const p = verifiedPages[validPage];
    return {
      pageNumber: p.pageNumber,
      juzNumber: p.juzNumber,
      surahName: p.surahName,
      surahEnglishName: p.surahEnglishName || 'Al-Baqarah',
      surahNumber: p.pageNumber === 1 ? 1 : 2,
      hasSurahHeader: p.hasSurahHeader,
      hasBismillah: p.hasBismillah,
      startAyah: p.startAyah,
      endAyah: p.endAyah,
      lines: p.lines,
    };
  }

  // 2. Check cache for pages beyond 49
  if (fallbackCache.has(validPage)) {
    return fallbackCache.get(validPage)!;
  }

  const juzNumber = Math.min(30, Math.floor((validPage - 1) / 20) + 1);
  const surahInfo = getSurahForPage(validPage);
  const lines: MushafLine[] = [];

  for (let lineNumber = 1; lineNumber <= 15; lineNumber++) {
    const seed = (validPage * 31 + lineNumber * 17) % 3;
    const wordsPerLine = 8 + seed;

    const words: MushafWord[] = [];
    for (let wordIndex = 1; wordIndex <= wordsPerLine; wordIndex++) {
      const id = `p${validPage}_l${lineNumber}_w${wordIndex}`;
      words.push({
        id,
        pageNumber: validPage,
        lineNumber,
        wordIndex,
        text: `Word ${wordIndex}`,
      });
    }

    lines.push({
      lineNumber,
      words,
    });
  }

  const page: MushafPage = {
    pageNumber: validPage,
    juzNumber,
    surahName: surahInfo.name,
    surahEnglishName: surahInfo.name,
    surahNumber: surahInfo.num,
    lines,
  };

  fallbackCache.set(validPage, page);
  return page;
}

/**
 * Fetch a word by its ID
 */
export function getWordById(wordId: string): MushafWord | null {
  const match = wordId.match(/^p(\d+)_l(\d+)_w(\d+)$/);
  if (!match) return null;
  const pageNum = parseInt(match[1], 10);
  const lineNum = parseInt(match[2], 10);
  const wordIdx = parseInt(match[3], 10);

  const page = getPage(pageNum);
  const line = page.lines.find(l => l.lineNumber === lineNum);
  if (!line) return null;
  return line.words.find(w => w.wordIndex === wordIdx) || null;
}

/**
 * Compare two word locations
 */
export function compareWordLocations(a: WordLocation, b: WordLocation): number {
  if (a.page !== b.page) return a.page - b.page;
  if (a.line !== b.line) return a.line - b.line;
  return a.wordIndex - b.wordIndex;
}

/**
 * Check if a word is inside an assigned range [start, end]
 */
export function isWordInRange(
  word: MushafWord,
  start: WordLocation,
  end: WordLocation
): boolean {
  const wordLoc: WordLocation = {
    page: word.pageNumber,
    line: word.lineNumber,
    wordIndex: word.wordIndex,
    wordId: word.id,
  };

  const [from, to] = compareWordLocations(start, end) <= 0 ? [start, end] : [end, start];
  return compareWordLocations(wordLoc, from) >= 0 && compareWordLocations(wordLoc, to) <= 0;
}

/**
 * Calculate the number of lines between two locations
 */
export function calculateRangeLines(start: WordLocation, end: WordLocation): number {
  const [from, to] = compareWordLocations(start, end) <= 0 ? [start, end] : [end, start];
  if (from.page === to.page) {
    return Math.max(1, to.line - from.line + 1);
  }
  const firstPageLines = 15 - from.line + 1;
  const fullMiddlePagesLines = Math.max(0, to.page - from.page - 1) * 15;
  const lastPageLines = to.line;
  return firstPageLines + fullMiddlePagesLines + lastPageLines;
}

/**
 * Advance a word location by lines
 */
export function advanceLocationByLines(loc: WordLocation, linesToAdd: number): WordLocation {
  let targetPage = loc.page;
  let targetLine = loc.line + linesToAdd;

  while (targetLine > 15) {
    targetLine -= 15;
    targetPage += 1;
  }

  const page = getPage(targetPage);
  const line = page.lines.find(l => l.lineNumber === targetLine) || page.lines[page.lines.length - 1];
  const word = line.words[Math.min(loc.wordIndex - 1, line.words.length - 1)] || line.words[0] || {
    id: `p${targetPage}_l${line.lineNumber}_w1`,
    wordIndex: 1,
    lineNumber: line.lineNumber,
    pageNumber: targetPage,
    text: '',
  };

  return {
    page: targetPage,
    line: line.lineNumber,
    wordIndex: word.wordIndex,
    wordId: word.id,
  };
}

/**
 * Returns exact start and end page for a given Para (Juz) 1 to 30
 */
export function getParaPageRange(paraNumber: number): { startPage: number; endPage: number } {
  const p = Math.max(1, Math.min(30, Math.floor(paraNumber)));
  if (p === 1) return { startPage: 1, endPage: 21 };
  const startPage = (p - 1) * 20 + 2;
  const endPage = Math.min(604, p * 20 + 1);
  return { startPage, endPage };
}

/**
 * Returns typical Surah names found in a Para
 */
export function getParaSurahName(paraNumber: number): string {
  const names: Record<number, string> = {
    1: 'Al-Fatihah & Al-Baqarah',
    2: 'Al-Baqarah (Part 2)',
    3: 'Al-Baqarah & Ali \'Imran',
    4: 'Ali \'Imran & An-Nisa',
    5: 'An-Nisa',
    6: 'An-Nisa & Al-Ma\'idah',
    7: 'Al-Ma\'idah & Al-An\'am',
    8: 'Al-An\'am & Al-A\'raf',
    9: 'Al-A\'raf & Al-Anfal',
    10: 'Al-Anfal & At-Tawbah',
    11: 'Yunus & Hud',
    12: 'Hud & Yusuf',
    13: 'Yusuf & Ar-Ra\'d & Ibrahim',
    14: 'Al-Hijr & An-Nahl',
    15: 'Al-Isra & Al-Kahf',
    16: 'Al-Kahf & Maryam & Ta-Ha',
    17: 'Al-Anbiya & Al-Hajj',
    18: 'Al-Mu\'minun & An-Nur & Al-Furqan',
    19: 'Al-Furqan & Ash-Shu\'ara & An-Naml',
    20: 'An-Naml & Al-Qasas & Al-\'Ankabut',
    21: 'Al-\'Ankabut & Ar-Rum & Luqman & As-Sajdah & Al-Ahzab',
    22: 'Al-Ahzab & Saba & Fatir & Ya-Sin',
    23: 'Ya-Sin & As-Saffat & Sad & Az-Zumar',
    24: 'Az-Zumar & Ghafir & Fussilat',
    25: 'Fussilat & Ash-Shura & Az-Zukhruf & Ad-Dukhan & Al-Jathiyah',
    26: 'Al-Ahqaf & Muhammad & Al-Fath & Al-Hujurat & Qaf & Adh-Dhariyat',
    27: 'Adh-Dhariyat & At-Tur & An-Najm & Al-Qamar & Ar-Rahman & Al-Waqi\'ah & Al-Hadid',
    28: 'Al-Mujadila to At-Tahrim',
    29: 'Al-Mulk to Al-Mursalat',
    30: 'An-Naba to An-Nas (Amma Yatasa\'alun)',
  };
  return names[paraNumber] || `Para ${paraNumber}`;
}

/**
 * Returns complete rich metadata for an assignment range
 */
export function getRangeMetadata(start: WordLocation, end: WordLocation) {
  const [from, to] = compareWordLocations(start, end) <= 0 ? [start, end] : [end, start];
  const startPageData = getPage(from.page);
  const linesCount = calculateRangeLines(from, to);
  return {
    surahName: startPageData.surahName,
    juzNumber: startPageData.juzNumber,
    startPage: from.page,
    endPage: to.page,
    startLine: from.line,
    endLine: to.line,
    linesCount,
  };
}

