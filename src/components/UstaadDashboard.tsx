/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Sliders,
  History,
  Play,
  Sparkles,
  Layers,
  BookmarkCheck,
  Award,
  AlertTriangle,
  ArrowRight,
  ListChecks,
  Grid,
  UserPlus,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  MadrasaState,
  UstaadProfile,
  StudentProfile,
  StudentType,
  StudentTypeChangeLog,
  StudentPauseOverride,
  PartType,
  SessionResult,
  MistakeMark,
  StudentLimits,
  AssignmentRange,
} from '../types/hifz';
import { translations } from '../i18n/translations';
import { UstaadMarkingScreen } from './UstaadMarkingScreen';
import { AssignWorkModal } from './AssignWorkModal';
import { AssignByLinesModal } from './AssignByLinesModal';
import { LimitsModal } from './LimitsModal';
import { StudentHistoryModal } from './StudentHistoryModal';
import { StartNewParaModal } from './StartNewParaModal';
import { AddStudentModal } from './AddStudentModal';
import { ChangeStudentTypeModal } from './ChangeStudentTypeModal';
import { StudentTypeBadge } from './StudentTypeBadge';
import { ParaProgressGrid } from './ParaProgressGrid';
import { DateNavigator } from './DateNavigator';
import { UstaadParaMushafModal } from './UstaadParaMushafModal';
import {
  getParaCompletionStatus,
  computeCurrentParaSabqiRange,
  computeManzilParaStates,
  getManzilParasFromPlan,
  getNewSabaqPauseStatus,
  getValidatedManzilParasForStudent,
  isWholeParaManzilPlan,
} from '../services/hifzService';
import {
  createEmptyDayPlan,
  createEmptySabaqPlan,
} from '../services/storageService';
import {
  DEFAULT_SCHOOL_TIMEZONE,
  getRealTomorrowDate,
} from '../services/dateService';
import { getJuzMetadata, getRangeMetadata } from '../data/quranData';

interface UstaadDashboardProps {
  state: MadrasaState;
  ustaad: UstaadProfile;
  onUpdateState: (updater: (prev: MadrasaState) => MadrasaState) => void;
  onJumpToMushafWord?: (page: number, wordId: string) => void;
  activeMarkingSession?: {
    student: StudentProfile;
    part: PartType;
    targetDate?: string;
  } | null;
  onStartMarking?: (student: StudentProfile, part: PartType, targetDate?: string) => void;
  onCloseMarking?: () => void;
}

