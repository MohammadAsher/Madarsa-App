/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WordLocation } from '../data/quranData';

export type RoleId = 
  | 'ustaad_a' 
  | 'ustaad_b' 
  | 'student_1' 
  | 'student_2' 
  | 'student_3' 
  | 'student_4' 
  | 'student_5';

export interface UstaadProfile {
  id: 'ustaad_a' | 'ustaad_b';
  name: string;
  urduName: string;
  halqaName: string;
  studentIds: string[];
}

export interface StudentProfile {
  id: string; // 'student_1', etc.
  name: string;
  urduName: string;
  ustaadId: 'ustaad_a' | 'ustaad_b';
  halqaName: string;
  enrollmentDate: string;
  currentJuz: number;
  completedParas: number[]; // Array of Para numbers student has completed, e.g. [1, 2, 3, 4, 5]
  memorizedPortionDesc?: string; // e.g. "Completed 5 Paras" or "Memorized up to Para 1 Page 10"
}

export type PartType = 'sabaq' | 'sabqi' | 'manzil';

export interface StudentLimits {
  sabaqGhaltiLimit: number;
  sabaqAtkanLimit: number;
  sabqiGhaltiLimit: number;
  sabqiAtkanLimit: number;
  manzilGhaltiLimit: number;
  manzilAtkanLimit: number;
}

export interface AssignmentRange {
  start: WordLocation;
  end: WordLocation;
  linesCount: number;
  surahName?: string;
  juzNumber?: number;
  startLine?: number;
  endLine?: number;
  startPage?: number;
  endPage?: number;
  startAyah?: number;
  endAyah?: number;
}

export type PartStatus = 'pending' | 'in_progress' | 'passed' | 'repeat';

export interface DailyPartPlan {
  part: PartType;
  range: AssignmentRange;
  status: PartStatus;
  repeatPracticeCount: number; // Student practice counter
  targetRepeats: number;
  lastPracticedAt?: string;
  completedAt?: string;
  sessionResultId?: string;
  // Specific assignment metadata for teacher control
  surahName?: string;
  juzNumber?: number;
  startLine?: number;
  endLine?: number;
  startPage?: number;
  endPage?: number;
  startAyah?: number;
  endAyah?: number;
  assignedParas?: number[]; // For Manzil: only the Paras specifically selected by teacher
  portionType?: 'custom' | 'quarter_para' | 'half_para' | 'full_para'; // For Sabqi
  portionLabel?: string; // e.g. "Half Para (Pages 2-11)"
}

export interface DayPlan {
  date: string; // ISO date "YYYY-MM-DD"
  dayNumber: number; // e.g. Day 1, Day 2
  sabaq: DailyPartPlan;
  sabqi: DailyPartPlan;
  manzil: DailyPartPlan;
  sabaqFrozenDueToRevisionFail?: boolean; // Flag if new Sabaq was paused because of Sabqi/Manzil failure
}

export type MistakeType = 'ghalti' | 'atkan';

export interface MistakeMark {
  id: string;
  studentId: string;
  date: string;
  part: PartType;
  wordId: string;
  page: number;
  line: number;
  wordIndex: number;
  type: MistakeType;
  timestamp: number;
}

export interface SessionResult {
  id: string;
  studentId: string;
  date: string;
  part: PartType;
  ghaltiCount: number;
  atkanCount: number;
  ghaltiLimit: number;
  atkanLimit: number;
  suggestedResult: 'passed' | 'repeat';
  finalResult: 'passed' | 'repeat';
  isOverridden: boolean;
  marks: MistakeMark[];
  range: AssignmentRange;
  timestamp: number;
}

export interface AppSettings {
  freezeSabaqOnSabqiOrManzilFail: boolean;
  halqaDefaultLimits: StudentLimits;
}

export interface MadrasaState {
  currentDate: string;
  dayCount: number;
  currentRole: RoleId;
  language: 'en' | 'ur';
  settings: AppSettings;
  students: Record<string, StudentProfile>;
  ustaads: Record<string, UstaadProfile>;
  studentLimitsOverride: Record<string, Partial<StudentLimits>>;
  dailyPlans: Record<string, Record<string, DayPlan>>; // [studentId][date] -> DayPlan
  marksHistory: MistakeMark[];
  sessionResults: SessionResult[];
}
