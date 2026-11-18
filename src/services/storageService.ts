/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MadrasaState,
  StudentLimits,
  DayPlan,
  DailyPartPlan,
  MistakeMark,
  SessionResult,
  AssignmentRange,
} from '../types/hifz';
import { getRangeMetadata } from '../data/quranData';
import { computeCurrentParaSabqiRange, getFullParaRange } from './hifzService';
import {
  DEFAULT_SCHOOL_TIMEZONE,
  getRealTodayDate,
  shiftIsoDate,
} from './dateService';

const STORAGE_KEY = 'hifz_madrasa_prototype_state_v6';

export const DEFAULT_HALQA_LIMITS: StudentLimits = {
  sabaqGhaltiLimit: 2,
  sabaqAtkanLimit: 4,
  sabqiGhaltiLimit: 3,
  sabqiAtkanLimit: 5,
  manzilGhaltiLimit: 4,
  manzilAtkanLimit: 6,
};

/**
 * Returns a clean, EMPTY Sabaq slot ("Sabaq not assigned yet") with no pre-selected page, line, or range.
 */
export function createEmptySabaqPlan(): DailyPartPlan {
  return {
    part: 'sabaq',
    range: null,
    status: 'pending',
    repeatPracticeCount: 0,
    targetRepeats: 10,
  };
}

/**
 * Returns a clean DayPlan with empty Sabaq, Sabqi, and Manzil slots for a student with no prior plan on a date.
 */
export function createEmptyDayPlan(date: string, dayNumber?: number): DayPlan {
  return {
    date,
    ...(dayNumber !== undefined ? { dayNumber } : {}),
    sabaq: createEmptySabaqPlan(),
    sabqi: {
      part: 'sabqi',
      range: null,
      status: 'pending',
      repeatPracticeCount: 0,
      targetRepeats: 5,
    },
    manzil: {
      part: 'manzil',
      range: null,
      status: 'pending',
      repeatPracticeCount: 0,
      targetRepeats: 3,
      assignedParas: [],
    },
  };
}

function makeRange(
  startP: number,
  startL: number,
  startW: number,
  endP: number,
  endL: number,
  endW: number
): AssignmentRange {
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
    startAyah: meta.startAyah,
    endAyah: meta.endAyah,
  };
}

/**
 * Creates demo data anchored to the real current date in the school's time zone.
 * Unassessed today Sabaqs (Zayd, Umar) start EMPTY ("Sabaq not assigned yet") — zero auto-fill!
 */
