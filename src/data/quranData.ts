/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read-Only Full Quran Data Provider (114 Surahs, 6,236 Ayahs, 30 Paras, 604 Pages)
 * Imported verbatim from Quran Foundation / Quran.com API v4.
 * Layout: 15-Line Madinah Mushaf (604 pages) with Indo-Pak (text_indopak) & Uthmani (text_uthmani).
 * See SOURCE.md for exact API endpoints, licence, fetch timestamp, and SHA-256 checksums.
 */

import quranPagesRaw from './quranPages.json';
import quranMetadataRaw from './quranMetadata.json';

export interface MushafWord {
  id: string; // e.g. "p4_l9_w3"
  pageNumber: number;
  lineNumber: number; // 1 to 15
  wordIndex: number; // 1 to N
  text: string; // Verbatim Indo-Pak text (text_indopak)
  textUthmani: string; // Verbatim Uthmani text (text_uthmani)
  surahNumber: number;
  ayahNumber: number;
  juzNumber: number;
  isAyahEnd?: boolean;
  ayahMarker?: string; // Verbatim Arabic ayah numeral from API end token
  rukuEndNumber?: number; // Present on the last word of a ruku
  rubQuarter?: number; // 1..8 within Juz (1=Juz start, 3=Rub/quarter, 5=Nisf/half, 7=Thalathah Arba/three-quarters)
  rubNumber?: number;
  hizbNumber?: number;
  sajdahNumber?: number;
}

export interface MushafLine {
  lineNumber: number; // 1 to 15
  isHeaderLine?: boolean;
  headerSurahNumber?: number;
  headerSurahName?: string;
  headerSurahArabicName?: string;
  headerSurahMeta?: string;
  isBismillahLine?: boolean;
  words: MushafWord[];
}