export const UstaadDashboard: React.FC<UstaadDashboardProps> = ({
  state,
  ustaad,
  onUpdateState,
  onJumpToMushafWord,
  activeMarkingSession,
  onStartMarking,
  onCloseMarking,
}) => {
  const t = translations[state.language];

  const [internalMarkingStudent, setInternalMarkingStudent] = useState<{
    student: StudentProfile;
    part: PartType;
    targetDate?: string;
  } | null>(null);

  const currentMarking =
    activeMarkingSession !== undefined ? activeMarkingSession : internalMarkingStudent;

  const handleStartMarkingStudent = (
    student: StudentProfile,
    part: PartType,
    targetDate?: string
  ) => {
    if (onStartMarking) {
      onStartMarking(student, part, targetDate);
    } else {
      setInternalMarkingStudent({ student, part, targetDate });
    }
  };

  const handleCloseMarkingScreen = () => {
    if (onCloseMarking) {
      onCloseMarking();
    }
    setInternalMarkingStudent(null);
  };

  const [assignModalTarget, setAssignModalTarget] = useState<{
    student: StudentProfile;
    initialPart: PartType;
    initialParaNum?: number;
    targetDate?: string;
  } | null>(null);
  const [paraViewerTarget, setParaViewerTarget] = useState<{
    student: StudentProfile;
    initialPara: number;
    targetDate: string;
  } | null>(null);
  const [showAssignByLinesModal, setShowAssignByLinesModal] = useState<boolean>(false);
  const [limitsStudent, setLimitsStudent] = useState<StudentProfile | null>(null);
  const [historyStudent, setHistoryStudent] = useState<StudentProfile | null>(null);
  const [startingParaStudent, setStartingParaStudent] = useState<StudentProfile | null>(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [changingTypeStudent, setChangingTypeStudent] = useState<StudentProfile | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | StudentType>('all');
  const [pastDateByStudent, setPastDateByStudent] = useState<Record<string, string | undefined>>({});
  const [expandedParaGridByStudent, setExpandedParaGridByStudent] = useState<
    Record<string, boolean>
  >({});

  const toggleStudentParaGrid = (studentId: string) => {
    setExpandedParaGridByStudent(prev => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const getStudentViewedDate = (studentId: string): string => {
    const picked = pastDateByStudent[studentId];
    return picked && picked <= state.currentDate ? picked : state.currentDate;
  };

  const setStudentViewedDate = (studentId: string, nextDate: string) => {
    setPastDateByStudent(prev => {
      if (!nextDate || nextDate >= state.currentDate) {
        if (!prev[studentId]) return prev;
        const copy = { ...prev };
        delete copy[studentId];
        return copy;
      }
      return { ...prev, [studentId]: nextDate };
    });
  };

  const halqaStudents = ustaad.studentIds
    .map(id => state.students[id])
    .filter(Boolean);

  const hifzCount = halqaStudents.filter(s => (s.studentType || 'hifz') === 'hifz').length;
  const nazraCount = halqaStudents.filter(s => s.studentType === 'nazra').length;
  const filteredHalqaStudents = halqaStudents.filter(s =>
    typeFilter === 'all' ? true : (s.studentType || 'hifz') === typeFilter
  );

  const handleAddStudent = (newStudent: StudentProfile) => {
    onUpdateState(prev => {
      const targetUstaad = prev.ustaads[newStudent.ustaadId];
      const nextUstaads = targetUstaad
        ? {
            ...prev.ustaads,
            [newStudent.ustaadId]: {
              ...targetUstaad,
              studentIds: [...targetUstaad.studentIds, newStudent.id],
            },
          }
        : prev.ustaads;

      return {
        ...prev,
        students: {
          ...prev.students,
          [newStudent.id]: newStudent,
        },
        ustaads: nextUstaads,
        dailyPlans: {
          ...prev.dailyPlans,
          [newStudent.id]: {
            [prev.currentDate]: createEmptyDayPlan(prev.currentDate),
          },
        },
      };
    });
  };

  const handleChangeStudentType = (studentId: string, newType: StudentType) => {
    onUpdateState(prev => {
      const student = prev.students[studentId];
      if (!student) return prev;
      const fromType: StudentType = student.studentType || 'hifz';
      if (fromType === newType) return prev;

      const nowIso = new Date().toISOString();
      const logEntry: StudentTypeChangeLog = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fromType,
        toType: newType,
        changedBy: ustaad.name,
        changedByUrdu: ustaad.urduName,
        changedById: ustaad.id,
        changedAt: nowIso,
      };
      const nextHistory = [...(student.typeChangeHistory || []), logEntry];

      // Hifz -> Nazra: hide Sabqi & Manzil in UI, keep ALL Hifz data (completedParas, sabqi, manzil, marks, results) stored untouched!
      if (fromType === 'hifz' && newType === 'nazra') {
        return {
          ...prev,
          students: {
            ...prev.students,
            [studentId]: {
              ...student,
              studentType: 'nazra',
              hasStoredHifzProgress: true,
              typeChangeHistory: nextHistory,
            },
          },
        };
      }

      // Nazra -> Hifz:
      const hadPriorHifz =
        Boolean(student.hasStoredHifzProgress) ||
        (student.completedParas && student.completedParas.length > 0);

      if (hadPriorHifz) {
        // Restore stored Hifz progress seamlessly; Nazra-read paras remain separate and are NOT moved into Manzil
        return {
          ...prev,
          students: {
            ...prev.students,
            [studentId]: {
              ...student,
              studentType: 'hifz',
              typeChangeHistory: nextHistory,
            },
          },
        };
      }

      // Pure Nazra -> Hifz: start Hifz tracking fresh!
      // Sabqi and Manzil start empty; Nazra paras are NOT moved into completedParas/Manzil; history & marks kept.
      const existingStudentPlans = { ...(prev.dailyPlans[studentId] || {}) };
      for (const d of Object.keys(existingStudentPlans)) {
        const dp = existingStudentPlans[d];
        if (dp?.sabaq?.range && !dp.sabaq.isNazraSabaq) {
          existingStudentPlans[d] = {
            ...dp,
            sabaq: {
              ...dp.sabaq,
              isNazraSabaq: true,
            },
          };
        }
      }

      const emptyToday = createEmptyDayPlan(prev.currentDate);
      const todayExisting = existingStudentPlans[prev.currentDate];
      existingStudentPlans[prev.currentDate] = {
        ...(todayExisting || emptyToday),
        sabqi: emptyToday.sabqi,
        manzil: emptyToday.manzil,
        sabaqFrozenDueToRevisionFail: false,
      };

      return {
        ...prev,
        students: {
          ...prev.students,
          [studentId]: {
            ...student,
            studentType: 'hifz',
            currentParaStartDate: prev.currentDate,
            hifzFreshFromIso: nowIso,
            completedParas: [], // Paras read in Nazra are NOT moved into Manzil
            typeChangeHistory: nextHistory,
          },
        },
        dailyPlans: {
          ...prev.dailyPlans,
          [studentId]: existingStudentPlans,
        },
      };
    });
  };

  const handleUpdateMushafSettings = (patch: {
    mushafLayout?: 'hafizi' | 'madinah';
    mushafScript?: 'indopak' | 'uthmani';
    highContrastMushaf?: boolean;
  }) => {
    const activeStudentId =
      currentMarking?.student.id || assignModalTarget?.student.id || null;
    onUpdateState(prev => ({
      ...prev,
      students:
        patch.mushafLayout && activeStudentId && prev.students[activeStudentId]
          ? {
              ...prev.students,
              [activeStudentId]: {
                ...prev.students[activeStudentId],
                mushafLayout: patch.mushafLayout,
              },
            }
          : prev.students,
      settings: {
        ...prev.settings,
        ...patch,
      },
    }));
  };

  const handleOpenUnpassedSabaq = (targetDate: string, student: StudentProfile) => {
    handleStartMarkingStudent(student, 'sabaq', targetDate);
  };

  // Handle saving a completed grading session + automatic Current-Para Sabqi recomputation
  const handleSaveSession = (result: SessionResult, updatedMarks: MistakeMark[]) => {
    onUpdateState(prev => {
      const filteredResults = prev.sessionResults.filter(
        r =>
          !(
            r.studentId === result.studentId &&
            r.date === result.date &&
            r.part === result.part
          )
      );
      const newResults = [result, ...filteredResults];

      const otherMarks = prev.marksHistory.filter(
        m =>
          !(
            m.studentId === result.studentId &&
            m.date === result.date &&
            m.part === result.part
          )
      );
      const newMarksHistory = [...otherMarks, ...updatedMarks];

      const studentPlans = { ...(prev.dailyPlans[result.studentId] || {}) };
      const currentDayPlan = studentPlans[result.date]
        ? { ...studentPlans[result.date] }
        : createEmptyDayPlan(result.date);

      const studentObj = prev.students[result.studentId];
      const isNazraStudent = studentObj?.studentType === 'nazra';

      currentDayPlan[result.part] = {
        ...currentDayPlan[result.part],
        status: result.finalResult,
        completedAt: new Date().toISOString(),
        sessionResultId: result.id,
        ...(result.part === 'manzil' ? { paraResults: result.paraResults } : {}),
        ...(isNazraStudent && result.part === 'sabaq' ? { isNazraSabaq: true } : {}),
      };
      studentPlans[result.date] = currentDayPlan;

      let updatedStudents = prev.students;
      if (result.part === 'manzil' && studentObj && !isNazraStudent) {
        const nextRepeatMap = { ...(studentObj.manzilRepeatParas || {}) };
        const manzilPlan = currentDayPlan.manzil;
        const gradedParaResults: Record<number, 'passed' | 'repeat'> =
          result.paraResults && Object.keys(result.paraResults).length > 0
            ? result.paraResults
            : Object.fromEntries(
                getManzilParasFromPlan(manzilPlan?.assignedParas, manzilPlan?.range).map(p => [
                  p,
                  result.finalResult,
                ])
              );

        if (!manzilPlan.paraResults && Object.keys(gradedParaResults).length > 0) {
          currentDayPlan.manzil = {
            ...manzilPlan,
            paraResults: gradedParaResults,
          };
          studentPlans[result.date] = currentDayPlan;
        }

        for (const [pKey, outcome] of Object.entries(gradedParaResults)) {
          const pNum = parseInt(pKey, 10);
          if (Number.isNaN(pNum)) continue;
          if (outcome === 'passed') {
            delete nextRepeatMap[pNum];
          } else if (outcome === 'repeat') {
            nextRepeatMap[pNum] = result.date;
          }
        }

        updatedStudents = {
          ...prev.students,
          [result.studentId]: {
            ...studentObj,
            manzilRepeatParas: nextRepeatMap,
          },
        };
      }

      const draftState: MadrasaState = {
        ...prev,
        students: updatedStudents,
        sessionResults: newResults,
        marksHistory: newMarksHistory,
        dailyPlans: {
          ...prev.dailyPlans,
          [result.studentId]: studentPlans,
        },
      };

      const draftStudent = updatedStudents[result.studentId];

      // Whenever a Hifz Sabaq is graded, recompute current Para's Sabqi for this date & later dates
      if (result.part === 'sabaq' && draftStudent && !isNazraStudent) {
        const datesToSync = Object.keys(studentPlans)
          .filter(d => d >= result.date)
          .sort();

        for (const d of datesToSync) {
          const dp = studentPlans[d];
          if (!dp || dp.sabqi?.sabqiCustomOverride) continue;
          const sabqiInfo = computeCurrentParaSabqiRange(draftStudent, draftState, d);
          if (sabqiInfo) {
            studentPlans[d] = {
              ...dp,
              sabqi: {
                ...dp.sabqi,
                range: sabqiInfo.range,
                surahName: sabqiInfo.range.surahName,
                juzNumber: sabqiInfo.range.juzNumber,
                startPage: sabqiInfo.range.startPage,
                endPage: sabqiInfo.range.endPage,
                startLine: sabqiInfo.range.startLine,
                endLine: sabqiInfo.range.endLine,
                startAyah: sabqiInfo.range.startAyah,
                endAyah: sabqiInfo.range.endAyah,
                portionType: 'current_para_passed',
                portionLabel: `Passed Sabaqs in Para ${draftStudent.currentJuz} (P${sabqiInfo.range.start.page}:L${sabqiInfo.range.start.line} - P${sabqiInfo.range.end.page}:L${sabqiInfo.range.end.line})`,
              },
            };
          }
        }
      }

      // Sync / clear sabaqFrozenDueToRevisionFail across result.date and subsequent plans
      if (draftStudent && !isNazraStudent) {
        const syncedStateForPause: MadrasaState = {
          ...draftState,
          dailyPlans: {
            ...draftState.dailyPlans,
            [result.studentId]: studentPlans,
          },
        };
        const datesToRefreshPause = Object.keys(studentPlans)
          .filter(d => d >= result.date)
          .sort();
        for (const d of datesToRefreshPause) {
          const dp = studentPlans[d];
          if (!dp) continue;
          const pauseStatus = getNewSabaqPauseStatus(draftStudent, syncedStateForPause, d);
          studentPlans[d] = {
            ...dp,
            sabaqFrozenDueToRevisionFail: pauseStatus.isPaused,
          };
        }
      }

      return {
        ...draftState,
        dailyPlans: {
          ...draftState.dailyPlans,
          [result.studentId]: studentPlans,
        },
      };
    });

    handleCloseMarkingScreen();
  };

  // Start New Para: for Hifz move finished Para to Manzil pool & reset Sabqi; for Nazra record in nazraCompletedParas only (NEVER into Manzil)
  const handleConfirmStartNewPara = (studentId: string, chosenNextPara: number) => {
    onUpdateState(prev => {
      const student = prev.students[studentId];
      if (!student) return prev;

      const finishedPara = student.currentJuz;
      const isNazra = student.studentType === 'nazra';
      const studentHistory = { ...(prev.dailyPlans[studentId] || {}) };
      const todayPlan =
        studentHistory[prev.currentDate] || createEmptyDayPlan(prev.currentDate);

      if (isNazra) {
        const updatedNazraParas = Array.from(
          new Set([...(student.nazraCompletedParas || []), finishedPara])
        ).sort((a, b) => a - b);

        studentHistory[prev.currentDate] = {
          ...todayPlan,
          sabaq: createEmptySabaqPlan(),
        };

        return {
          ...prev,
          students: {
            ...prev.students,
            [studentId]: {
              ...student,
              currentJuz: chosenNextPara,
              currentParaStartDate: prev.currentDate,
              nazraCompletedParas: updatedNazraParas,
              memorizedPortionDesc: `Nazra: Read ${updatedNazraParas.length} Paras · Starting Para ${chosenNextPara}`,
            },
          },
          dailyPlans: {
            ...prev.dailyPlans,
            [studentId]: studentHistory,
          },
        };
      }

      const updatedCompleted = Array.from(
        new Set([...(student.completedParas || []), finishedPara])
      ).sort((a, b) => a - b);

      const nextParaMeta = getJuzMetadata(chosenNextPara);
      const emptySabqiMeta = getRangeMetadata(nextParaMeta.startLoc, nextParaMeta.startLoc);
      const resetSabqiRange: AssignmentRange = {
        start: nextParaMeta.startLoc,
        end: nextParaMeta.startLoc,
        linesCount: emptySabqiMeta.linesCount,
        surahName: emptySabqiMeta.surahName,
        juzNumber: chosenNextPara,
        startPage: emptySabqiMeta.startPage,
        endPage: emptySabqiMeta.endPage,
        startLine: emptySabqiMeta.startLine,
        endLine: emptySabqiMeta.endLine,
        startAyah: emptySabqiMeta.startAyah,
        endAyah: emptySabqiMeta.endAyah,
      };

      studentHistory[prev.currentDate] = {
        ...todayPlan,
        // Never auto-assign new Para Sabaq — starts EMPTY until Ustaad picks it
        sabaq: createEmptySabaqPlan(),
        sabqi: {
          ...todayPlan.sabqi,
          range: resetSabqiRange,
          status: 'pending',
          repeatPracticeCount: 0,
          portionType: 'current_para_passed',
          portionLabel: `Para ${chosenNextPara} started — no passed Sabaq yet`,
          sabqiCustomOverride: false,
          surahName: resetSabqiRange.surahName,
          juzNumber: chosenNextPara,
          startPage: resetSabqiRange.startPage,
          endPage: resetSabqiRange.endPage,
          startLine: resetSabqiRange.startLine,
          endLine: resetSabqiRange.endLine,
          startAyah: resetSabqiRange.startAyah,
          endAyah: resetSabqiRange.endAyah,
        },
      };

      return {
        ...prev,
        students: {
          ...prev.students,
          [studentId]: {
            ...student,
            currentJuz: chosenNextPara,
            currentParaStartDate: prev.currentDate,
            completedParas: updatedCompleted,
            memorizedPortionDesc: `Completed ${updatedCompleted.length} Paras · Starting Para ${chosenNextPara}`,
          },
        },
        dailyPlans: {
          ...prev.dailyPlans,
          [studentId]: studentHistory,
        },
      };
    });
  };

  // Handle saving assignments (single student or optional Sabqi/Manzil, including past corrections)
  const handleSaveAssignment = (
    targetStudentId: string,
    part: PartType,
    range: AssignmentRange,
    applyToAllHalqa: boolean,
    extraMetadata?: {
      assignedParas?: number[];
      portionType?: 'custom' | 'quarter_para' | 'half_para' | 'full_para' | 'current_para_passed';
      portionLabel?: string;
      sabqiCustomOverride?: boolean;
      targetDate?: string;
    }
  ) => {
    onUpdateState(prev => {
      const saveDate = extraMetadata?.targetDate || prev.currentDate;
      const candidateIds = applyToAllHalqa
        ? ustaad.studentIds.filter(
            sid => part === 'sabaq' || prev.students[sid]?.studentType !== 'nazra'
          )
        : [targetStudentId];

      const referencedManzilParas =
        part === 'manzil'
          ? extraMetadata?.assignedParas && extraMetadata.assignedParas.length > 0
            ? extraMetadata.assignedParas
            : getManzilParasFromPlan([], range)
          : [];

      // Enforce pause rule + Manzil completed-paras validation
      const studentIdsToUpdate = candidateIds.filter(sid => {
        const st = prev.students[sid];
        if (!st) return false;
        if (part === 'sabaq' && getNewSabaqPauseStatus(st, prev, saveDate).isPaused) {
          return false;
        }
        if (part === 'manzil') {
          if (st.studentType === 'nazra') return false;
          const completedSet = new Set(st.completedParas || []);
          if (completedSet.size === 0 || referencedManzilParas.length === 0) return false;
          if (!referencedManzilParas.every(p => completedSet.has(p))) return false;
        }
        return true;
      });
      if (studentIdsToUpdate.length === 0) {
        return prev;
      }
      const newDailyPlans = { ...prev.dailyPlans };
      const newStudents = { ...prev.students };

      studentIdsToUpdate.forEach(sid => {
        const studentHistory = { ...(newDailyPlans[sid] || {}) };
        const existingDayPlan =
          studentHistory[saveDate] || createEmptyDayPlan(saveDate);

        studentHistory[saveDate] = {
          ...existingDayPlan,
          ...(part === 'sabaq' ? { sabaqFrozenDueToRevisionFail: false } : {}),
          [part]: {
            ...existingDayPlan[part],
            range,
            status: 'pending',
            completedAt: undefined,
            sessionResultId: undefined,
            ...(part === 'manzil' ? { paraResults: undefined } : {}),
            ...(part === 'sabaq'
              ? { isNazraSabaq: newStudents[sid]?.studentType === 'nazra' }
              : {}),
            surahName: range.surahName,
            juzNumber: range.juzNumber,
            startPage: range.startPage,
            endPage: range.endPage,
            startLine: range.startLine,
            endLine: range.endLine,
            startAyah: range.startAyah,
            endAyah: range.endAyah,
            assignedParas: extraMetadata?.assignedParas,
            portionType: extraMetadata?.portionType,
            portionLabel: extraMetadata?.portionLabel,
            sabqiCustomOverride: extraMetadata?.sabqiCustomOverride,
          },
        };
        newDailyPlans[sid] = studentHistory;
      });

      return {
        ...prev,
        dailyPlans: newDailyPlans,
        students: newStudents,
      };
    });
  };

  // Optional batch Sabaq assignment ONLY committed when Ustaad taps Confirm inside AssignByLinesModal
  const handleConfirmAssignByLines = (assignments: Record<string, AssignmentRange>) => {
    onUpdateState(prev => {
      const newDailyPlans = { ...prev.dailyPlans };
      Object.entries(assignments).forEach(([sid, range]) => {
        const st = prev.students[sid];
        if (!st || getNewSabaqPauseStatus(st, prev, prev.currentDate).isPaused) {
          return;
        }
        const studentHistory = { ...(newDailyPlans[sid] || {}) };
        const dayPlan =
          studentHistory[prev.currentDate] || createEmptyDayPlan(prev.currentDate);
        studentHistory[prev.currentDate] = {
          ...dayPlan,
          sabaqFrozenDueToRevisionFail: false,
          sabaq: {
            ...dayPlan.sabaq,
            range,
            status: 'pending',
            repeatPracticeCount: 0,
            isNazraSabaq: st.studentType === 'nazra',
            surahName: range.surahName,
            juzNumber: range.juzNumber,
            startPage: range.startPage,
            endPage: range.endPage,
            startLine: range.startLine,
            endLine: range.endLine,
            startAyah: range.startAyah,
            endAyah: range.endAyah,
          },
        };
        newDailyPlans[sid] = studentHistory;
      });
      return {
        ...prev,
        dailyPlans: newDailyPlans,
      };
    });
  };

  const handleSaveStudentLimits = (studentId: string, limits: Partial<StudentLimits>) => {
    onUpdateState(prev => ({
      ...prev,
      studentLimitsOverride: {
        ...prev.studentLimitsOverride,
        [studentId]: limits,
      },
    }));
  };

  const handleSaveHalqaDefaults = (limits: StudentLimits) => {
    onUpdateState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        halqaDefaultLimits: limits,
      },
    }));
  };

  const handleSaveStudentPauseOverride = (
    studentId: string,
    pause: Partial<StudentPauseOverride>
  ) => {
    onUpdateState(prev => ({
      ...prev,
      studentPauseOverride: {
        ...(prev.studentPauseOverride || {}),
        [studentId]: pause,
      },
    }));
  };

  const handleSaveSchoolPauseDefaults = (pause: {
    pauseNewSabaqOnSabqiRepeat: boolean;
    pauseNewSabaqOnManzilRepeat: boolean;
  }) => {
    onUpdateState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        pauseNewSabaqOnSabqiRepeat: pause.pauseNewSabaqOnSabqiRepeat,
        pauseNewSabaqOnManzilRepeat: pause.pauseNewSabaqOnManzilRepeat,
        freezeSabaqOnSabqiOrManzilFail:
          pause.pauseNewSabaqOnSabqiRepeat || pause.pauseNewSabaqOnManzilRepeat,
      },
    }));
  };

  const handleResetToDefaults = (studentId: string) => {
    onUpdateState(prev => {
      const limitsCopy = { ...prev.studentLimitsOverride };
      delete limitsCopy[studentId];
      const pauseCopy = { ...(prev.studentPauseOverride || {}) };
      delete pauseCopy[studentId];
      return {
        ...prev,
        studentLimitsOverride: limitsCopy,
        studentPauseOverride: pauseCopy,
      };
    });
  };

  const activeTimeZone = state.settings?.timeZone || DEFAULT_SCHOOL_TIMEZONE;
  const realTomorrow = getRealTomorrowDate(activeTimeZone);

  if (currentMarking) {
    return (
      <UstaadMarkingScreen
        state={state}
        student={currentMarking.student}
        initialPart={currentMarking.part}
        targetDate={currentMarking.targetDate}
        onBack={handleCloseMarkingScreen}
        onSaveSession={handleSaveSession}
        onUpdateMushafSettings={handleUpdateMushafSettings}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-5">
      {/* Halqa Banner & Rule Controls */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-3.5 sm:p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-base sm:text-lg md:text-xl text-[#241811]">
                {state.language === 'ur' ? ustaad.urduName : ustaad.name}
              </span>
              <span className="text-[#C5A059]">۞</span>
              <span className="text-[#8F6E2B] font-semibold text-xs md:text-sm bg-[#F5EFEB] px-2.5 py-1 rounded-lg border border-[#DFCFA8]">
                {ustaad.halqaName}
              </span>
            </div>
            <p className="text-xs text-[#7A6C60] mt-1.5 flex flex-wrap items-center gap-1.5">
              <span>
                {halqaStudents.length}{' '}
                {state.language === 'ur' ? 'طلبہ زیرِ نگرانی' : 'Students enrolled'}
              </span>
              <span>·</span>
              <span className="font-mono text-[#5A4333] font-semibold">
                {state.language === 'ur' ? 'آج:' : 'Today:'} {state.currentDate}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-[#F8F4EC] border border-[#DFCFA8] p-3 rounded-xl">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="text-left">
                <div className="text-xs font-bold text-[#241811]">
                  {t.pauseOnSabqiRepeatLabel}
                </div>
                <div className="text-[10px] text-[#7A6C60]">
                  {state.language === 'ur'
                    ? `مدرسہ ڈیفالٹ · آئندہ یوم: ${realTomorrow}`
                    : `School default (override per student in Limits) · Next day: ${realTomorrow}`}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={
                  state.settings.pauseNewSabaqOnSabqiRepeat ??
                  state.settings.freezeSabaqOnSabqiOrManzilFail ??
                  true
                }
                onClick={() => {
                  const currSabqi =
                    state.settings.pauseNewSabaqOnSabqiRepeat ??
                    state.settings.freezeSabaqOnSabqiOrManzilFail ??
                    true;
                  const currManzil =
                    state.settings.pauseNewSabaqOnManzilRepeat ??
                    state.settings.freezeSabaqOnSabqiOrManzilFail ??
                    true;
                  handleSaveSchoolPauseDefaults({
                    pauseNewSabaqOnSabqiRepeat: !currSabqi,
                    pauseNewSabaqOnManzilRepeat: currManzil,
                  });
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  (state.settings.pauseNewSabaqOnSabqiRepeat ??
                    state.settings.freezeSabaqOnSabqiOrManzilFail ??
                    true)
                    ? 'bg-[#1F4E3D] justify-end'
                    : 'bg-[#CDBE9F] justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#FCFAF6] shadow-md" />
              </button>
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer pt-2 border-t border-[#DFCFA8]/70">
              <div className="text-left">
                <div className="text-xs font-bold text-[#241811]">
                  {t.pauseOnManzilRepeatLabel}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={
                  state.settings.pauseNewSabaqOnManzilRepeat ??
                  state.settings.freezeSabaqOnSabqiOrManzilFail ??
                  true
                }
                onClick={() => {
                  const currSabqi =
                    state.settings.pauseNewSabaqOnSabqiRepeat ??
                    state.settings.freezeSabaqOnSabqiOrManzilFail ??
                    true;
                  const currManzil =
                    state.settings.pauseNewSabaqOnManzilRepeat ??
                    state.settings.freezeSabaqOnSabqiOrManzilFail ??
                    true;
                  handleSaveSchoolPauseDefaults({
                    pauseNewSabaqOnSabqiRepeat: currSabqi,
                    pauseNewSabaqOnManzilRepeat: !currManzil,
                  });
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  (state.settings.pauseNewSabaqOnManzilRepeat ??
                    state.settings.freezeSabaqOnSabqiOrManzilFail ??
                    true)
                    ? 'bg-[#1F4E3D] justify-end'
                    : 'bg-[#CDBE9F] justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#FCFAF6] shadow-md" />
              </button>
            </label>
          </div>
        </div>
      </div>

      {/* Halqa Students List */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#241811] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8F6E2B]" />
              <span>{t.halqaTitle}</span>
            </h2>
            <span className="text-xs text-[#7A6C60]">{t.halqaSubtitle}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Student Type Filter: All | Hifz | Nazra */}
            <div
              role="group"
              aria-label={t.studentTypeLabel}
              className="flex items-center p-0.5 bg-[#EAE0CE] rounded-xl border border-[#DFCFA8]"
            >
              {(
                [
                  { id: 'all', label: t.filterAll, count: halqaStudents.length },
                  { id: 'hifz', label: t.filterHifz, count: hifzCount },
                  { id: 'nazra', label: t.filterNazra, count: nazraCount },
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTypeFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    typeFilter === opt.id
                      ? 'bg-[#241811] text-[#FCFAF6] shadow-2xs'
                      : 'text-[#42362E] hover:text-[#241811]'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      typeFilter === opt.id
                        ? 'bg-[#C5A059] text-[#241811]'
                        : 'bg-white/75 text-[#5A4333]'
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Add Student Button */}
            <button
              type="button"
              onClick={() => setShowAddStudentModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C5A059] bg-[#1F4E3D] hover:bg-[#16382C] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#DFCFA8]" />
              <span>{t.addStudentButton}</span>
            </button>

            {/* Optional "Assign by lines" button for the whole Halqa or selected students */}
            <button
              type="button"
              onClick={() => setShowAssignByLinesModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C5A059] bg-[#F8F4EC] hover:bg-[#F3ECE1] text-[#241811] text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <ListChecks className="w-4 h-4 text-[#1F4E3D]" />
              <span>{t.assignByLinesButton}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
          {filteredHalqaStudents.length === 0 && (
            <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-6 text-center text-xs text-[#7A6C60]">
              {state.language === 'ur'
                ? 'اس زمرے میں کوئی طالب علم موجود نہیں ہے۔'
                : `No ${typeFilter === 'all' ? '' : typeFilter === 'hifz' ? 'Hifz ' : 'Nazra '}students in this Halqa yet.`}
            </div>
          )}

          {filteredHalqaStudents.map(student => {
            const isNazra = student.studentType === 'nazra';
            const studentType: StudentType = isNazra ? 'nazra' : 'hifz';
            const viewedDate = getStudentViewedDate(student.id);
            const viewedPlan = state.dailyPlans[student.id]?.[viewedDate];
            const hasOverriddenLimits = Boolean(
              state.studentLimitsOverride[student.id] ||
                state.studentPauseOverride?.[student.id]
            );
            const paraStatus = getParaCompletionStatus(student, state);
            const currentParaSabqi = !isNazra
              ? computeCurrentParaSabqiRange(student, state, viewedDate)
              : null;
            const manzilState = isNazra
              ? { dueParas: [], repeatParas: {} }
              : computeManzilParaStates(student, state, viewedDate);
            const manzilRepeatEntries = Object.entries(manzilState.repeatParas)
              .map(([k, dt]) => [parseInt(k, 10), dt] as [number, string])
              .sort((a, b) => a[0] - b[0]);
            const pauseStatus = isNazra
              ? null
              : getNewSabaqPauseStatus(student, state, viewedDate);
            const hasRevisionFailFreeze = Boolean(pauseStatus?.isPaused);
            const lastTypeChange =
              student.typeChangeHistory && student.typeChangeHistory.length > 0
                ? student.typeChangeHistory[student.typeChangeHistory.length - 1]
                : null;
            const visibleParts: PartType[] = isNazra ? ['sabaq'] : ['sabaq', 'sabqi', 'manzil'];
            const displayedParaList = isNazra
              ? student.nazraCompletedParas || []
              : student.completedParas || [];
            const isParaGridExpanded = Boolean(expandedParaGridByStudent[student.id]);
            const progressPct = Math.min(100, Math.round((displayedParaList.length / 30) * 100));

            const dueCount = !isNazra ? manzilState.dueParas.length : 0;
            const repeatCount = !isNazra ? manzilRepeatEntries.length : 0;
            const barSummaryParts: string[] = [];
            if (dueCount > 0) {
              barSummaryParts.push(
                state.language === 'ur'
                  ? `${dueCount} ${t.manzilDuePrefix}`
                  : `${dueCount} Manzil due`
              );
            }
            if (repeatCount > 0) {
              barSummaryParts.push(
                state.language === 'ur' ? `${repeatCount} ${t.repeatPrefix}` : `${repeatCount} Repeat`
              );
            }
            const barSummaryText = barSummaryParts.join(', ');

            return (
              <div
                key={student.id}
                className="bg-[#FCFAF6] rounded-xl border border-[#E8DCC4] shadow-2xs hover:shadow-sm hover:border-[#C5A059]/60 transition-all p-2.5 sm:p-3.5 flex flex-col gap-2 relative"
              >
                <div className="pointer-events-none absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#C5A059]/30 to-transparent rounded-t-xl" />

                {/* Compact Student Header: Identity + Record Date + Quick Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-1.5 border-b border-[#E8DCC4]/70">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#2A1D15] text-[#DFCFA8] font-bold flex items-center justify-center text-xs shrink-0 border border-[#C5A059] mt-0.5">
                      {student.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-bold text-[#241811] text-sm leading-tight">
                          {state.language === 'ur' ? student.urduName : student.name}
                        </h3>
                        <StudentTypeBadge type={studentType} language={state.language} size="xs" />
                        <span className="text-[11px] font-medium text-[#3E2B20] tabular-nums">
                          ·{' '}
                          {state.language === 'ur'
                            ? `پارہ ${student.currentJuz}`
                            : `Para ${student.currentJuz}`}
                        </span>
                        <span
                          className={`text-[11px] font-bold tabular-nums ${
                            isNazra ? 'text-[#16365D]' : 'text-[#1F4E3D]'
                          }`}
                        >
                          · {displayedParaList.length}/30{' '}
                          {isNazra
                            ? state.language === 'ur'
                              ? 'ناظرہ'
                              : 'Nazra'
                            : state.language === 'ur'
                            ? 'مکمل'
                            : 'Done'}
                        </span>
                        {hasOverriddenLimits && (
                          <span className="text-[10px] text-[#8F6E2B] font-semibold">
                            · Custom Limits
                          </span>
                        )}
                      </div>

                      {((!isNazra && currentParaSabqi) || lastTypeChange) && (
                        <div className="text-[10px] text-[#5A4333] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {!isNazra && currentParaSabqi && (
                            <span className="font-mono">
                              Sabqi: P{currentParaSabqi.range.start.page}:L
                              {currentParaSabqi.range.start.line}–P
                              {currentParaSabqi.range.end.page}:L
                              {currentParaSabqi.range.end.line} ({currentParaSabqi.passedCount}{' '}
                              passed)
                            </span>
                          )}
                          {lastTypeChange && (
                            <span className="text-[#7A6C60]">
                              {!isNazra && currentParaSabqi ? '· ' : ''}
                              {state.language === 'ur'
                                ? `تبدیلی (${lastTypeChange.fromType === 'hifz' ? 'حفظ' : 'ناظرہ'} ← ${
                                    lastTypeChange.toType === 'hifz' ? 'حفظ' : 'ناظرہ'
                                  }): ${lastTypeChange.changedByUrdu || lastTypeChange.changedBy} · ${lastTypeChange.changedAt.slice(0, 10)}`
                                : `Changed ${lastTypeChange.fromType}→${lastTypeChange.toType} by ${lastTypeChange.changedBy} (${lastTypeChange.changedAt.slice(0, 10)})`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Date Navigator, Change Type & Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-1.5 shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DateNavigator
                        selectedDate={viewedDate}
                        todayDate={state.currentDate}
                        onChangeDate={d => setStudentViewedDate(student.id, d)}
                        language={state.language}
                        compact
                      />
                      <button
                        type="button"
                        onClick={() => setChangingTypeStudent(student)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#DFCFA8] bg-[#F8F4EC] hover:bg-[#F3ECE1] hover:border-[#C5A059] text-[#3E2B20] text-[10px] font-bold transition-colors cursor-pointer min-h-[30px]"
                        title={t.changeTypeButton}
                      >
                        <ArrowLeftRight className="w-3 h-3 text-[#8F6E2B]" />
                        <span>{isNazra ? t.studentTypeHifz : t.studentTypeNazra}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setAssignModalTarget({
                            student,
                            initialPart: 'sabaq',
                            targetDate: viewedDate,
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#C5A059]/80 bg-[#2A1D15] hover:bg-[#38271D] text-[#FCFAF6] text-[11px] font-semibold transition-colors cursor-pointer min-h-[32px]"
                        title={t.assignWork}
                      >
                        <BookOpen className="w-3 h-3 text-[#DFCFA8]" />
                        <span>{t.assignWork}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLimitsStudent(student)}
                        className="p-1.5 rounded-lg border border-[#DFCFA8] bg-[#FAF6EF] hover:bg-[#F3ECE1] text-[#42362E] transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                        title={t.limitsSettings}
                      >
                        <Sliders className="w-3.5 h-3.5 text-[#8F6E2B]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryStudent(student)}
                        className="p-1.5 rounded-lg border border-[#DFCFA8] bg-[#FAF6EF] hover:bg-[#F3ECE1] text-[#42362E] transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                        title={t.studentHistory}
                      >
                        <History className="w-3.5 h-3.5 text-[#8F6E2B]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Compact Daily Work Status: Sabaq, Sabqi, Manzil (Hifz) or Sabaq only (Nazra) */}
                <div
                  className={`grid grid-cols-1 gap-2 ${
                    isNazra ? 'sm:grid-cols-1' : 'sm:grid-cols-3'
                  }`}
                >
                  {visibleParts.map(partKey => {
                    const plan = viewedPlan ? viewedPlan[partKey] : null;
                    const rawRange = plan?.range || null;
                    const hasCompletedParasForManzil = (student.completedParas?.length || 0) > 0;
                    const validatedManzilParas =
                      partKey === 'manzil' && plan
                        ? getValidatedManzilParasForStudent(student, plan)
                        : [];
                    const isManzilNoCompleted =
                      partKey === 'manzil' && !hasCompletedParasForManzil;
                    const range =
                      partKey === 'manzil' &&
                      (!hasCompletedParasForManzil || validatedManzilParas.length === 0)
                        ? null
                        : rawRange;
                    const status = plan?.status || 'pending';
                    const daySessionResult = state.sessionResults.find(
                      r =>
                        r.studentId === student.id &&
                        r.date === viewedDate &&
                        r.part === partKey
                    );
                    const dayMarksForPart = state.marksHistory.filter(
                      m =>
                        m.studentId === student.id &&
                        m.date === viewedDate &&
                        m.part === partKey
                    );
                    const ghaltiShown =
                      daySessionResult?.ghaltiCount ??
                      dayMarksForPart.filter(m => m.type === 'ghalti').length;
                    const atkanShown =
                      daySessionResult?.atkanCount ??
                      dayMarksForPart.filter(m => m.type === 'atkan').length;

                    let statusBadge: React.ReactNode = (
                      <span className="text-[10px] font-medium text-[#7A6C60] flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5 text-[#7A6C60]" />
                        {t.status.pending}
                      </span>
                    );

                    if (partKey === 'manzil' && !range) {
                      statusBadge = null;
                    } else if (partKey === 'sabaq' && !range) {
                      statusBadge = (
                        <span className="text-[10px] font-semibold text-[#78350F] bg-[#FEF3C7] px-1.5 py-0.2 rounded">
                          Empty
                        </span>
                      );
                    } else if (status === 'passed') {
                      statusBadge = (
                        <span className="text-[10px] font-bold text-[#1F4E3D] flex items-center gap-0.5 bg-[#E8F0EC] px-1.5 py-0.2 rounded">
                          <CheckCircle2 className="w-2.5 h-2.5 text-[#1F4E3D]" />
                          {t.status.passed}
                        </span>
                      );
                    } else if (status === 'repeat') {
                      statusBadge = (
                        <span className="text-[10px] font-bold text-[#991B1B] flex items-center gap-0.5 bg-[#FEE2E2] px-1.5 py-0.2 rounded">
                          <XCircle className="w-2.5 h-2.5 text-[#991B1B]" />
                          {t.status.repeat}
                        </span>
                      );
                    } else if (status === 'in_progress') {
                      statusBadge = (
                        <span className="text-[10px] font-bold text-[#B45309] flex items-center gap-0.5 bg-[#FEF3C7] px-1.5 py-0.2 rounded">
                          <Clock className="w-2.5 h-2.5 text-[#B45309]" />
                          {t.status.in_progress}
                        </span>
                      );
                    }

                    let subtitle = '';
                    if (plan && range) {
                      if (partKey === 'sabaq') {
                        subtitle = `P${range.start.page}:L${range.start.line}–P${range.end.page}:L${range.end.line} (${range.linesCount}L)`;
                      } else if (partKey === 'sabqi') {
                        subtitle =
                          plan.portionLabel ||
                          `P${range.start.page}–P${range.end.page} (${range.linesCount}L)`;
                      } else if (partKey === 'manzil') {
                        subtitle = isWholeParaManzilPlan(plan)
                          ? `Assigned: Para ${validatedManzilParas.join(', ')}`
                          : `Para ${validatedManzilParas.join(', ')} (P${range.start.page}–P${range.end.page})`;
                      }
                    }

                    return (
                      <div
                        key={partKey}
                        className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-lg px-2.5 py-2 flex flex-col justify-between hover:bg-[#F3ECE1] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-[#241811] capitalize flex items-center gap-1">
                            {partKey === 'sabaq' && <Sparkles className="w-3 h-3 text-[#C5A059]" />}
                            {partKey === 'sabqi' && <Layers className="w-3 h-3 text-[#8F6E2B]" />}
                            {partKey === 'manzil' && (
                              <BookmarkCheck className="w-3 h-3 text-[#1F4E3D]" />
                            )}
                            <span>{t.parts[partKey]}</span>
                          </span>
                          {statusBadge}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                          {partKey === 'sabaq' && !range ? (
                            <span className="text-[11px] text-[#7A6C60] italic">
                              {t.sabaqNotAssignedYet}
                            </span>
                          ) : isManzilNoCompleted ? (
                            <span className="text-[11px] text-[#7A6C60] font-medium">
                              {t.noCompletedParasYet}
                            </span>
                          ) : range ? (
                            <span className="text-[11px] font-mono text-[#42362E] truncate font-medium">
                              {subtitle}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#A69888] italic">Not set</span>
                          )}

                          {(daySessionResult || dayMarksForPart.length > 0) && (
                            <span className="text-[10px] font-mono text-[#5A4333] shrink-0">
                              {t.ghaltiShort}: {ghaltiShown} · {t.atkanShort}: {atkanShown}
                            </span>
                          )}
                        </div>

                        {partKey === 'manzil' &&
                          plan?.paraResults &&
                          Object.keys(plan.paraResults).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(plan.paraResults)
                                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
                                .map(([pKey, outcome]) => (
                                  <span
                                    key={pKey}
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                      outcome === 'passed'
                                        ? 'bg-[#E8F0EC] text-[#143429] border-[#2E6A54]/50'
                                        : 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]/50'
                                    }`}
                                  >
                                    {state.language === 'ur' ? `پارہ ${pKey}` : `P${pKey}`}:{' '}
                                    {outcome === 'passed'
                                      ? state.language === 'ur'
                                        ? 'پاس'
                                        : 'Pass'
                                      : t.repeatPrefix}
                                  </span>
                                ))}
                            </div>
                          )}

                        {partKey === 'sabaq' && !range ? (
                          hasRevisionFailFreeze && pauseStatus ? (
                            <div className="mt-1.5 pt-1 border-t border-[#DFCFA8]/80 space-y-0.5">
                              <button
                                type="button"
                                disabled
                                className="text-[11px] font-bold text-[#9A8B7A] flex items-center gap-1 cursor-not-allowed opacity-70"
                                title={pauseStatus.detailedReasons.join(' ')}
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>{t.assignSabaqButton}</span>
                              </button>
                              <div className="text-[10px] font-bold text-[#92400E] leading-snug">
                                {pauseStatus.detailedReasons.join(' ')}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setAssignModalTarget({
                                  student,
                                  initialPart: 'sabaq',
                                  targetDate: viewedDate,
                                })
                              }
                              className="mt-1.5 pt-1 border-t border-[#DFCFA8]/80 text-[11px] font-bold text-[#1F4E3D] hover:text-[#241811] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <BookOpen className="w-3 h-3 text-[#1F4E3D]" />
                              <span>{t.assignSabaqButton}</span>
                            </button>
                          )
                        ) : (
                          <div className="mt-1.5 pt-1 border-t border-[#DFCFA8]/80 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={!range}
                              onClick={() =>
                                handleStartMarkingStudent(student, partKey, viewedDate)
                              }
                              className="text-[11px] font-bold text-[#241811] hover:text-[#8F6E2B] disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Play className="w-2.5 h-2.5 fill-current text-[#C5A059]" />
                              <span>{t.listenAndMark}</span>
                            </button>
                            <button
                              type="button"
                              disabled={partKey === 'sabaq' && hasRevisionFailFreeze}
                              onClick={() =>
                                setAssignModalTarget({
                                  student,
                                  initialPart: partKey,
                                  targetDate: viewedDate,
                                })
                              }
                              title={
                                partKey === 'sabaq' && hasRevisionFailFreeze && pauseStatus
                                  ? pauseStatus.detailedReasons.join(' ')
                                  : undefined
                              }
                              className="text-[11px] font-semibold text-[#8F6E2B] hover:text-[#241811] underline cursor-pointer disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                            >
                              {range ? 'Change' : 'Assign'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Thin Collapsible Completed Paras & Manzil Bar (Collapsed by default) */}
                <div className="bg-[#F8F4EC]/75 border border-[#E2D4B7] rounded-lg">
                  <button
                    type="button"
                    aria-expanded={isParaGridExpanded}
                    onClick={() => toggleStudentParaGrid(student.id)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-[#F3ECE1]/70 transition-colors rounded-lg min-h-[34px]"
                  >
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                      <span className="text-[11px] sm:text-xs font-bold text-[#241811] flex items-center gap-1.5 tabular-nums">
                        <Grid
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isNazra ? 'text-[#16365D]' : 'text-[#1F4E3D]'
                          }`}
                        />
                        <span>
                          {isNazra
                            ? t.parasReadInNazra
                            : state.language === 'ur'
                            ? 'مکمل شدہ پارے اور منزل'
                            : 'Completed Paras & Manzil'}{' '}
                          <span className={isNazra ? 'text-[#16365D]' : 'text-[#1F4E3D]'}>
                            {displayedParaList.length} / 30
                          </span>
                        </span>
                      </span>

                      {/* Small progress line */}
                      <span
                        aria-hidden="true"
                        className="w-16 sm:w-24 h-1.5 rounded-full bg-[#E5DEC9] overflow-hidden inline-block shrink-0"
                      >
                        <span
                          className={`block h-full rounded-full transition-all ${
                            isNazra ? 'bg-[#16365D]' : 'bg-[#1F4E3D]'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </span>

                      {barSummaryText && (
                        <span className="text-[11px] font-bold text-[#92400E] tabular-nums">
                          {barSummaryText}
                        </span>
                      )}

                      {hasRevisionFailFreeze && pauseStatus && (
                        <span className="text-[10px] font-bold text-[#991B1B] inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{pauseStatus.reasons.join(' · ')}</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[#7A6C60] shrink-0 flex items-center">
                      {isParaGridExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {isParaGridExpanded && (
                    <div className="px-2.5 pb-2.5 pt-2 border-t border-[#E2D4B7]/70 space-y-2">
                      {(manzilState.dueParas.length > 0 || manzilRepeatEntries.length > 0) &&
                        !isNazra && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                            {manzilState.dueParas.length > 0 && (
                              <span className="font-bold text-[#92400E]">
                                {t.manzilDuePrefix}: {viewedDate} — Para{' '}
                                {manzilState.dueParas.join(', ')}
                              </span>
                            )}
                            {manzilRepeatEntries.length > 0 && (
                              <span className="font-bold text-[#991B1B]">
                                {t.repeatPrefix}:{' '}
                                {manzilRepeatEntries
                                  .map(([p, dt]) => `Para ${p} (${dt})`)
                                  .join(', ')}
                              </span>
                            )}
                          </div>
                        )}

                      <ParaProgressGrid
                        completedParas={displayedParaList}
                        currentJuz={student.currentJuz}
                        manzilAssignedParas={manzilState.dueParas}
                        manzilRepeatParas={manzilState.repeatParas}
                        currentDate={viewedDate}
                        language={state.language}
                        manzilDuePrefix={t.manzilDuePrefix}
                        repeatPrefix={t.repeatPrefix}
                        isNazra={isNazra}
                        mushafLayout={student.mushafLayout || state.settings.mushafLayout || 'madinah'}
                        onTapPara={paraNum =>
                          setParaViewerTarget({
                            student,
                            initialPara: paraNum,
                            targetDate: viewedDate,
                          })
                        }
                        compact
                      />
                    </div>
                  )}
                </div>

                {/* Para Completion & "Start New Para" Section */}
                {paraStatus.isParaFinished && (
                  <div
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      paraStatus.canStartNewPara
                        ? 'bg-[#EBF3EE] border-[#2E6A54]'
                        : 'bg-[#FEF3C7] border-[#D97706]'
                    }`}
                  >
                    <div className="flex items-start gap-2 text-xs">
                      {paraStatus.canStartNewPara ? (
                        <Award className="w-4 h-4 text-[#1F4E3D] shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                      )}

                      <div className="space-y-1">
                        <div className="font-bold text-[#241811] flex flex-wrap items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-white/75 border border-[#C5A059] text-[10px] uppercase tracking-wide">
                            {t.paraFinishedBadge}: Para {paraStatus.currentJuz}
                          </span>
                          {paraStatus.canStartNewPara ? (
                            <span className="text-[#143429]">
                              {isNazra
                                ? `All ${paraStatus.passedCountInPara} Sabaqs in Para ${paraStatus.currentJuz} passed. Ready to move to next Para in Nazra.`
                                : `All ${paraStatus.passedCountInPara} Sabaqs in Para ${paraStatus.currentJuz} passed. Ready to move to Manzil!`}
                            </span>
                          ) : (
                            <span className="text-[#78350F]">{t.cannotStartParaUnpassed}</span>
                          )}
                        </div>

                        {!paraStatus.canStartNewPara && paraStatus.unpassedSabaqs.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {paraStatus.unpassedSabaqs.map(unpassed => (
                              <button
                                key={unpassed.date}
                                type="button"
                                onClick={() => handleOpenUnpassedSabaq(unpassed.date, student)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#FFFDF9] border border-[#B91C1C]/60 text-[#991B1B] font-bold text-[11px] shadow-2xs cursor-pointer transition-colors"
                                title={`Open Sabaq of ${unpassed.date} to mark it Passed`}
                              >
                                <span>
                                  {state.language === 'ur'
                                    ? `${unpassed.date} کا سبق پاس نہیں ہے`
                                    : `Cannot start a new para: the Sabaq of ${unpassed.date} (P${unpassed.range.start.page}:L${unpassed.range.start.line}–P${unpassed.range.end.page}:L${unpassed.range.end.line}, ${unpassed.status}) is not passed. Pass it first.`}
                                </span>
                                <span className="inline-flex items-center gap-0.5 text-[#1F4E3D] underline ml-1">
                                  <span>{t.passItFirstAction}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!paraStatus.canStartNewPara}
                      onClick={() => setStartingParaStudent(student)}
                      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        paraStatus.canStartNewPara
                          ? 'bg-[#1F4E3D] hover:bg-[#16382C] text-white border-[#C5A059] shadow-xs cursor-pointer'
                          : 'bg-stone-200 text-stone-500 border-stone-300 cursor-not-allowed opacity-70'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{t.startNewParaButton}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <AddStudentModal
          state={state}
          ustaad={ustaad}
          onClose={() => setShowAddStudentModal(false)}
          onAddStudent={handleAddStudent}
        />
      )}

      {/* Change Student Type Confirmation Modal */}
      {changingTypeStudent && (
        <ChangeStudentTypeModal
          student={changingTypeStudent}
          ustaad={ustaad}
          language={state.language}
          currentDate={state.currentDate}
          onClose={() => setChangingTypeStudent(null)}
          onConfirm={handleChangeStudentType}
        />
      )}

      {/* Ustaad Para / Manzil Mushaf Viewer Modal (from 30-Para Grid tap) */}
      {paraViewerTarget && (
        <UstaadParaMushafModal
          state={state}
          student={state.students[paraViewerTarget.student.id] || paraViewerTarget.student}
          initialPara={paraViewerTarget.initialPara}
          targetDate={paraViewerTarget.targetDate}
          onClose={() => setParaViewerTarget(null)}
          onListenManzil={(st, dt) => handleStartMarkingStudent(st, 'manzil', dt)}
          onAssignManzil={(st, pNum, dt) =>
            setAssignModalTarget({
              student: st,
              initialPart: 'manzil',
              initialParaNum: pNum,
              targetDate: dt,
            })
          }
          onUpdateMushafSettings={handleUpdateMushafSettings}
        />
      )}

      {/* Assign Work Modal */}
      {assignModalTarget && (
        <AssignWorkModal
          state={state}
          student={assignModalTarget.student}
          initialPart={assignModalTarget.initialPart}
          initialParaNum={assignModalTarget.initialParaNum}
          targetDate={assignModalTarget.targetDate}
          onClose={() => setAssignModalTarget(null)}
          onSave={handleSaveAssignment}
          onUpdateMushafSettings={handleUpdateMushafSettings}
        />
      )}

      {/* Optional "Assign by lines" Halqa Preview Modal */}
      {showAssignByLinesModal && (
        <AssignByLinesModal
          state={state}
          students={filteredHalqaStudents.length > 0 ? filteredHalqaStudents : halqaStudents}
          onClose={() => setShowAssignByLinesModal(false)}
          onConfirmBatch={handleConfirmAssignByLines}
          onUpdateMushafSettings={handleUpdateMushafSettings}
        />
      )}

      {/* Start New Para Picker Modal */}
      {startingParaStudent && (
        <StartNewParaModal
          state={state}
          student={startingParaStudent}
          onClose={() => setStartingParaStudent(null)}
          onConfirm={handleConfirmStartNewPara}
        />
      )}

      {/* Limits Modal */}
      {limitsStudent && (
        <LimitsModal
          state={state}
          student={limitsStudent}
          onClose={() => setLimitsStudent(null)}
          onSaveStudentLimits={handleSaveStudentLimits}
          onSaveHalqaDefaultLimits={handleSaveHalqaDefaults}
          onSaveStudentPauseOverride={handleSaveStudentPauseOverride}
          onSaveSchoolPauseDefaults={handleSaveSchoolPauseDefaults}
          onResetToDefaults={handleResetToDefaults}
        />
      )}

      {/* History Modal */}
      {historyStudent && (
        <StudentHistoryModal
          state={state}
          student={historyStudent}
          onClose={() => setHistoryStudent(null)}
          onJumpToWord={onJumpToMushafWord}
        />
      )}
    </div>
  );
};