export function createInitialDemoState(timeZone: string = DEFAULT_SCHOOL_TIMEZONE): MadrasaState {
  const today = getRealTodayDate(timeZone);
  const yesterday = shiftIsoDate(today, -1);

  const students = {
    student_1: {
      id: 'student_1',
      name: 'Zayd ibn Haritha',
      urduName: 'زید بن حارثہ',
      studentType: 'hifz' as const,
      mushafLayout: 'madinah' as const,
      ustaadId: 'ustaad_a' as const,
      halqaName: 'Halqa Al-Baqarah (Ustaad A)',
      enrollmentDate: '2026-01-15',
      currentJuz: 1,
      currentParaStartDate: yesterday,
      completedParas: [],
      nazraCompletedParas: [],
      memorizedPortionDesc: 'In Para 1 (Al-Fatihah & Al-Baqarah)',
    },
    student_2: {
      id: 'student_2',
      name: "Abdullah ibn Mas'ud",
      urduName: 'عبد اللہ بن مسعود',
      studentType: 'hifz' as const,
      mushafLayout: 'madinah' as const,
      ustaadId: 'ustaad_a' as const,
      halqaName: 'Halqa Al-Baqarah (Ustaad A)',
      enrollmentDate: '2026-02-01',
      currentJuz: 5,
      currentParaStartDate: yesterday,
      completedParas: [1, 2, 3, 4],
      nazraCompletedParas: [],
      memorizedPortionDesc: 'Completed Paras 1 - 4 · Finishing Para 5',
    },
    student_3: {
      id: 'student_3',
      name: 'Hamza ibn Abdul-Muttalib',
      urduName: 'حمزہ بن عبد المطلب',
      studentType: 'hifz' as const,
      mushafLayout: 'madinah' as const,
      ustaadId: 'ustaad_a' as const,
      halqaName: 'Halqa Al-Baqarah (Ustaad A)',
      enrollmentDate: '2026-03-10',
      currentJuz: 1,
      currentParaStartDate: yesterday,
      completedParas: [],
      nazraCompletedParas: [],
      memorizedPortionDesc: 'In Para 1 (Opening Pages)',
    },
    student_4: {
      id: 'student_4',
      name: 'Ibrahim Al-Khalil',
      urduName: 'ابراہیم الخلیل',
      studentType: 'hifz' as const,
      mushafLayout: 'madinah' as const,
      ustaadId: 'ustaad_b' as const,
      halqaName: "Halqa Ali 'Imran (Ustaad B)",
      enrollmentDate: '2026-01-20',
      currentJuz: 12,
      currentParaStartDate: yesterday,
      completedParas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      nazraCompletedParas: [],
      memorizedPortionDesc: 'Completed Paras 1 - 11 · Finished Para 12',
    },
    student_5: {
      id: 'student_5',
      name: 'Umar ibn Al-Khattab',
      urduName: 'عمر بن الخطاب',
      studentType: 'hifz' as const,
      mushafLayout: 'madinah' as const,
      ustaadId: 'ustaad_b' as const,
      halqaName: "Halqa Ali 'Imran (Ustaad B)",
      enrollmentDate: '2026-02-15',
      currentJuz: 16,
      currentParaStartDate: yesterday,
      completedParas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      nazraCompletedParas: [],
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
      halqaName: "Halqa Ali 'Imran",
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

  const para5Full = getFullParaRange(5);
  const para3Full = getFullParaRange(3);
  const para1Full = getFullParaRange(1);

  const dailyPlans: Record<string, Record<string, DayPlan>> = {
    // Student 1: Zayd — Yesterday Sabaq passed (Page 2 L3..8); Today Sabaq is EMPTY until Ustaad assigns!
    student_1: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(2, 3, 1, 2, 8, 2),
          status: 'passed',
          repeatPracticeCount: 8,
          targetRepeats: 10,
          completedAt: `${yesterday}T09:00:00Z`,
          sessionResultId: 'res_s1_yesterday',
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 2,
          endPage: 2,
          startLine: 3,
          endLine: 8,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(1, 2, 1, 2, 8, 2),
          status: 'passed',
          repeatPracticeCount: 5,
          targetRepeats: 5,
          completedAt: `${yesterday}T09:30:00Z`,
          sessionResultId: 'res_s1_yesterday_sabqi',
          portionType: 'current_para_passed',
          portionLabel: 'Current Para Passed Sabaq (Page 1 - 2)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 2, 1, 1, 8, 2),
          status: 'passed',
          repeatPracticeCount: 3,
          targetRepeats: 3,
          assignedParas: [],
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: createEmptySabaqPlan(),
        sabqi: {
          part: 'sabqi',
          range: makeRange(2, 3, 1, 2, 8, 2),
          status: 'in_progress',
          repeatPracticeCount: 7,
          targetRepeats: 7,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 1 (P2:L3 - P2:L8)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 2, 1, 1, 8, 2),
          status: 'pending',
          repeatPracticeCount: 2,
          targetRepeats: 5,
          assignedParas: [],
        },
      },
    },

    // Student 2: Abdullah (In Para 5, Completed [1,2,3,4]) — Day 1 repeat, Day 2 passed at Para 5 end
    student_2: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(100, 1, 1, 100, 15, 8),
          status: 'repeat',
          repeatPracticeCount: 6,
          targetRepeats: 10,
          completedAt: `${yesterday}T08:30:00Z`,
          sessionResultId: 'res_s2_yesterday_repeat',
          surahName: 'An-Nisa',
          juzNumber: 5,
          startPage: 100,
          endPage: 100,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(98, 1, 1, 99, 15, 7),
          status: 'passed',
          repeatPracticeCount: 7,
          targetRepeats: 7,
          portionType: 'current_para_passed',
          portionLabel: 'Para 5 Passed Sabaq (P98 - P99)',
        },
        manzil: {
          part: 'manzil',
          range: para1Full,
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
          range: makeRange(101, 1, 1, 101, 15, 7),
          status: 'passed',
          repeatPracticeCount: 12,
          targetRepeats: 10,
          completedAt: `${today}T08:30:00Z`,
          sessionResultId: 'res_seed_s2_sabaq',
          surahName: 'An-Nisa',
          juzNumber: 5,
          startPage: 101,
          endPage: 101,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(101, 1, 1, 101, 15, 7),
          status: 'pending',
          repeatPracticeCount: 5,
          targetRepeats: 7,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 5 (P101:L1 - P101:L15)',
        },
        manzil: {
          part: 'manzil',
          range: getFullParaRange(2),
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [2],
        },
      },
    },

    // Student 3: Hamza (In Para 1) — Day 1 passed, Day 2 Repeat (excluded from Sabqi)
    student_3: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(2, 3, 1, 2, 8, 2),
          status: 'passed',
          repeatPracticeCount: 8,
          targetRepeats: 10,
          surahName: 'Al-Baqarah',
          juzNumber: 1,
          startPage: 2,
          endPage: 2,
          startLine: 3,
          endLine: 8,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(2, 3, 1, 2, 8, 2),
          status: 'repeat',
          repeatPracticeCount: 3,
          targetRepeats: 5,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 1 (P2:L3 - P2:L8)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 2, 1, 1, 8, 2),
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [],
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: {
          part: 'sabaq',
          range: makeRange(3, 1, 1, 3, 8, 8),
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
          range: makeRange(2, 3, 1, 2, 8, 2),
          status: 'pending',
          repeatPracticeCount: 3,
          targetRepeats: 5,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 1 (P2:L3 - P2:L8)',
        },
        manzil: {
          part: 'manzil',
          range: makeRange(1, 2, 1, 1, 8, 2),
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [],
        },
      },
    },

    // Student 4: Ibrahim (Ustaad B, Completed [1..11], finished Para 12 all PASSED)
    student_4: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(240, 1, 1, 240, 15, 9),
          status: 'passed',
          repeatPracticeCount: 9,
          targetRepeats: 10,
          surahName: 'Yusuf',
          juzNumber: 12,
          startPage: 240,
          endPage: 240,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(240, 1, 1, 240, 15, 9),
          status: 'passed',
          repeatPracticeCount: 5,
          targetRepeats: 5,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 12 (P240)',
        },
        manzil: {
          part: 'manzil',
          range: para5Full,
          status: 'passed',
          repeatPracticeCount: 2,
          targetRepeats: 3,
          assignedParas: [5],
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: {
          part: 'sabaq',
          range: makeRange(241, 1, 1, 241, 15, 11),
          status: 'passed',
          repeatPracticeCount: 8,
          targetRepeats: 8,
          completedAt: `${today}T09:00:00Z`,
          sessionResultId: 'res_seed_s4_sabaq',
          surahName: 'Yusuf',
          juzNumber: 12,
          startPage: 241,
          endPage: 241,
          startLine: 1,
          endLine: 15,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(240, 1, 1, 241, 15, 11),
          status: 'pending',
          repeatPracticeCount: 3,
          targetRepeats: 5,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 12 (P240:L1 - P241:L15)',
        },
        manzil: {
          part: 'manzil',
          range: para5Full,
          status: 'pending',
          repeatPracticeCount: 2,
          targetRepeats: 3,
          assignedParas: [5],
        },
      },
    },

    // Student 5: Umar (Ustaad B, Completed [1..15], in Para 16) — Today Sabaq is EMPTY until Ustaad assigns!
    student_5: {
      [yesterday]: {
        date: yesterday,
        dayNumber: 1,
        sabaq: {
          part: 'sabaq',
          range: makeRange(302, 1, 1, 302, 10, 9),
          status: 'passed',
          repeatPracticeCount: 10,
          targetRepeats: 10,
          surahName: 'Al-Kahf',
          juzNumber: 16,
          startPage: 302,
          endPage: 302,
          startLine: 1,
          endLine: 10,
        },
        sabqi: {
          part: 'sabqi',
          range: makeRange(302, 1, 1, 302, 10, 9),
          status: 'passed',
          repeatPracticeCount: 6,
          targetRepeats: 6,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 16 (P302:L1 - L10)',
        },
        manzil: {
          part: 'manzil',
          range: para3Full,
          status: 'passed',
          repeatPracticeCount: 3,
          targetRepeats: 3,
          assignedParas: [3],
        },
      },
      [today]: {
        date: today,
        dayNumber: 2,
        sabaq: createEmptySabaqPlan(),
        sabqi: {
          part: 'sabqi',
          range: makeRange(302, 1, 1, 302, 10, 9),
          status: 'pending',
          repeatPracticeCount: 4,
          targetRepeats: 7,
          portionType: 'current_para_passed',
          portionLabel: 'Passed Sabaqs in Para 16 (P302:L1 - L10)',
        },
        manzil: {
          part: 'manzil',
          range: para3Full,
          status: 'pending',
          repeatPracticeCount: 1,
          targetRepeats: 3,
          assignedParas: [3],
        },
      },
    },
  };

  const marksHistory: MistakeMark[] = [
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
      wordId: 'p2_l6_w4',
      page: 2,
      line: 6,
      wordIndex: 4,
      type: 'atkan',
      timestamp: Date.now() - 86000000,
    },
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
      wordId: 'p101_l6_w4',
      page: 101,
      line: 6,
      wordIndex: 4,
      type: 'atkan',
      timestamp: Date.now() - 12000000,
    },
    {
      id: 'mark_seed_8',
      studentId: 'student_2',
      date: yesterday,
      part: 'sabaq',
      wordId: 'p100_l4_w3',
      page: 100,
      line: 4,
      wordIndex: 3,
      type: 'ghalti',
      timestamp: Date.now() - 92000000,
    },
    {
      id: 'mark_seed_9',
      studentId: 'student_2',
      date: yesterday,
      part: 'sabaq',
      wordId: 'p100_l9_w2',
      page: 100,
      line: 9,
      wordIndex: 2,
      type: 'ghalti',
      timestamp: Date.now() - 91500000,
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
      range: dailyPlans.student_1[yesterday].sabaq.range!,
      timestamp: Date.now() - 86400000,
    },
    {
      id: 'res_s2_yesterday_repeat',
      studentId: 'student_2',
      date: yesterday,
      part: 'sabaq',
      ghaltiCount: 2,
      atkanCount: 0,
      ghaltiLimit: 1,
      atkanLimit: 3,
      suggestedResult: 'repeat',
      finalResult: 'repeat',
      isOverridden: false,
      marks: [marksHistory[7], marksHistory[8]],
      range: dailyPlans.student_2[yesterday].sabaq.range!,
      timestamp: Date.now() - 91500000,
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
      range: dailyPlans.student_2[today].sabaq.range!,
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
      range: dailyPlans.student_3[today].sabaq.range!,
      timestamp: Date.now() - 8500000,
    },
    {
      id: 'res_seed_s4_sabaq',
      studentId: 'student_4',
      date: today,
      part: 'sabaq',
      ghaltiCount: 0,
      atkanCount: 0,
      ghaltiLimit: 2,
      atkanLimit: 4,
      suggestedResult: 'passed',
      finalResult: 'passed',
      isOverridden: false,
      marks: [],
      range: dailyPlans.student_4[today].sabaq.range!,
      timestamp: Date.now() - 10000000,
    },
  ];

  return {
    currentDate: today,
    currentRole: 'ustaad_a',
    language: 'en',
    settings: {
      timeZone,
      freezeSabaqOnSabqiOrManzilFail: true,
      halqaDefaultLimits: { ...DEFAULT_HALQA_LIMITS },
      mushafLayout: 'madinah',
      mushafScript: 'indopak',
      highContrastMushaf: false,
    },
    students,
    ustaads,
    studentLimitsOverride,
    dailyPlans,
    marksHistory,
    sessionResults,
  };
}

