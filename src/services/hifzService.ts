/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssignmentRange,
  MadrasaState,
  PartStatus,
  StudentProfile,
} from '../types/hifz';
import {
  WordLocation,
  advanceLocationByLines,
  compareWordLocations,
  getJuzMetadata,
  getNextWordAfter,
  getRangeMetadata,
  getWordById,
} from '../data/quranData';

export interface UnpassedSabaqInfo {
  date: string;
  dayNumber?: number;
  range: AssignmentRange;
  status: PartStatus;
}

export interface ParaCompletionStatus {
  currentJuz: number;
  isParaFinished: boolean;
  canStartNewPara: boolean;
  unpassedSabaqs: UnpassedSabaqInfo[];
  passedCountInPara: number;
  totalSabaqsInPara: number;
  paraEndLoc: WordLocation;
}

export interface CurrentParaSabqiInfo {
  range: AssignmentRange;
  passedCount: number;
  firstDate: string;
  lastDate: string;
}

export interface LinePreviewResult {
  range: AssignmentRange;
  basisLabel: string;
  lastPassedDate: string | null;
}

function doesSabaqBelongToPara(
  sabaqRange: AssignmentRange,
  sabaqJuz: number | undefined,
  paraNumber: number
): boolean {
  const paraMeta = getJuzMetadata(paraNumber);
  if (sabaqJuz === paraNumber || sabaqRange.juzNumber === paraNumber) {
    return true;
  }
  const [from, to] =
    compareWordLocations(sabaqRange.start, sabaqRange.end) <= 0
      ? [sabaqRange.start, sabaqRange.end]
      : [sabaqRange.end, sabaqRange.start];

  return (
    compareWordLocations(to, paraMeta.startLoc) >= 0 &&
    compareWordLocations(from, paraMeta.endLoc) <= 0
  );
}

function didSabaqReachParaEnd(sabaqRange: AssignmentRange, paraNumber: number): boolean {
  const paraMeta = getJuzMetadata(paraNumber);
  const [from, to] =
    compareWordLocations(sabaqRange.start, sabaqRange.end) <= 0
      ? [sabaqRange.start, sabaqRange.end]
      : [sabaqRange.end, sabaqRange.start];

  if (
    compareWordLocations(from, paraMeta.endLoc) <= 0 &&
    compareWordLocations(to, paraMeta.endLoc) >= 0
  ) {
    return true;
  }

  const endWord = getWordById(to.wordId);
  if (
    endWord &&
    endWord.juzNumber === paraNumber &&
    endWord.surahNumber === paraMeta.lastSurahNumber &&
    endWord.ayahNumber >= paraMeta.lastAyahNumber
  ) {
    return true;
  }

  return false;
}

function isSabaqBeforeHifzFreshBoundary(
  student: StudentProfile,
  dpDate: string,
  sabaq: { completedAt?: string; isNazraSabaq?: boolean }
): boolean {
  if (student.studentType === 'hifz') {
    if (sabaq.isNazraSabaq === true) return true;
    if (sabaq.isNazraSabaq === false) return false;
    if (student.hifzFreshFromIso) {
      if (sabaq.completedAt) {
        return sabaq.completedAt < student.hifzFreshFromIso;
      }
      return dpDate < student.hifzFreshFromIso.slice(0, 10);
    }
  }
  return false;
}

/**
 * Inspects all assigned Sabaqs in the student's current Para to determine completion and blockers.
 * Safely ignores empty/unassigned Sabaq slots (range === null).
 */
