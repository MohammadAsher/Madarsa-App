/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MadrasaState, StudentLimits, DayPlan, DailyPartPlan, MistakeMark, SessionResult } from '../types/hifz';
import { advanceLocationByLines, calculateRangeLines, getRangeMetadata, getParaPageRange } from '../data/quranData';

const STORAGE_KEY = 'hifz_madrasa_prototype_state_v4'; // bumped key to ensure clean load of new assignment logic

export const DEFAULT_HALQA_LIMITS: StudentLimits = {
  sabaqGhaltiLimit: 2,
  sabaqAtkanLimit: 4,
  sabqiGhaltiLimit: 3,
  sabqiAtkanLimit: 5,
  manzilGhaltiLimit: 4,
  manzilAtkanLimit: 6,
};

/**
 * Creates rich, realistic demo data with both yesterday (Day 1) and today (Day 2)
 * so date navigation works immediately on first load.
 */
export function createInitialDemoState(): MadrasaState {
  const yesterday = '2026-11-10';
  const today = '2026-11-11';

  const students = {
    student_1: {
      id: 'student_1',
      name: 'Zayd ibn Haritha',
      urduName: 'زید بن حارثہ',
      ustaadId: 'ustaad_a' as const,
      halqaName: 'Halqa Al-Baqarah (Ustaad A)',
      enrollmentDate: '2026-01-15',
      currentJuz: 1,
      completedParas: [1], // Has completed Para 1, working in Para 2
      memorizedPortionDesc: 'Completed Para 1 (21 Pages)',
    },
    student_2: {
      id: 'student_2',
      name: 'Abdullah ibn Mas\'ud',
      urduName: 'عبد اللہ بن مسعود',
      ustaadId: 'ustaad_a' as const,
      halqaName: 'Halqa Al-Baqarah (Ustaad A)',
      enrollmentDate: '2026-02-01',
      currentJuz: 6,
      completedParas: [1, 2, 3, 4, 5], // Completed 5 Paras!
      memorizedPortionDesc: 'Completed Paras 1 - 5 (101 Pages)',
    },
    student_3: {
      id: 'student_3',
      name: 'Hamza ibn Abdul-Muttalib',
      urduName: 'حمزہ بن عبد المطلب',
      ustaadId: 'ustaad_a' as const,
      halqaName: 'Halqa Al-Baqarah (Ustaad A)',
      enrollmentDate: '2026-03-10',
      currentJuz: 1,
      completedParas: [], // New student: memorized 5 pages in Para 1
      memorizedPortionDesc: 'Memorized first 5 pages of Para 1',
    },
    student_4: {
      id: 'student_4',
      name: 'Ibrahim Al-Khalil',
      urduName: 'ابراہیم الخلیل',
      ustaadId: 'ustaad_b' as const,
      halqaName: 'Halqa Ali \'Imran (Ustaad B)',
      enrollmentDate: '2026-01-20',
      currentJuz: 13,
      completedParas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      memorizedPortionDesc: 'Completed Paras 1 - 12 (241 Pages)',
    },
    student_5: {
      id: 'student_5',
      name: 'Umar ibn Al-Khattab',
      urduName: 'عمر بن الخطاب',
      ustaadId: 'ustaad_b' as const,
      halqaName: 'Halqa Ali \'Imran (Ustaad B)',
      enrollmentDate: '2026-02-15',
      currentJuz: 16,
      completedParas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      memorizedPortionDesc: 'Completed 15 Paras (Half Quran)',
    },
  };

  const ustaads = {
    ustaad_a: {
      id: 'ustaad_a' as const,
      name: 'Ustaad Ahmad Al-Qari',
      urduName: 'استاد احمد القارئ',
      halqaName: 'Halqa Al-Baqarah',
      studentIds: ['student_1', 'student_2', 'student_3'],
    },
    ustaad_b: {
      id: 'ustaad_b' as const,
      name: 'Ustaad Bilal Al-Hafiz',
      urduName: 'استاد بلال الحافظ',
      halqaName: 'Halqa Ali \'Imran',
      studentIds: ['student_4', 'student_5'],
    },
  };

  const studentLimitsOverride: Record<string, Partial<StudentLimits>> = {
    student_2: {
      sabaqGhaltiLimit: 1,
      sabaqAtkanLimit: 3,
    },
    student_3: {
      sabaqGhaltiLimit: 3,
      sabaqAtkanLimit: 5,
    },
  };

  const makeRange = (startP: number, startL: number, startW: number, endP: number, endL: number, endW: number) => {
    const startLoc = {
      page: startP,
      line: startL,
      wordIndex: startW,
      wordId: `p${startP}_l${startL}_w${startW}`,
    };
    const endLoc = {
      page: endP,
      line: endL,
      wordIndex: endW,
      wordId: `p${endP}_l${endL}_w${endW}`,
    };
    const meta = getRangeMetadata(startLoc, endLoc);
    return {
      start: startLoc,
      end: endLoc,
      linesCount: meta.linesCount,
      surahName: meta.surahName,
      juzNumber: meta.juzNumber,
      startPage: meta.startPage,
      endPage: meta.endPage,
      startLine: meta.startLine,
      endLine: meta.endLine,
    };
  };

  // Seed plans for Day 1 (yesterday) AND Day 2 (today)
  const dailyPlans: Record<string, Record<string, DayPlan>> = {
    student_1: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(2, 3, 1, 3, 5, 6),
          status: 'passed',
          repeatPracticeCount: 8,
          targetRepeats: 10,
          completedAt: `${yesterday}T09:00:00Z`,
          sessionResultId: 'res_s1_yesterday',
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 2,
          endPage: 3,
          startLine: 3,
          endLine: 5,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(1, 1, 1, 2, 2, 4),
          status: 'passed',
          repeatPracticeCount: 5,
          targetRepeats: 5,
          completedAt: `${yesterday}T09:30:00Z`,
          sessionResultId: 'res_s1_yesterday_sabqi',
          portionType: 'quarter_para',
          portionLabel: 'Quarter Para (Pages 1 - 2)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 1, 1, 21, 15, 8),
          status: 'passed',
          repeatPracticeCount: 3,
          targetRepeats: 3,
          assignedParas: [1],
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: {
          part: 'sabaq',
          range: makeRange(3, 6, 1, 4, 8, 5), // Starting where yesterday ended!
          status: 'pending',
          repeatPracticeCount: 4,
          targetRepeats: 10,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 3,
          endPage: 4,
          startLine: 6,
          endLine: 8,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(2, 1, 1, 3, 5, 6),
          status: 'in_progress',
          repeatPracticeCount: 7,
          targetRepeats: 7,
          portionType: 'half_para',
          portionLabel: 'Half Para (Pages 2 - 3)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 1, 1, 21, 15, 8),
          status: 'pending',
          repeatPracticeCount: 2,
          targetRepeats: 5,
          assignedParas: [1],
        },
      },
    },
    student_2: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(4, 1, 1, 4, 15, 8),
          status: 'passed',
          repeatPracticeCount: 10,
          targetRepeats: 10,
          completedAt: `${yesterday}T08:30:00Z`,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 4,
          endPage: 4,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(2, 1, 1, 3, 15, 8),
          status: 'passed',
          repeatPracticeCount: 7,
          targetRepeats: 7,
          portionType: 'half_para',
          portionLabel: 'Half Para (Pages 2 - 3)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 1, 1, 21, 15, 8),
          status: 'passed',
          repeatPracticeCount: 3,
          targetRepeats: 3,
          assignedParas: [1],
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: {
          part: 'sabaq',
          range: makeRange(5, 1, 1, 5, 15, 8),
          status: 'passed',
          repeatPracticeCount: 12,
          targetRepeats: 10,
          completedAt: `${today}T08:30:00Z`,
          sessionResultId: 'res_seed_s2_sabaq',
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 5,
          endPage: 5,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(2, 1, 1, 4, 15, 8),
          status: 'pending',
          repeatPracticeCount: 5,
          targetRepeats: 7,
          portionType: 'custom',
          portionLabel: 'Recent 3 Pages (Pages 2 - 4)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(22, 1, 1, 41, 15, 8),
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [2], // Teacher selected Para 2 out of [1, 2, 3, 4, 5]!
        },
      },
    },
    student_3: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(2, 3, 1, 2, 15, 8),
          status: 'passed',
          repeatPracticeCount: 8,
          targetRepeats: 10,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 2,
          endPage: 2,
          startLine: 3,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(1, 1, 1, 2, 2, 4),
          status: 'repeat',
          repeatPracticeCount: 3,
          targetRepeats: 5,
          portionType: 'quarter_para',
          portionLabel: 'Opening Pages (Pages 1 - 2)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 1, 1, 2, 15, 8),
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [1],
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: {
          part: 'sabaq',
          range: makeRange(3, 1, 1, 3, 8, 7),
          status: 'repeat',
          repeatPracticeCount: 6,
          targetRepeats: 10,
          completedAt: `${today}T09:15:00Z`,
          sessionResultId: 'res_seed_s3_sabaq',
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 3,
          endPage: 3,
          startLine: 1,
          endLine: 8,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(1, 1, 1, 2, 15, 8),
          status: 'pending',
          repeatPracticeCount: 3,
          targetRepeats: 5,
          portionType: 'quarter_para',
          portionLabel: 'Quarter Para (Pages 1 - 2)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 1, 1, 2, 15, 8),
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [1],
        },
      },
    },
    student_4: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(10, 1, 1, 10, 15, 8),
          status: 'passed',
          repeatPracticeCount: 9,
          targetRepeats: 10,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 10,
          endPage: 10,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(5, 1, 1, 9, 15, 8),
          status: 'passed',
          repeatPracticeCount: 5,
          targetRepeats: 5,
          portionType: 'half_para',
          portionLabel: 'Half Para (Pages 5 - 9)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(82, 1, 1, 101, 15, 8),
          status: 'passed',
          repeatPracticeCount: 2,
          targetRepeats: 3,
          assignedParas: [5], // Teacher assigned Para 5 out of 12 completed!
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: {
          part: 'sabaq',
          range: makeRange(11, 1, 1, 11, 12, 8),
          status: 'pending',
          repeatPracticeCount: 5,
          targetRepeats: 8,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 11,
          endPage: 11,
          startLine: 1,
          endLine: 12,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(6, 1, 1, 10, 15, 8),
          status: 'pending',
          repeatPracticeCount: 3,
          targetRepeats: 5,
          portionType: 'half_para',
          portionLabel: 'Half Para (Pages 6 - 10)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(82, 1, 1, 101, 15, 8),
          status: 'pending',
          repeatPracticeCount: 2,
          targetRepeats: 3,
          assignedParas: [5],
        },
      },
    },
    student_5: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(15, 1, 1, 15, 15, 8),
          status: 'passed',
          repeatPracticeCount: 10,
          targetRepeats: 10,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 15,
          endPage: 15,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(10, 1, 1, 14, 15, 8),
          status: 'passed',
          repeatPracticeCount: 6,
          targetRepeats: 6,
          portionType: 'half_para',
          portionLabel: 'Half Para (Pages 10 - 14)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(42, 1, 1, 61, 15, 8),
          status: 'passed',
          repeatPracticeCount: 3,
          targetRepeats: 3,
          assignedParas: [3], // Teacher selected Para 3 out of 15 completed!
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: {
          part: 'sabaq',
          range: makeRange(16, 1, 1, 16, 15, 8),
          status: 'pending',
          repeatPracticeCount: 3,
          targetRepeats: 10,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 16,
          endPage: 16,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(11, 1, 1, 15, 15, 8),
          status: 'pending',
          repeatPracticeCount: 4,
          targetRepeats: 7,
          portionType: 'half_para',
          portionLabel: 'Half Para (Pages 11 - 15)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(42, 1, 1, 61, 15, 8),
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [3],
        },
      },
    },
  };

  const marksHistory: MistakeMark[] = [
    // Yesterday marks
    {
      id: 'mark_seed_1',
      studentId: 'student_1',
      date: yesterday,
      part: 'sabaq',
      wordId: 'p2_l4_w3',
      page: 2,
      line: 4,
      wordIndex: 3,
      type: 'ghalti',
      timestamp: Date.now() - 86400000,
    },
    {
      id: 'mark_seed_2',
      studentId: 'student_1',
      date: yesterday,
      part: 'sabaq',
      wordId: 'p3_l2_w4',
      page: 3,
      line: 2,
      wordIndex: 4,
      type: 'atkan',
      timestamp: Date.now() - 86000000,
    },
    // Today marks
    {
      id: 'mark_seed_3',
      studentId: 'student_3',
      date: today,
      part: 'sabaq',
      wordId: 'p3_l2_w4',
      page: 3,
      line: 2,
      wordIndex: 4,
      type: 'ghalti',
      timestamp: Date.now() - 10000000,
    },
    {
      id: 'mark_seed_4',
      studentId: 'student_3',
      date: today,
      part: 'sabaq',
      wordId: 'p3_l4_w2',
      page: 3,
      line: 4,
      wordIndex: 2,
      type: 'ghalti',
      timestamp: Date.now() - 9500000,
    },
    {
      id: 'mark_seed_5',
      studentId: 'student_3',
      date: today,
      part: 'sabaq',
      wordId: 'p3_l6_w5',
      page: 3,
      line: 6,
      wordIndex: 5,
      type: 'ghalti',
      timestamp: Date.now() - 9000000,
    },
    {
      id: 'mark_seed_6',
      studentId: 'student_3',
      date: today,
      part: 'sabaq',
      wordId: 'p3_l7_w1',
      page: 3,
      line: 7,
      wordIndex: 1,
      type: 'atkan',
      timestamp: Date.now() - 8500000,
    },
    {
      id: 'mark_seed_7',
      studentId: 'student_2',
      date: today,
      part: 'sabaq',
      wordId: 'p5_l6_w4',
      page: 5,
      line: 6,
      wordIndex: 4,
      type: 'atkan',
      timestamp: Date.now() - 12000000,
    },
  ];

  const sessionResults: SessionResult[] = [
    {
      id: 'res_s1_yesterday',
      studentId: 'student_1',
      date: yesterday,
      part: 'sabaq',
      ghaltiCount: 1,
      atkanCount: 1,
      ghaltiLimit: 2,
      atkanLimit: 4,
      suggestedResult: 'passed',
      finalResult: 'passed',
      isOverridden: false,
      marks: [marksHistory[0], marksHistory[1]],
      range: dailyPlans.student_1[yesterday].sabaq.range,
      timestamp: Date.now() - 86400000,
    },
    {
      id: 'res_seed_s2_sabaq',
      studentId: 'student_2',
      date: today,
      part: 'sabaq',
      ghaltiCount: 0,
      atkanCount: 1,
      ghaltiLimit: 1,
      atkanLimit: 3,
      suggestedResult: 'passed',
      finalResult: 'passed',
      isOverridden: false,
      marks: [marksHistory[6]],
      range: dailyPlans.student_2[today].sabaq.range,
      timestamp: Date.now() - 12000000,
    },
    {
      id: 'res_seed_s3_sabaq',
      studentId: 'student_3',
      date: today,
      part: 'sabaq',
      ghaltiCount: 3,
      atkanCount: 1,
      ghaltiLimit: 3,
      atkanLimit: 5,
      suggestedResult: 'repeat',
      finalResult: 'repeat',
      isOverridden: false,
      marks: [marksHistory[2], marksHistory[3], marksHistory[4], marksHistory[5]],
      range: dailyPlans.student_3[today].sabaq.range,
      timestamp: Date.now() - 8500000,
    },
  ];

  return {
    currentDate: today,
    dayCount: 2,
    currentRole: 'ustaad_a',
    language: 'en',
    settings: {
      freezeSabaqOnSabqiOrManzilFail: true,
      halqaDefaultLimits: { ...DEFAULT_HALQA_LIMITS },
    },
    students,
    ustaads,
    studentLimitsOverride,
    dailyPlans,
    marksHistory,
    sessionResults,
  };
}