export interface MushafPage {
  pageNumber: number;
  juzNumber: number; // 1 to 30 (starting Juz of page)
  juzNumbers?: number[]; // All Juz numbers present on this page (handles shared-page boundaries like P62, P121, P201, P502)
  surahName: string;
  surahArabicName: string;
  surahEnglishName?: string;
  surahNumber: number;
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

export interface SurahInfo {
  id: number;
  nameSimple: string;
  nameArabic: string;
  revelationPlace: string;
  versesCount: number;
  bismillahPre: boolean;
  pages: [number, number];
}

export interface JuzInfo {
  juzNumber: number;
  versesCount: number;
  verseMapping: Record<string, string>;
  startPage: number;
  endPage: number;
  startLoc: WordLocation;
  endLoc: WordLocation;
  lastSurahNumber: number;
  lastAyahNumber: number;
}

interface CompactWord {
  id: string;
  wi: number;
  t: string;
  u: string;
  s: number;
  a: number;
  j: number;
  e?: number;
  am?: string;
  rk?: number;
  rb?: number;
  rbn?: number;
  hbn?: number;
  sj?: number;
}

interface CompactLine {
  l: number;
  h?: number;
  b?: number;
  w: CompactWord[];
}

interface CompactPage {
  p: number;
  j: number;
  s: number;
  sn: string;
  sa: string;
  sa1: number;
  sa2: number;
  lines: CompactLine[];
}

interface QuranMetadataFile {
  source: string;
  fetchedAt: string;
  totalSurahs: number;
  totalAyahs: number;
  totalJuzs: number;
  totalPages: number;
  chapters: SurahInfo[];
  juzs: JuzInfo[];
}

const rawPages = quranPagesRaw as unknown as Record<string, CompactPage>;
const metadata = quranMetadataRaw as unknown as QuranMetadataFile;

export const QURAN_DATA_INFO = {
  source: metadata.source,
  fetchedAt: metadata.fetchedAt,
  totalSurahs: metadata.totalSurahs,
  totalAyahs: metadata.totalAyahs,
  totalJuzs: metadata.totalJuzs,
  totalPages: metadata.totalPages,
  activeLayout: 'madinah' as const,
  totalMadinahPages: 604,
  totalHafiziPages: 610,
};

export const ALL_SURAHS: SurahInfo[] = metadata.chapters;
export const ALL_JUZS: JuzInfo[] = metadata.juzs;

const surahMap = new Map<number, SurahInfo>(ALL_SURAHS.map(c => [c.id, c]));
const juzMap = new Map<number, JuzInfo>(ALL_JUZS.map(j => [j.juzNumber, j]));
const pageCache = new Map<number, MushafPage>();

// Verbatim Bismillah text derived directly from Surah Al-Fatihah 1:1 in the read-only source data
const page1BismillahLine = rawPages['1']?.lines.find(l => l.l === 2)?.w || [];
export const VERBATIM_BISMILLAH = {
  indopak: page1BismillahLine.map(w => w.t).join(' '),
  uthmani: page1BismillahLine.map(w => w.u).join(' '),
};

function toArabicNumerals(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map(d => digits[parseInt(d, 10)] ?? d)
    .join('');
}

/**
 * Standard 15-line Mushaf Page Getter (Madinah 604-page layout)
 * Returns verified, unmodified Quranic Arabic words from local read-only JSON.
 */
export function getPage(pageNumber: number): MushafPage {
  const validPage = Math.max(1, Math.min(metadata.totalPages, Math.floor(pageNumber)));

  if (pageCache.has(validPage)) {
    return pageCache.get(validPage)!;
  }

  const raw = rawPages[String(validPage)];
  if (!raw) {
    throw new Error(`Quran page ${validPage} missing from local dataset.`);
  }

  // Pages 1 and 2 in the source layout have 8 populated lines (Surah header + Bismillah/1:1 + 6 text lines).
  // Follow the source data exactly rather than padding trailing empty lines; pages 3..604 keep all 15 lines.
  const sourceLines =
    validPage <= 2
      ? raw.lines.filter(cl => cl.h !== undefined || cl.b === 1 || cl.w.length > 0)
      : raw.lines;

  const lines: MushafLine[] = sourceLines.map(cl => {
    if (cl.h !== undefined) {
      const ch = surahMap.get(cl.h);
      const revAr = ch?.revelationPlace === 'makkah' ? 'مَكِّيَّةٌ' : 'مَدَنِيَّةٌ';
      const ayahCountAr = ch ? toArabicNumerals(ch.versesCount) : '';
      return {
        lineNumber: cl.l,
        isHeaderLine: true,
        headerSurahNumber: cl.h,
        headerSurahName: ch?.nameSimple || `Surah ${cl.h}`,
        headerSurahArabicName: ch?.nameArabic || '',
        headerSurahMeta: ch ? `${revAr} · آيَاتُهَا ${ayahCountAr}` : '',
        words: [],
      };
    }

    if (cl.b === 1) {
      return {
        lineNumber: cl.l,
        isBismillahLine: true,
        words: [],
      };
    }

    const words: MushafWord[] = cl.w.map(cw => ({
      id: cw.id,
      pageNumber: validPage,
      lineNumber: cl.l,
      wordIndex: cw.wi,
      text: cw.t,
      textUthmani: cw.u,
      surahNumber: cw.s,
      ayahNumber: cw.a,
      juzNumber: cw.j,
      isAyahEnd: cw.e === 1,
      ayahMarker: cw.am,
      rukuEndNumber: cw.rk,
      rubQuarter: cw.rb,
      rubNumber: cw.rbn,
      hizbNumber: cw.hbn,
      sajdahNumber: cw.sj,
    }));

    return {
      lineNumber: cl.l,
      words,
    };
  });

  const juzSeen = new Set<number>();
  const juzNumbers: number[] = [];
  for (const ln of lines) {
    for (const w of ln.words) {
      if (w.juzNumber >= 1 && w.juzNumber <= 30 && !juzSeen.has(w.juzNumber)) {
        juzSeen.add(w.juzNumber);
        juzNumbers.push(w.juzNumber);
      }
    }
  }
  if (juzNumbers.length === 0 && raw.j >= 1 && raw.j <= 30) {
    juzNumbers.push(raw.j);
  }

  const page: MushafPage = {
    pageNumber: raw.p,
    juzNumber: raw.j,
    juzNumbers,
    surahName: raw.sn,
    surahArabicName: raw.sa,
    surahEnglishName: raw.sn,
    surahNumber: raw.s,
    startAyah: raw.sa1,
    endAyah: raw.sa2,
    lines,
  };

  pageCache.set(validPage, page);
  return page;
}

/**
 * Fetch a word by its ID (e.g. "p4_l9_w3")
 */
export function getWordById(wordId: string): MushafWord | null {
  const match = wordId.match(/^p(\d+)_l(\d+)_w(\d+)$/);
  if (!match) return null;
  const pageNum = parseInt(match[1], 10);
  const lineNum = parseInt(match[2], 10);
  const wordIdx = parseInt(match[3], 10);

  if (pageNum < 1 || pageNum > metadata.totalPages) return null;
  const page = getPage(pageNum);
  const line = page.lines.find(l => l.lineNumber === lineNum);
  if (!line) return null;
  return line.words.find(w => w.wordIndex === wordIdx) || null;
}

/**
 * Find the first real word on or after a given page/line
 */
export function getFirstWordOnOrAfter(pageNum: number, lineNum = 1): WordLocation {
  let p = Math.max(1, Math.min(metadata.totalPages, pageNum));
  let l = Math.max(1, Math.min(15, lineNum));
  while (p <= metadata.totalPages) {
    const page = getPage(p);
    for (const line of page.lines) {
      if (line.lineNumber >= l && line.words.length > 0) {
        const w = line.words[0];
        return { page: p, line: line.lineNumber, wordIndex: w.wordIndex, wordId: w.id };
      }
    }
    p++;
    l = 1;
  }
  return juzMap.get(30)!.endLoc;
}

/**
 * Find the last real word on or before a given page/line
 */
export function getLastWordOnOrBefore(pageNum: number, lineNum = 15): WordLocation {
  let p = Math.max(1, Math.min(metadata.totalPages, pageNum));
  let l = Math.max(1, Math.min(15, lineNum));
  while (p >= 1) {
    const page = getPage(p);
    for (let idx = page.lines.length - 1; idx >= 0; idx--) {
      const line = page.lines[idx];
      if (line.lineNumber <= l && line.words.length > 0) {
        const w = line.words[line.words.length - 1];
        return { page: p, line: line.lineNumber, wordIndex: w.wordIndex, wordId: w.id };
      }
    }
    p--;
    l = 15;
  }
  return juzMap.get(1)!.startLoc;
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
  let count = 0;
  for (let p = from.page; p <= to.page; p++) {
    const page = getPage(p);
    for (const line of page.lines) {
      if (line.words.length === 0) continue;
      if (p === from.page && line.lineNumber < from.line) continue;
      if (p === to.page && line.lineNumber > to.line) continue;
      count++;
    }
  }
  return Math.max(1, count);
}

/**
 * Advance a word location forward by N actual text lines, landing on the last word of that line
 */
export function advanceLocationByLines(loc: WordLocation, linesToAdd: number): WordLocation {
  let remaining = Math.max(0, Math.floor(linesToAdd));
  let lastMatchedLine: { page: number; lineNumber: number; words: MushafWord[] } | null = null;

  for (let p = loc.page; p <= metadata.totalPages; p++) {
    const page = getPage(p);
    for (const line of page.lines) {
      if (line.words.length === 0) continue;
      if (p === loc.page && line.lineNumber < loc.line) continue;

      lastMatchedLine = { page: p, lineNumber: line.lineNumber, words: line.words };
      if (remaining === 0) {
        const w = line.words[line.words.length - 1];
        return {
          page: p,
          line: line.lineNumber,
          wordIndex: w.wordIndex,
          wordId: w.id,
        };
      }
      remaining--;
    }
  }

  if (lastMatchedLine && lastMatchedLine.words.length > 0) {
    const w = lastMatchedLine.words[lastMatchedLine.words.length - 1];
    return {
      page: lastMatchedLine.page,
      line: lastMatchedLine.lineNumber,
      wordIndex: w.wordIndex,
      wordId: w.id,
    };
  }

  return getLastWordOnOrBefore(metadata.totalPages, 15);
}

/**
 * Advance to the word immediately following `loc` (for starting tomorrow's Sabaq cleanly after yesterday's last word)
 */
export function getNextWordAfter(loc: WordLocation): WordLocation {
  const page = getPage(loc.page);
  const line = page.lines.find(l => l.lineNumber === loc.line);
  if (line) {
    const nextInLine = line.words.find(w => w.wordIndex > loc.wordIndex);
    if (nextInLine) {
      return {
        page: loc.page,
        line: loc.line,
        wordIndex: nextInLine.wordIndex,
        wordId: nextInLine.id,
      };
    }
  }
  if (loc.line < 15) {
    return getFirstWordOnOrAfter(loc.page, loc.line + 1);
  }
  if (loc.page < metadata.totalPages) {
    return getFirstWordOnOrAfter(loc.page + 1, 1);
  }
  return loc;
}

export function getSurahMetadata(surahNumber: number): SurahInfo | undefined {
  return surahMap.get(surahNumber);
}

export function getJuzMetadata(juzNumber: number): JuzInfo {
  const j = Math.max(1, Math.min(30, Math.floor(juzNumber)));
  return juzMap.get(j)!;
}

/**
 * Returns exact start and end page for a given Para (Juz) 1 to 30 from verified source layout metadata.
 * Both 'madinah' (604p) and 'hafizi' fallback currently map to the verified 604-page quranMetadata.json source dataset
 * until 610-page Hafizi layout data is added.
 */
export function getParaPageRange(
  paraNumber: number,
  _layout: 'hafizi' | 'madinah' = 'madinah'
): { startPage: number; endPage: number } {
  const info = getJuzMetadata(paraNumber);
  return { startPage: info.startPage, endPage: info.endPage };
}

/**
 * Returns Surah names contained in a Para from verified verseMapping
 */
export function getParaSurahName(paraNumber: number): string {
  const info = getJuzMetadata(paraNumber);
  const surahIds = Object.keys(info.verseMapping)
    .map(Number)
    .sort((a, b) => a - b);
  const names = surahIds
    .map(id => surahMap.get(id)?.nameSimple)
    .filter(Boolean) as string[];
  if (names.length <= 3) return names.join(' & ');
  return `${names[0]} to ${names[names.length - 1]}`;
}

/**
 * Returns complete rich metadata for an assignment range
 */
export function getRangeMetadata(start: WordLocation, end: WordLocation) {
  const [from, to] = compareWordLocations(start, end) <= 0 ? [start, end] : [end, start];
  const startPageData = getPage(from.page);
  const endPageData = getPage(to.page);
  const linesCount = calculateRangeLines(from, to);

  const startWord =
    getWordById(from.wordId) ||
    startPageData.lines.find(l => l.lineNumber === from.line)?.words.find(w => w.wordIndex === from.wordIndex) ||
    startPageData.lines.find(l => l.words.length > 0)?.words[0];

  const endWord =
    getWordById(to.wordId) ||
    endPageData.lines.find(l => l.lineNumber === to.line)?.words.find(w => w.wordIndex === to.wordIndex) ||
    endPageData.lines[endPageData.lines.length - 1]?.words.slice(-1)[0];

  const startSurah = startWord ? surahMap.get(startWord.surahNumber)?.nameSimple : startPageData.surahName;
  const endSurah = endWord ? surahMap.get(endWord.surahNumber)?.nameSimple : endPageData.surahName;
  const surahLabel =
    startSurah && endSurah && startSurah !== endSurah ? `${startSurah} – ${endSurah}` : startSurah || startPageData.surahName;

  return {
    surahName: surahLabel,
    juzNumber: startWord?.juzNumber || startPageData.juzNumber,
    startPage: from.page,
    endPage: to.page,
    startLine: from.line,
    endLine: to.line,
    linesCount,
    startAyah: startWord?.ayahNumber,
    endAyah: endWord?.ayahNumber,
  };
}