/**
 * Synchronizes state to the real current date in the configured school time zone.
 * - Rolls over student plans into today's real date cleanly if today doesn't exist yet (keeping Sabaq empty).
 * - Never deletes any existing past or future-dated records.
 */
export function syncStateToRealDate(
  currentState: MadrasaState,
  now: Date = new Date()
): MadrasaState {
  const tz = currentState.settings?.timeZone || DEFAULT_SCHOOL_TIMEZONE;
  const realToday = getRealTodayDate(tz, now);

  let plansChanged = false;
  const newDailyPlans: Record<string, Record<string, DayPlan>> = {
    ...currentState.dailyPlans,
  };

  for (const studentId of Object.keys(currentState.students)) {
    const student = currentState.students[studentId];
    const studentHistory = currentState.dailyPlans[studentId] || {};

    if (studentHistory[realToday]) {
      continue;
    }

    // Find most recent prior DayPlan strictly before realToday
    const priorDates = Object.keys(studentHistory)
      .filter(d => d < realToday)
      .sort();
    const latestPriorDate = priorDates.length > 0 ? priorDates[priorDates.length - 1] : null;
    const priorPlan = latestPriorDate ? studentHistory[latestPriorDate] : null;

    if (!priorPlan) {
      continue;
    }

    let todayPlan: DayPlan;
    if (student.studentType === 'nazra') {
      // Nazra students only track Sabaq; Sabqi and Manzil stay hidden/empty
      todayPlan = createEmptyDayPlan(realToday);
    } else {
      const sabqiStatus = priorPlan.sabqi?.status;
      const manzilStatus = priorPlan.manzil?.status;
      const revisionFailed = sabqiStatus === 'repeat' || manzilStatus === 'repeat';
      const shouldFreezeNewSabaq =
        Boolean(currentState.settings?.freezeSabaqOnSabqiOrManzilFail) && revisionFailed;

      const computedSabqi = computeCurrentParaSabqiRange(
        student,
        currentState,
        latestPriorDate || realToday
      );
      const nextSabqiRange: AssignmentRange | null = computedSabqi
        ? computedSabqi.range
        : priorPlan.sabqi?.range
        ? { ...priorPlan.sabqi.range }
        : null;
      const nextSabqiLabel = computedSabqi
        ? `Passed Sabaqs in Para ${student.currentJuz} (P${computedSabqi.range.start.page}:L${computedSabqi.range.start.line} - P${computedSabqi.range.end.page}:L${computedSabqi.range.end.line})`
        : priorPlan.sabqi?.portionLabel;

      let nextManzilRange: AssignmentRange | null = priorPlan.manzil?.range
        ? { ...priorPlan.manzil.range }
        : null;
      let nextAssignedParas = priorPlan.manzil?.assignedParas
        ? [...priorPlan.manzil.assignedParas]
        : [];
      if (
        manzilStatus === 'passed' &&
        student.completedParas &&
        student.completedParas.length > 0
      ) {
        const sortedCompleted = [...student.completedParas].sort((a, b) => a - b);
        const currAssigned = nextAssignedParas[0];
        const currIdx = sortedCompleted.indexOf(currAssigned);
        const nextPara = sortedCompleted[(currIdx + 1) % sortedCompleted.length];
        nextAssignedParas = [nextPara];
        nextManzilRange = getFullParaRange(nextPara);
      }

      todayPlan = {
        date: realToday,
        sabaq: createEmptySabaqPlan(),
        sabqi: {
          part: 'sabqi',
          range: nextSabqiRange,
          status: 'pending',
          repeatPracticeCount: 0,
          targetRepeats: 7,
          surahName: nextSabqiRange?.surahName,
          juzNumber: nextSabqiRange?.juzNumber,
          startPage: nextSabqiRange?.startPage,
          endPage: nextSabqiRange?.endPage,
          startLine: nextSabqiRange?.startLine,
          endLine: nextSabqiRange?.endLine,
          startAyah: nextSabqiRange?.startAyah,
          endAyah: nextSabqiRange?.endAyah,
          portionType: computedSabqi ? 'current_para_passed' : priorPlan.sabqi?.portionType,
          portionLabel: nextSabqiLabel,
        },
        manzil: {
          part: 'manzil',
          range: nextManzilRange,
          status: 'pending',
          repeatPracticeCount: 0,
          targetRepeats: 5,
          surahName: nextManzilRange?.surahName,
          juzNumber: nextManzilRange?.juzNumber,
          startPage: nextManzilRange?.startPage,
          endPage: nextManzilRange?.endPage,
          startLine: nextManzilRange?.startLine,
          endLine: nextManzilRange?.endLine,
          startAyah: nextManzilRange?.startAyah,
          endAyah: nextManzilRange?.endAyah,
          assignedParas: nextAssignedParas,
        },
        sabaqFrozenDueToRevisionFail: shouldFreezeNewSabaq,
      };
    }

    newDailyPlans[studentId] = {
      ...studentHistory,
      [realToday]: todayPlan,
    };
    plansChanged = true;
  }

  const settingsNeedUpdate = currentState.settings?.timeZone !== tz;
  if (
    currentState.currentDate === realToday &&
    !plansChanged &&
    !settingsNeedUpdate
  ) {
    return currentState;
  }

  return {
    ...currentState,
    currentDate: realToday,
    settings: {
      ...currentState.settings,
      timeZone: tz,
    },
    dailyPlans: plansChanged ? newDailyPlans : currentState.dailyPlans,
  };
}