export function loadState(): MadrasaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialDemoState();
      saveState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error('Failed to parse localStorage state, resetting:', err);
    const initial = createInitialDemoState();
    saveState(initial);
    return initial;
  }
}

export function saveState(state: MadrasaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

export function resetDemoState(): MadrasaState {
  localStorage.removeItem(STORAGE_KEY);
  const fresh = createInitialDemoState();
  saveState(fresh);
  return fresh;
}

/**
 * Returns a sorted unique list of all dates that currently exist in daily plans.
 */
export function getAllRecordedDates(state: MadrasaState): string[] {
  const dateSet = new Set<string>();
  Object.values(state.dailyPlans).forEach(studentHistory => {
    Object.keys(studentHistory).forEach(date => dateSet.add(date));
  });
  dateSet.add(state.currentDate);
  return Array.from(dateSet).sort();
}

/**
 * Navigate to the PREVIOUS day in history.
 * Does NOT overwrite or mutate any historical record.
 */
export function goToPreviousDate(currentState: MadrasaState): MadrasaState {
  const recordedDates = getAllRecordedDates(currentState);
  const currentIndex = recordedDates.indexOf(currentState.currentDate);

  let prevDate: string;
  let prevDayCount = Math.max(1, currentState.dayCount - 1);

  if (currentIndex > 0) {
    prevDate = recordedDates[currentIndex - 1];
  } else {
    // Decrement calendar date
    const d = new Date(currentState.currentDate);
    d.setDate(d.getDate() - 1);
    prevDate = d.toISOString().split('T')[0];
  }

  const updatedState: MadrasaState = {
    ...currentState,
    currentDate: prevDate,
    dayCount: prevDayCount,
  };

  saveState(updatedState);
  return updatedState;
}

/**
 * Navigate to the NEXT day.
 * If the next date already exists in history, it simply switches currentDate
 * without modifying or overwriting historical records!
 * Only if advancing past the latest date does it compute new promotion rules.
 */
export function advanceToNextDay(currentState: MadrasaState): MadrasaState {
  const recordedDates = getAllRecordedDates(currentState);
  const currentIndex = recordedDates.indexOf(currentState.currentDate);

  // If next date is already recorded in history, just navigate to it!
  if (currentIndex >= 0 && currentIndex < recordedDates.length - 1) {
    const nextExistingDate = recordedDates[currentIndex + 1];
    const updatedState: MadrasaState = {
      ...currentState,
      currentDate: nextExistingDate,
      dayCount: currentState.dayCount + 1,
    };
    saveState(updatedState);
    return updatedState;
  }

  // Otherwise, we are advancing past the latest recorded date!
  const currentD = new Date(currentState.currentDate);
  currentD.setDate(currentD.getDate() + 1);
  const nextDate = currentD.toISOString().split('T')[0];
  const nextDayCount = currentState.dayCount + 1;

  const newDailyPlans: Record<string, Record<string, DayPlan>> = { ...currentState.dailyPlans };

  for (const studentId of Object.keys(currentState.students)) {
    const studentHistory = currentState.dailyPlans[studentId] || {};
    const todayPlan = studentHistory[currentState.currentDate];

    if (!todayPlan) {
      continue;
    }

    const sabaqStatus = todayPlan.sabaq.status;
    const sabqiStatus = todayPlan.sabqi.status;
    const manzilStatus = todayPlan.manzil.status;

    const revisionFailed = sabqiStatus === 'repeat' || manzilStatus === 'repeat';
    const shouldFreezeNewSabaq = currentState.settings.freezeSabaqOnSabqiOrManzilFail && revisionFailed;

    let nextSabaqRange = { ...todayPlan.sabaq.range };
    let sabaqFrozenFlag = false;

    if (shouldFreezeNewSabaq) {
      sabaqFrozenFlag = true;
    } else if (sabaqStatus === 'repeat') {
      nextSabaqRange = { ...todayPlan.sabaq.range };
    } else {
      const lastEnd = todayPlan.sabaq.range.end;
      const linesLength = todayPlan.sabaq.range.linesCount || 8;
      const newStart = { ...lastEnd };
      const newEnd = advanceLocationByLines(newStart, linesLength);
      nextSabaqRange = {
        start: newStart,
        end: newEnd,
        linesCount: calculateRangeLines(newStart, newEnd),
      };
    }

    let nextSabqiRange = { ...todayPlan.sabqi.range };
    if (sabqiStatus === 'passed') {
      const nextSabqiStart = advanceLocationByLines(todayPlan.sabqi.range.start, 15);
      const nextSabqiEnd = advanceLocationByLines(todayPlan.sabqi.range.end, 15);
      nextSabqiRange = {
        start: nextSabqiStart,
        end: nextSabqiEnd,
        linesCount: calculateRangeLines(nextSabqiStart, nextSabqiEnd),
      };
    }

    let nextManzilRange = { ...todayPlan.manzil.range };
    if (manzilStatus === 'passed') {
      const nextManzilStart = advanceLocationByLines(todayPlan.manzil.range.start, 75);
      const nextManzilEnd = advanceLocationByLines(todayPlan.manzil.range.end, 75);
      nextManzilRange = {
        start: nextManzilStart,
        end: nextManzilEnd,
        linesCount: calculateRangeLines(nextManzilStart, nextManzilEnd),
      };
    }

    const nextDayPlan: DayPlan = {
      date: nextDate,
      dayNumber: nextDayCount,
      sabaq: {
        part: 'sabaq',
        range: nextSabaqRange,
        status: 'pending',
        repeatPracticeCount: 0,
        targetRepeats: 10,
      },
      sabqi: {
        part: 'sabqi',
        range: nextSabqiRange,
        status: 'pending',
        repeatPracticeCount: 0,
        targetRepeats: 7,
      },
      manzil: {
        part: 'manzil',
        range: nextManzilRange,
        status: 'pending',
        repeatPracticeCount: 0,
        targetRepeats: 5,
      },
      sabaqFrozenDueToRevisionFail: sabaqFrozenFlag,
    };

    if (!newDailyPlans[studentId]) {
      newDailyPlans[studentId] = {};
    }
    newDailyPlans[studentId][nextDate] = nextDayPlan;
  }

  const updatedState: MadrasaState = {
    ...currentState,
    currentDate: nextDate,
    dayCount: nextDayCount,
    dailyPlans: newDailyPlans,
  };

  saveState(updatedState);
  return updatedState;
}

/**
 * Jump directly to a selected recorded date without overwriting anything.
 */
export function jumpToDate(currentState: MadrasaState, targetDate: string): MadrasaState {
  const recordedDates = getAllRecordedDates(currentState);
  const dateIdx = recordedDates.indexOf(targetDate);
  const targetDayCount = dateIdx >= 0 ? dateIdx + 1 : currentState.dayCount;

  const updatedState: MadrasaState = {
    ...currentState,
    currentDate: targetDate,
    dayCount: targetDayCount,
  };

  saveState(updatedState);
  return updatedState;
}

export function getEffectiveLimits(
  studentId: string,
  state: MadrasaState
): StudentLimits {
  const defaults = state.settings.halqaDefaultLimits;
  const overrides = state.studentLimitsOverride[studentId] || {};
  return {
    sabaqGhaltiLimit: overrides.sabaqGhaltiLimit ?? defaults.sabaqGhaltiLimit,
    sabaqAtkanLimit: overrides.sabaqAtkanLimit ?? defaults.sabaqAtkanLimit,
    sabqiGhaltiLimit: overrides.sabqiGhaltiLimit ?? defaults.sabqiGhaltiLimit,
    sabqiAtkanLimit: overrides.sabqiAtkanLimit ?? defaults.sabqiAtkanLimit,
    manzilGhaltiLimit: overrides.manzilGhaltiLimit ?? defaults.manzilGhaltiLimit,
    manzilAtkanLimit: overrides.manzilAtkanLimit ?? defaults.manzilAtkanLimit,
  };
}