export function getParaCompletionStatus(
  student: StudentProfile,
  state: MadrasaState
): ParaCompletionStatus {
  const currentJuz = student.currentJuz || 1;
  const paraMeta = getJuzMetadata(currentJuz);
  const startDateBoundary = student.currentParaStartDate || '';
  const studentPlans = state.dailyPlans[student.id] || {};

  const sabaqsInPara = Object.values(studentPlans)
    .filter(
      dp =>
        dp.date >= startDateBoundary &&
        dp.sabaq &&
        dp.sabaq.range !== null &&
        !isSabaqBeforeHifzFreshBoundary(student, dp.date, dp.sabaq) &&
        doesSabaqBelongToPara(dp.sabaq.range, dp.sabaq.juzNumber, currentJuz)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  let isParaFinished = false;
  for (const dp of sabaqsInPara) {
    if (dp.sabaq.range && didSabaqReachParaEnd(dp.sabaq.range, currentJuz)) {
      isParaFinished = true;
      break;
    }
  }

  const unpassedSabaqs: UnpassedSabaqInfo[] = [];
  let passedCountInPara = 0;

  for (let i = 0; i < sabaqsInPara.length; i++) {
    const dp = sabaqsInPara[i];
    const dpRange = dp.sabaq.range!;
    const status = dp.sabaq.status;
    if (status === 'passed') {
      passedCountInPara++;
      continue;
    }

    const [dpStart, dpEnd] =
      compareWordLocations(dpRange.start, dpRange.end) <= 0
        ? [dpRange.start, dpRange.end]
        : [dpRange.end, dpRange.start];

    const laterPassedSameRange = sabaqsInPara.slice(i + 1).some(later => {
      if (later.sabaq.status !== 'passed' || !later.sabaq.range) return false;
      const [laterStart, laterEnd] =
        compareWordLocations(later.sabaq.range.start, later.sabaq.range.end) <= 0
          ? [later.sabaq.range.start, later.sabaq.range.end]
          : [later.sabaq.range.end, later.sabaq.range.start];
      return (
        compareWordLocations(laterStart, dpStart) <= 0 &&
        compareWordLocations(laterEnd, dpEnd) >= 0
      );
    });

    if (laterPassedSameRange) {
      passedCountInPara++;
      continue;
    }

    unpassedSabaqs.push({
      date: dp.date,
      dayNumber: dp.dayNumber,
      range: dpRange,
      status,
    });
  }

  return {
    currentJuz,
    isParaFinished,
    canStartNewPara: isParaFinished && unpassedSabaqs.length === 0,
    unpassedSabaqs,
    passedCountInPara,
    totalSabaqsInPara: sabaqsInPara.length,
    paraEndLoc: paraMeta.endLoc,
  };
}

/**
 * Sabqi = all PASSED Sabaq of the CURRENT Para. Repeat/pending/empty Sabaqs never enter Sabqi.
 * Returns null for Nazra students (Sabqi is hidden and not tracked in Nazra).
 */
export function computeCurrentParaSabqiRange(
  student: StudentProfile,
  state: MadrasaState,
  upToDate?: string
): CurrentParaSabqiInfo | null {
  if (student.studentType === 'nazra') {
    return null;
  }

  const currentJuz = student.currentJuz || 1;
  const maxDate = upToDate || state.currentDate;
  const startDateBoundary = student.currentParaStartDate || '';
  const studentPlans = state.dailyPlans[student.id] || {};

  const passedSabaqs = Object.values(studentPlans)
    .filter(
      dp =>
        dp.date <= maxDate &&
        dp.date >= startDateBoundary &&
        dp.sabaq &&
        dp.sabaq.range !== null &&
        dp.sabaq.status === 'passed' &&
        !isSabaqBeforeHifzFreshBoundary(student, dp.date, dp.sabaq) &&
        doesSabaqBelongToPara(dp.sabaq.range, dp.sabaq.juzNumber, currentJuz)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (passedSabaqs.length === 0) {
    return null;
  }

  const paraMeta = getJuzMetadata(currentJuz);
  let minStart = passedSabaqs[0].sabaq.range!.start;
  let maxEnd = passedSabaqs[0].sabaq.range!.end;

  for (const dp of passedSabaqs) {
    const r = dp.sabaq.range!;
    const [rStart, rEnd] =
      compareWordLocations(r.start, r.end) <= 0
        ? [r.start, r.end]
        : [r.end, r.start];

    if (compareWordLocations(rStart, minStart) < 0) {
      minStart = rStart;
    }
    if (compareWordLocations(rEnd, maxEnd) > 0) {
      maxEnd = rEnd;
    }
  }

  if (compareWordLocations(minStart, paraMeta.startLoc) < 0) {
    minStart = paraMeta.startLoc;
  }
  if (compareWordLocations(maxEnd, paraMeta.endLoc) > 0) {
    maxEnd = paraMeta.endLoc;
  }

  const meta = getRangeMetadata(minStart, maxEnd);
  return {
    range: {
      start: minStart,
      end: maxEnd,
      linesCount: meta.linesCount,
      surahName: meta.surahName,
      juzNumber: meta.juzNumber,
      startPage: meta.startPage,
      endPage: meta.endPage,
      startLine: meta.startLine,
      endLine: meta.endLine,
      startAyah: meta.startAyah,
      endAyah: meta.endAyah,
    },
    passedCount: passedSabaqs.length,
    firstDate: passedSabaqs[0].date,
    lastDate: passedSabaqs[passedSabaqs.length - 1].date,
  };
}

/**
 * Pure preview calculator ONLY used when the Ustaad explicitly opens the optional
 * "Assign by lines" dialog. Never called automatically and never persists until Confirmed.
 */
export function computePreviewRangeByLines(
  student: StudentProfile,
  state: MadrasaState,
  linesCount: number
): LinePreviewResult {
  const currentJuz = student.currentJuz || 1;
  const paraMeta = getJuzMetadata(currentJuz);
  const startDateBoundary = student.currentParaStartDate || '';
  const studentPlans = state.dailyPlans[student.id] || {};

  // Find the student's most recent passed Sabaq within the current Para (or overall)
  const passedInCurrentPara = Object.values(studentPlans)
    .filter(
      dp =>
        dp.date <= state.currentDate &&
        dp.date >= startDateBoundary &&
        dp.sabaq?.range &&
        dp.sabaq.status === 'passed'
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  let startLoc: WordLocation;
  let basisLabel: string;
  let lastPassedDate: string | null = null;

  if (passedInCurrentPara.length > 0 && passedInCurrentPara[0].sabaq.range) {
    const latestPassed = passedInCurrentPara[0];
    const lastRange = latestPassed.sabaq.range!;
    const lastEnd =
      compareWordLocations(lastRange.start, lastRange.end) <= 0
        ? lastRange.end
        : lastRange.start;
    startLoc = getNextWordAfter(lastEnd);
    lastPassedDate = latestPassed.date;
    basisLabel = `After passed Sabaq (${latestPassed.date}) ending P${lastEnd.page}:L${lastEnd.line}`;
  } else {
    startLoc = paraMeta.startLoc;
    basisLabel = `Para ${currentJuz} start (no prior passed Sabaq in this Para)`;
  }

  const safeLines = Math.max(1, Math.floor(linesCount));
  let endLoc = advanceLocationByLines(startLoc, safeLines - 1);
  if (
    compareWordLocations(startLoc, paraMeta.endLoc) <= 0 &&
    compareWordLocations(endLoc, paraMeta.endLoc) > 0
  ) {
    endLoc = paraMeta.endLoc;
  }

  const meta = getRangeMetadata(startLoc, endLoc);
  return {
    range: {
      start: startLoc,
      end: endLoc,
      linesCount: meta.linesCount,
      surahName: meta.surahName,
      juzNumber: meta.juzNumber,
      startPage: meta.startPage,
      endPage: meta.endPage,
      startLine: meta.startLine,
      endLine: meta.endLine,
      startAyah: meta.startAyah,
      endAyah: meta.endAyah,
    },
    basisLabel,
    lastPassedDate,
  };
}

/**
 * Helper to build a full-Para range from verified metadata (Manzil / 30-tile preview)
 */
export function getFullParaRange(paraNumber: number): AssignmentRange {
  const paraMeta = getJuzMetadata(paraNumber);
  const meta = getRangeMetadata(paraMeta.startLoc, paraMeta.endLoc);
  return {
    start: paraMeta.startLoc,
    end: paraMeta.endLoc,
    linesCount: meta.linesCount,
    surahName: meta.surahName,
    juzNumber: paraNumber,
    startPage: meta.startPage,
    endPage: meta.endPage,
    startLine: meta.startLine,
    endLine: meta.endLine,
    startAyah: meta.startAyah,
    endAyah: meta.endAyah,
  };
}

/**
 * Builds an AssignmentRange representing one or more selected Manzil Paras.
 * Calculates linesCount across ONLY the selected Paras (accurate even for non-adjacent Paras like [1, 3]).
 */
export function buildManzilCombinedRange(paras: number[]): AssignmentRange | null {
  const sorted = Array.from(new Set(paras)).filter(p => p >= 1 && p <= 30).sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const paraRanges = sorted.map(p => getFullParaRange(p));
  const first = paraRanges[0];
  const last = paraRanges[paraRanges.length - 1];
  const totalLines = paraRanges.reduce((sum, r) => sum + r.linesCount, 0);

  return {
    start: first.start,
    end: last.end,
    linesCount: totalLines,
    surahName: sorted.length === 1 ? first.surahName : `Paras ${sorted.join(', ')}`,
    juzNumber: sorted[0],
    startPage: first.startPage,
    endPage: last.endPage,
    startLine: first.startLine,
    endLine: last.endLine,
    startAyah: first.startAyah,
    endAyah: last.endAyah,
  };
}

/**
 * Returns individual per-Para AssignmentRanges for MushafViewer multi-range highlighting.
 */
export function getManzilParaRanges(
  assignedParas?: number[],
  fallbackRange?: AssignmentRange | null
): AssignmentRange[] {
  if (assignedParas && assignedParas.length > 0) {
    return Array.from(new Set(assignedParas))
      .filter(p => p >= 1 && p <= 30)
      .sort((a, b) => a - b)
      .map(p => getFullParaRange(p));
  }
  return fallbackRange ? [fallbackRange] : [];
}

