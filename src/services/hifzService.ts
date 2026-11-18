/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssignmentRange,
  MadrasaState,
  MistakeMark,
  PartStatus,
  StudentProfile,
} from '../types/hifz';
import {
  WordLocation,
  advanceLocationByLines,
  compareWordLocations,
  getJuzMetadata,
  getNextWordAfter,
  getPage,
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

export interface EffectivePauseSettings {
  pauseNewSabaqOnSabqiRepeat: boolean;
  pauseNewSabaqOnManzilRepeat: boolean;
}

export interface NewSabaqPauseStatus {
  isPaused: boolean;
  sabqiRepeatPending: boolean;
  sabqiRepeatDate: string | null;
  sabqiPaused: boolean;
  manzilRepeatPending: boolean;
  manzilRepeatParas: number[];
  manzilRepeatDate: string | null;
  manzilPaused: boolean;
  reasons: string[];
  detailedReasons: string[];
}

export function getEffectivePauseSettings(
  studentId: string,
  state: MadrasaState
): EffectivePauseSettings {
  const settings = state.settings;
  const legacyDefault = settings?.freezeSabaqOnSabqiOrManzilFail ?? true;
  const schoolSabqi = settings?.pauseNewSabaqOnSabqiRepeat ?? legacyDefault;
  const schoolManzil = settings?.pauseNewSabaqOnManzilRepeat ?? legacyDefault;
  const override = state.studentPauseOverride?.[studentId];
  return {
    pauseNewSabaqOnSabqiRepeat: override?.pauseNewSabaqOnSabqiRepeat ?? schoolSabqi,
    pauseNewSabaqOnManzilRepeat: override?.pauseNewSabaqOnManzilRepeat ?? schoolManzil,
  };
}

/**
 * Returns the latest unpassed Sabaq whose result was 'repeat' (if any),
 * when Sabqi/Manzil are not blocking and the same Sabaq should be assigned again.
 */
export function getLatestUnpassedRepeatSabaq(
  student: StudentProfile,
  state: MadrasaState,
  upToDate: string = state.currentDate
): { date: string; range: AssignmentRange } | null {
  const currentJuz = student.currentJuz || 1;
  const startDateBoundary = student.currentParaStartDate || '';
  const studentPlans = state.dailyPlans[student.id] || {};

  const sabaqs = Object.values(studentPlans)
    .filter(
      dp =>
        dp.date <= upToDate &&
        dp.date >= startDateBoundary &&
        dp.sabaq?.range &&
        !isSabaqBeforeHifzFreshBoundary(student, dp.date, dp.sabaq) &&
        doesSabaqBelongToPara(dp.sabaq.range, dp.sabaq.juzNumber, currentJuz)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const dp of sabaqs) {
    if (dp.sabaq.status === 'passed') return null;
    if (dp.sabaq.status === 'repeat' && dp.sabaq.range) {
      return { date: dp.date, range: dp.sabaq.range };
    }
  }
  return null;
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

  // If the student's latest Sabaq was marked Repeat (and not passed yet), re-assign that exact same Sabaq
  const repeatSabaq = getLatestUnpassedRepeatSabaq(student, state, state.currentDate);
  if (repeatSabaq) {
    const r = repeatSabaq.range;
    const meta = getRangeMetadata(r.start, r.end);
    return {
      range: {
        start: r.start,
        end: r.end,
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
      basisLabel: `Same Sabaq re-assigned (Sabaq on ${repeatSabaq.date} was Repeat)`,
      lastPassedDate: null,
    };
  }

  // Find the student's most recent passed Sabaq within the current Para (or overall)
  const passedInCurrentPara = Object.values(studentPlans)
    .filter(
      dp =>
        dp.date <= state.currentDate &&
        dp.date >= startDateBoundary &&
        dp.sabaq?.range &&
        dp.sabaq.status === 'passed' &&
        !isSabaqBeforeHifzFreshBoundary(student, dp.date, dp.sabaq) &&
        doesSabaqBelongToPara(dp.sabaq.range, dp.sabaq.juzNumber, currentJuz)
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

/**
 * Resolves the exact Para number(s) covered by a Manzil assignment.
 */
export function getManzilParasFromPlan(
  assignedParas?: number[],
  range?: AssignmentRange | null
): number[] {
  if (assignedParas && assignedParas.length > 0) {
    return Array.from(new Set(assignedParas))
      .filter(p => p >= 1 && p <= 30)
      .sort((a, b) => a - b);
  }
  if (!range) return [];
  const startWord = getWordById(range.start.wordId);
  const endWord = getWordById(range.end.wordId);
  const startJuz = startWord?.juzNumber || range.juzNumber || getPage(range.start.page).juzNumber;
  const endJuz = endWord?.juzNumber || range.juzNumber || getPage(range.end.page).juzNumber;
  const minJ = Math.min(startJuz, endJuz);
  const maxJ = Math.max(startJuz, endJuz);
  const result: number[] = [];
  for (let j = minJ; j <= maxJ; j++) {
    if (j >= 1 && j <= 30) result.push(j);
  }
  return result;
}

/**
 * Resolves which Para (1..30) a mistake mark belongs to.
 */
export function getMarkParaNumber(mark: MistakeMark): number {
  const word = getWordById(mark.wordId);
  if (word && word.juzNumber >= 1 && word.juzNumber <= 30) {
    return word.juzNumber;
  }
  return getPage(mark.page).juzNumber || 1;
}

export interface ManzilParaStates {
  dueParas: number[]; // Currently pending / in-progress Manzil paras on targetDate -> AMBER
  repeatParas: Record<number, string>; // Para number -> date marked Repeat -> RED (excludes active dueParas)
}

/**
 * Computes which completed Paras are currently "Manzil due" (Amber) vs "Repeat" (Red)
 * for a given student on a given viewed date.
 * - While pending/in_progress on targetDate -> due (Amber)
 * - Once graded Pass -> removed from due & repeat -> reverts to Green
 * - Once graded Repeat -> enters repeatParas[para] = date -> turns Red with "Repeat: <date>"
 * - Stays Red across subsequent days until assigned again (turns Amber while pending) and Passed (turns Green).
 */
export function computeManzilParaStates(
  student: StudentProfile,
  state: MadrasaState,
  targetDate: string
): ManzilParaStates {
  if (student.studentType === 'nazra') {
    return { dueParas: [], repeatParas: {} };
  }

  const studentPlans = Object.values(state.dailyPlans[student.id] || {})
    .filter(dp => dp.date <= targetDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const repeatMap: Record<number, string> = {};
  const resolvedDates: Record<number, string> = {};

  for (const dp of studentPlans) {
    const manzil = dp.manzil;
    if (!manzil) continue;

    if (manzil.paraResults && Object.keys(manzil.paraResults).length > 0) {
      for (const [pKey, outcome] of Object.entries(manzil.paraResults)) {
        const pNum = parseInt(pKey, 10);
        if (Number.isNaN(pNum) || pNum < 1 || pNum > 30) continue;
        resolvedDates[pNum] = dp.date;
        if (outcome === 'passed') {
          delete repeatMap[pNum];
        } else if (outcome === 'repeat') {
          repeatMap[pNum] = dp.date;
        }
      }
    } else if (manzil.status === 'passed' || manzil.status === 'repeat') {
      const paras = getManzilParasFromPlan(manzil.assignedParas, manzil.range);
      for (const pNum of paras) {
        resolvedDates[pNum] = dp.date;
        if (manzil.status === 'passed') {
          delete repeatMap[pNum];
        } else {
          repeatMap[pNum] = dp.date;
        }
      }
    }
  }

  // Merge any persisted repeat entries that have not been resolved at a later date
  if (student.manzilRepeatParas) {
    for (const [pKey, repDate] of Object.entries(student.manzilRepeatParas)) {
      const pNum = parseInt(pKey, 10);
      if (Number.isNaN(pNum) || !repDate || repDate > targetDate) continue;
      if (!resolvedDates[pNum] || repDate > resolvedDates[pNum]) {
        repeatMap[pNum] = repDate;
      }
    }
  }

  // Active pending/in_progress assignment on targetDate turns those paras AMBER (Manzil due)
  const targetPlan = state.dailyPlans[student.id]?.[targetDate]?.manzil;
  const dueSet = new Set<number>();
  if (
    targetPlan &&
    (targetPlan.status === 'pending' || targetPlan.status === 'in_progress')
  ) {
    const assigned = getManzilParasFromPlan(targetPlan.assignedParas, targetPlan.range);
    for (const pNum of assigned) {
      // Only show as due if this para hasn't already been individually resolved on this plan
      if (!targetPlan.paraResults?.[pNum]) {
        dueSet.add(pNum);
        delete repeatMap[pNum];
      }
    }
  }

  return {
    dueParas: Array.from(dueSet).sort((a, b) => a - b),
    repeatParas: repeatMap,
  };
}

/**
 * Evaluates whether assigning a NEW Sabaq is currently paused for a student on `targetDate`,
 * strictly based on whether a Sabqi Repeat or Manzil Repeat is ACTUALLY still pending (not yet passed)
 * AND the corresponding pause setting (school default or student override) is ON.
 * Never stays stuck due to stale flags once Sabqi/Manzil is passed.
 */
export function getNewSabaqPauseStatus(
  student: StudentProfile,
  state: MadrasaState,
  targetDate: string = state.currentDate
): NewSabaqPauseStatus {
  if (student.studentType === 'nazra') {
    return {
      isPaused: false,
      sabqiRepeatPending: false,
      sabqiRepeatDate: null,
      sabqiPaused: false,
      manzilRepeatPending: false,
      manzilRepeatParas: [],
      manzilRepeatDate: null,
      manzilPaused: false,
      reasons: [],
      detailedReasons: [],
    };
  }

  const hifzFreshDate = student.hifzFreshFromIso ? student.hifzFreshFromIso.slice(0, 10) : '';
  const studentPlans = Object.values(state.dailyPlans[student.id] || {})
    .filter(dp => dp.date <= targetDate && (!hifzFreshDate || dp.date >= hifzFreshDate))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 1. Track pending Sabqi Repeat (stays pending across days until a later or current Sabqi is marked 'passed')
  let sabqiRepeatDate: string | null = null;
  for (const dp of studentPlans) {
    if (!dp.sabqi) continue;
    if (dp.sabqi.status === 'repeat') {
      sabqiRepeatDate = dp.date;
    } else if (dp.sabqi.status === 'passed') {
      sabqiRepeatDate = null;
    }
  }
  const sabqiRepeatPending = Boolean(sabqiRepeatDate);

  // 2. Track pending Manzil Repeat (stays pending even while re-assigned as 'pending' until actually marked 'passed')
  const repeatMap: Record<number, string> = {};
  const resolvedDates: Record<number, string> = {};
  let legacyManzilRepeatDate: string | null = null;

  for (const dp of studentPlans) {
    const manzil = dp.manzil;
    if (!manzil) continue;

    if (manzil.paraResults && Object.keys(manzil.paraResults).length > 0) {
      legacyManzilRepeatDate = null;
      for (const [pKey, outcome] of Object.entries(manzil.paraResults)) {
        const pNum = parseInt(pKey, 10);
        if (Number.isNaN(pNum) || pNum < 1 || pNum > 30) continue;
        resolvedDates[pNum] = dp.date;
        if (outcome === 'passed') {
          delete repeatMap[pNum];
        } else if (outcome === 'repeat') {
          repeatMap[pNum] = dp.date;
        }
      }
    } else if (manzil.status === 'passed') {
      legacyManzilRepeatDate = null;
      const paras = getManzilParasFromPlan(manzil.assignedParas, manzil.range);
      for (const pNum of paras) {
        resolvedDates[pNum] = dp.date;
        delete repeatMap[pNum];
      }
    } else if (manzil.status === 'repeat') {
      const paras = getManzilParasFromPlan(manzil.assignedParas, manzil.range);
      if (paras.length > 0) {
        for (const pNum of paras) {
          resolvedDates[pNum] = dp.date;
          repeatMap[pNum] = dp.date;
        }
      } else {
        legacyManzilRepeatDate = dp.date;
      }
    }
  }

  if (student.manzilRepeatParas) {
    for (const [pKey, repDate] of Object.entries(student.manzilRepeatParas)) {
      const pNum = parseInt(pKey, 10);
      if (Number.isNaN(pNum) || !repDate || repDate > targetDate) continue;
      if (hifzFreshDate && repDate < hifzFreshDate) continue;
      if (!resolvedDates[pNum] || repDate > resolvedDates[pNum]) {
        repeatMap[pNum] = repDate;
      }
    }
  }

  const manzilRepeatParas = Object.keys(repeatMap)
    .map(k => parseInt(k, 10))
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => a - b);
  const manzilRepeatDate =
    manzilRepeatParas.length > 0
      ? manzilRepeatParas
          .map(p => repeatMap[p])
          .sort()
          .slice(-1)[0]
      : legacyManzilRepeatDate;
  const manzilRepeatPending = manzilRepeatParas.length > 0 || Boolean(legacyManzilRepeatDate);

  const effectivePause = getEffectivePauseSettings(student.id, state);
  const sabqiPaused = sabqiRepeatPending && effectivePause.pauseNewSabaqOnSabqiRepeat;
  const manzilPaused = manzilRepeatPending && effectivePause.pauseNewSabaqOnManzilRepeat;
  const isPaused = sabqiPaused || manzilPaused;

  const isUr = state.language === 'ur';
  const reasons: string[] = [];
  const detailedReasons: string[] = [];

  if (manzilPaused) {
    reasons.push(
      isUr
        ? 'نیا سبق رکا ہوا ہے کیونکہ منزل دہرانی ہے'
        : 'Paused because Manzil needs a repeat'
    );
    if (manzilRepeatParas.length > 0) {
      const paraListStr = manzilRepeatParas.join(', ');
      detailedReasons.push(
        isUr
          ? `نیا سبق موقوف ہے: منزل (پارہ ${paraListStr}) دہرانا باقی ہے۔`
          : `New Sabaq paused: Manzil (Para ${paraListStr}) needs a repeat.`
      );
    } else {
      detailedReasons.push(
        isUr
          ? 'نیا سبق موقوف ہے: منزل دہرانا باقی ہے۔'
          : 'New Sabaq paused: Manzil needs a repeat.'
      );
    }
  }

  if (sabqiPaused) {
    reasons.push(
      isUr
        ? 'نیا سبق رکا ہوا ہے کیونکہ سبقی دہرانی ہے'
        : 'Paused because Sabqi needs a repeat'
    );
    detailedReasons.push(
      isUr
        ? 'نیا سبق موقوف ہے: سبقی دہرانا باقی ہے۔'
        : 'New Sabaq paused: Sabqi needs a repeat.'
    );
  }

  return {
    isPaused,
    sabqiRepeatPending,
    sabqiRepeatDate,
    sabqiPaused,
    manzilRepeatPending,
    manzilRepeatParas,
    manzilRepeatDate,
    manzilPaused,
    reasons,
    detailedReasons,
  };
}