/**
 * Migrates any existing persisted students lacking studentType to 'hifz' by default,
 * preserving all historical records, assignments, marks, and completed paras untouched.
 */
export function migrateMadrasaState(currentState: MadrasaState): MadrasaState {
  let changed = false;
  const updatedStudents = { ...currentState.students };
  const defaultLayout = currentState.settings?.mushafLayout || 'madinah';

  for (const [id, student] of Object.entries(updatedStudents)) {
    if (!student) continue;
    const needsType = student.studentType !== 'hifz' && student.studentType !== 'nazra';
    const needsLayout = !student.mushafLayout;
    if (needsType || needsLayout) {
      updatedStudents[id] = {
        ...student,
        studentType: needsType ? 'hifz' : student.studentType,
        mushafLayout: student.mushafLayout || defaultLayout,
        completedParas: Array.isArray(student.completedParas) ? student.completedParas : [],
      };
      changed = true;
    }
  }

  if (!changed) return currentState;
  return {
    ...currentState,
    students: updatedStudents,
  };
}

export function loadState(): MadrasaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialDemoState(DEFAULT_SCHOOL_TIMEZONE);
      saveState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as MadrasaState;
    const migrated = migrateMadrasaState(parsed);
    const synced = syncStateToRealDate(migrated);
    if (synced !== parsed) {
      saveState(synced);
    }
    return synced;
  } catch (err) {
    console.error('Failed to parse localStorage state, resetting:', err);
    const initial = createInitialDemoState(DEFAULT_SCHOOL_TIMEZONE);
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

export function resetDemoState(timeZone: string = DEFAULT_SCHOOL_TIMEZONE): MadrasaState {
  localStorage.removeItem(STORAGE_KEY);
  const fresh = createInitialDemoState(timeZone);
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
 * Inspects saved records dated strictly after today's real date (left over from the old simulated clock),
 * without deleting or modifying them.
 */
export function getFutureDatedRecordsSummary(
  state: MadrasaState,
  referenceToday?: string
): {
  futureDates: string[];
  dailyPlanEntriesCount: number;
  sessionResultsCount: number;
  marksCount: number;
  totalCount: number;
} {
  const tz = state.settings?.timeZone || DEFAULT_SCHOOL_TIMEZONE;
  const today = referenceToday || getRealTodayDate(tz);
  const futureDateSet = new Set<string>();
  let dailyPlanEntriesCount = 0;

  Object.values(state.dailyPlans).forEach(studentHistory => {
    Object.keys(studentHistory).forEach(date => {
      if (date > today) {
        futureDateSet.add(date);
        dailyPlanEntriesCount++;
      }
    });
  });

  const sessionResultsCount = state.sessionResults.filter(r => {
    if (r.date > today) {
      futureDateSet.add(r.date);
      return true;
    }
    return false;
  }).length;

  const marksCount = state.marksHistory.filter(m => {
    if (m.date > today) {
      futureDateSet.add(m.date);
      return true;
    }
    return false;
  }).length;

  return {
    futureDates: Array.from(futureDateSet).sort(),
    dailyPlanEntriesCount,
    sessionResultsCount,
    marksCount,
    totalCount: dailyPlanEntriesCount + sessionResultsCount + marksCount,
  };
}

export function getEffectiveLimits(studentId: string, state: MadrasaState): StudentLimits {
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
