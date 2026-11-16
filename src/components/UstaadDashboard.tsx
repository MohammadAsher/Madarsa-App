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
} from 'lucide-react';
import {
  MadrasaState,
  UstaadProfile,
  StudentProfile,
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
import { ParaProgressGrid } from './ParaProgressGrid';
import { DateNavigator } from './DateNavigator';
import {
  getParaCompletionStatus,
  computeCurrentParaSabqiRange,
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
    targetDate?: string;
  } | null>(null);
  const [showAssignByLinesModal, setShowAssignByLinesModal] = useState<boolean>(false);
  const [limitsStudent, setLimitsStudent] = useState<StudentProfile | null>(null);
  const [historyStudent, setHistoryStudent] = useState<StudentProfile | null>(null);
  const [startingParaStudent, setStartingParaStudent] = useState<StudentProfile | null>(null);
  const [pastDateByStudent, setPastDateByStudent] = useState<Record<string, string | undefined>>({});

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

  const handleUpdateMushafSettings = (patch: {
    mushafLayout?: 'hafizi' | 'madinah';
    mushafScript?: 'indopak' | 'uthmani';
    highContrastMushaf?: boolean;
  }) => {
    onUpdateState(prev => ({
      ...prev,
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

      currentDayPlan[result.part] = {
        ...currentDayPlan[result.part],
        status: result.finalResult,
        completedAt: new Date().toISOString(),
        sessionResultId: result.id,
      };
      studentPlans[result.date] = currentDayPlan;

      const draftState: MadrasaState = {
        ...prev,
        sessionResults: newResults,
        marksHistory: newMarksHistory,
        dailyPlans: {
          ...prev.dailyPlans,
          [result.studentId]: studentPlans,
        },
      };

      // Whenever a Sabaq is graded, recompute current Para's Sabqi for this date & later dates
      if (result.part === 'sabaq' && prev.students[result.studentId]) {
        const studentObj = prev.students[result.studentId];
        const datesToSync = Object.keys(studentPlans)
          .filter(d => d >= result.date)
          .sort();

        for (const d of datesToSync) {
          const dp = studentPlans[d];
          if (!dp || dp.sabqi?.sabqiCustomOverride) continue;
          const sabqiInfo = computeCurrentParaSabqiRange(studentObj, draftState, d);
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
                portionLabel: `Passed Sabaqs in Para ${studentObj.currentJuz} (P${sabqiInfo.range.start.page}:L${sabqiInfo.range.start.line} - P${sabqiInfo.range.end.page}:L${sabqiInfo.range.end.line})`,
              },
            };
          }
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

  // Start New Para: move finished Para to Manzil pool, reset Sabqi, leave new Para Sabaq EMPTY until Ustaad assigns!
  const handleConfirmStartNewPara = (studentId: string, chosenNextPara: number) => {
    onUpdateState(prev => {
      const student = prev.students[studentId];
      if (!student) return prev;

      const finishedPara = student.currentJuz;
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

      const studentHistory = { ...(prev.dailyPlans[studentId] || {}) };
      const todayPlan =
        studentHistory[prev.currentDate] || createEmptyDayPlan(prev.currentDate);

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
      updatedCompletedParas?: number[];
      sabqiCustomOverride?: boolean;
      targetDate?: string;
    }
  ) => {
    onUpdateState(prev => {
      const saveDate = extraMetadata?.targetDate || prev.currentDate;
      const studentIdsToUpdate = applyToAllHalqa ? ustaad.studentIds : [targetStudentId];
      const newDailyPlans = { ...prev.dailyPlans };
      const newStudents = { ...prev.students };

      studentIdsToUpdate.forEach(sid => {
        const studentHistory = { ...(newDailyPlans[sid] || {}) };
        const existingDayPlan =
          studentHistory[saveDate] || createEmptyDayPlan(saveDate);

        studentHistory[saveDate] = {
          ...existingDayPlan,
          [part]: {
            ...existingDayPlan[part],
            range,
            status: 'pending',
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

        if (extraMetadata?.updatedCompletedParas && newStudents[sid]) {
          newStudents[sid] = {
            ...newStudents[sid],
            completedParas: extraMetadata.updatedCompletedParas,
          };
        }
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
        const studentHistory = { ...(newDailyPlans[sid] || {}) };
        const dayPlan =
          studentHistory[prev.currentDate] || createEmptyDayPlan(prev.currentDate);
        studentHistory[prev.currentDate] = {
          ...dayPlan,
          sabaq: {
            ...dayPlan.sabaq,
            range,
            status: 'pending',
            repeatPracticeCount: 0,
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

  const handleResetToDefaults = (studentId: string) => {
    onUpdateState(prev => {
      const copy = { ...prev.studentLimitsOverride };
      delete copy[studentId];
      return {
        ...prev,
        studentLimitsOverride: copy,
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
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Halqa Banner & Rule Controls */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-5 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg md:text-xl text-[#241811]">
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

          <div className="flex items-center gap-4 bg-[#F8F4EC] border border-[#DFCFA8] p-3 rounded-xl">
            <div className="text-right">
              <div className="text-xs font-bold text-[#241811]">{t.freezeRuleLabel}</div>
              <div className="text-[11px] text-[#7A6C60] max-w-xs">
                {t.freezeRuleDescription} ({realTomorrow})
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onUpdateState(prev => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    freezeSabaqOnSabqiOrManzilFail:
                      !prev.settings.freezeSabaqOnSabqiOrManzilFail,
                  },
                }));
              }}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                state.settings.freezeSabaqOnSabqiOrManzilFail
                  ? 'bg-[#1F4E3D] justify-end'
                  : 'bg-[#CDBE9F] justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-[#FCFAF6] shadow-md" />
            </button>
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

        <div className="grid grid-cols-1 gap-4">
          {halqaStudents.map(student => {
            const viewedDate = getStudentViewedDate(student.id);
            const viewedPlan = state.dailyPlans[student.id]?.[viewedDate];
            const hasOverriddenLimits = Boolean(state.studentLimitsOverride[student.id]);
            const paraStatus = getParaCompletionStatus(student, state);
            const currentParaSabqi = computeCurrentParaSabqiRange(student, state, viewedDate);

            return (
              <div
                key={student.id}
                className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] shadow-xs hover:shadow-md hover:border-[#C5A059]/60 transition-all p-4 md:p-5 flex flex-col gap-4 relative overflow-hidden"
              >
                <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#C5A059]/30 to-transparent" />

                {/* Card Date Bar: defaults to today; supports navigating to past dates cleanly */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E8DCC4]/70">
                  <div className="text-[11px] font-semibold text-[#7A6C60]">
                    {viewedDate === state.currentDate
                      ? state.language === 'ur'
                        ? 'آج کا ریکارڈ'
                        : "Today's record"
                      : state.language === 'ur'
                      ? `سابقہ ریکارڈ: ${viewedDate}`
                      : `Viewing record: ${viewedDate}`}
                  </div>
                  <DateNavigator
                    selectedDate={viewedDate}
                    todayDate={state.currentDate}
                    onChangeDate={d => setStudentViewedDate(student.id, d)}
                    language={state.language}
                    compact
                  />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  {/* Student Info */}
                  <div className="md:w-1/4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2A1D15] text-[#DFCFA8] font-bold flex items-center justify-center text-sm shrink-0 border border-[#C5A059] shadow-2xs">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-[#241811] text-sm md:text-base">
                          {state.language === 'ur' ? student.urduName : student.name}
                        </h3>
                        <div className="text-xs text-[#7A6C60] flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-[#3E2B20] font-medium">
                            {state.language === 'ur'
                              ? `پارہ ${student.currentJuz}`
                              : `Current: Para ${student.currentJuz}`}
                          </span>
                          <span className="text-[#C5A059]">·</span>
                          <span className="text-[#1F4E3D] font-bold bg-[#E8F0EC] px-1.5 py-0.5 rounded text-[11px]">
                            {student.completedParas?.length || 0}{' '}
                            {state.language === 'ur' ? 'پارے مکمل' : 'Paras Done'}
                          </span>
                          {hasOverriddenLimits && (
                            <span className="text-[10px] text-[#8F6E2B] font-semibold bg-[#F5EFEB] px-1.5 py-0.5 rounded">
                              Custom Limits
                            </span>
                          )}
                        </div>
                        {currentParaSabqi && (
                          <div className="text-[10px] text-[#5A4333] font-mono mt-1">
                            Sabqi: P{currentParaSabqi.range.start.page}:L
                            {currentParaSabqi.range.start.line}–P
                            {currentParaSabqi.range.end.page}:L
                            {currentParaSabqi.range.end.line} ({currentParaSabqi.passedCount}{' '}
                            passed)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Daily Work Status: Sabaq, Sabqi, Manzil */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(['sabaq', 'sabqi', 'manzil'] as PartType[]).map(partKey => {
                      const plan = viewedPlan ? viewedPlan[partKey] : null;
                      const range = plan?.range || null;
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

                      let statusBadge = (
                        <span className="text-[11px] font-medium text-[#7A6C60] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#7A6C60]" />
                          {t.status.pending}
                        </span>
                      );

                      if (partKey === 'sabaq' && !range) {
                        statusBadge = (
                          <span className="text-[10px] font-semibold text-[#78350F] bg-[#FEF3C7] px-1.5 py-0.5 rounded">
                            Empty
                          </span>
                        );
                      } else if (status === 'passed') {
                        statusBadge = (
                          <span className="text-[11px] font-bold text-[#1F4E3D] flex items-center gap-1 bg-[#E8F0EC] px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-[#1F4E3D]" />
                            {t.status.passed}
                          </span>
                        );
                      } else if (status === 'repeat') {
                        statusBadge = (
                          <span className="text-[11px] font-bold text-[#991B1B] flex items-center gap-1 bg-[#FEE2E2] px-1.5 py-0.5 rounded">
                            <XCircle className="w-3 h-3 text-[#991B1B]" />
                            {t.status.repeat}
                          </span>
                        );
                      } else if (status === 'in_progress') {
                        statusBadge = (
                          <span className="text-[11px] font-bold text-[#B45309] flex items-center gap-1 bg-[#FEF3C7] px-1.5 py-0.5 rounded">
                            <Clock className="w-3 h-3 text-[#B45309]" />
                            {t.status.in_progress}
                          </span>
                        );
                      }

                      let subtitle = '';
                      if (plan && range) {
                        if (partKey === 'sabaq') {
                          subtitle = `P${range.start.page}:L${range.start.line} - P${range.end.page}:L${range.end.line} (${range.linesCount}L)`;
                        } else if (partKey === 'sabqi') {
                          subtitle =
                            plan.portionLabel ||
                            `P${range.start.page} - P${range.end.page} (${range.linesCount}L)`;
                        } else if (partKey === 'manzil') {
                          subtitle =
                            plan.assignedParas && plan.assignedParas.length > 0
                              ? `Assigned: Para ${plan.assignedParas.join(', ')}`
                              : `P${range.start.page} - P${range.end.page}`;
                        }
                      }

                      return (
                        <div
                          key={partKey}
                          className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 flex flex-col justify-between hover:bg-[#F3ECE1] transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#241811] capitalize flex items-center gap-1">
                              {partKey === 'sabaq' && <Sparkles className="w-3 h-3 text-[#C5A059]" />}
                              {partKey === 'sabqi' && <Layers className="w-3 h-3 text-[#8F6E2B]" />}
                              {partKey === 'manzil' && (
                                <BookmarkCheck className="w-3 h-3 text-[#1F4E3D]" />
                              )}
                              <span>{t.parts[partKey]}</span>
                            </span>
                            {statusBadge}
                          </div>

                          {partKey === 'sabaq' && !range ? (
                            <div className="text-[11px] text-[#7A6C60] italic mt-1">
                              {t.sabaqNotAssignedYet}
                            </div>
                          ) : range ? (
                            <div className="text-[11px] font-mono text-[#42362E] truncate font-medium mt-1">
                              {subtitle}
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#A69888] italic mt-1">Not set</div>
                          )}

                          {(daySessionResult || dayMarksForPart.length > 0) && (
                            <div className="text-[10px] font-mono text-[#5A4333] mt-1">
                              {t.ghaltiShort}: {ghaltiShown} · {t.atkanShort}: {atkanShown}
                            </div>
                          )}

                          {partKey === 'sabaq' && !range ? (
                            <button
                              type="button"
                              onClick={() =>
                                setAssignModalTarget({
                                  student,
                                  initialPart: 'sabaq',
                                  targetDate: viewedDate,
                                })
                              }
                              className="mt-2.5 text-xs font-bold text-[#1F4E3D] hover:text-[#241811] flex items-center gap-1 cursor-pointer pt-1.5 border-t border-[#DFCFA8]/80 transition-colors"
                            >
                              <BookOpen className="w-3 h-3 text-[#1F4E3D]" />
                              <span>{t.assignSabaqButton}</span>
                            </button>
                          ) : (
                            <div className="mt-2.5 pt-1.5 border-t border-[#DFCFA8]/80 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                disabled={!range}
                                onClick={() =>
                                  handleStartMarkingStudent(student, partKey, viewedDate)
                                }
                                className="text-xs font-bold text-[#241811] hover:text-[#8F6E2B] disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Play className="w-3 h-3 fill-current text-[#C5A059]" />
                                <span>{t.listenAndMark}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setAssignModalTarget({
                                    student,
                                    initialPart: partKey,
                                    targetDate: viewedDate,
                                  })
                                }
                                className="text-[11px] font-semibold text-[#8F6E2B] hover:text-[#241811] underline cursor-pointer"
                              >
                                {range ? 'Change' : 'Assign'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 md:w-auto shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[#E8DCC4]">
                    <button
                      type="button"
                      onClick={() =>
                        setAssignModalTarget({
                          student,
                          initialPart: 'sabaq',
                          targetDate: viewedDate,
                        })
                      }
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C5A059]/80 bg-[#2A1D15] hover:bg-[#38271D] text-[#FCFAF6] text-xs font-semibold transition-colors cursor-pointer shadow-xs min-h-[38px]"
                      title={t.assignWork}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#DFCFA8]" />
                      <span>{t.assignWork}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLimitsStudent(student)}
                      className="p-2 rounded-xl border border-[#DFCFA8] bg-[#FAF6EF] hover:bg-[#F3ECE1] text-[#42362E] transition-colors cursor-pointer shadow-2xs min-h-[38px]"
                      title={t.limitsSettings}
                    >
                      <Sliders className="w-4 h-4 text-[#8F6E2B]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setHistoryStudent(student)}
                      className="p-2 rounded-xl border border-[#DFCFA8] bg-[#FAF6EF] hover:bg-[#F3ECE1] text-[#42362E] transition-colors cursor-pointer shadow-2xs min-h-[38px]"
                      title={t.studentHistory}
                    >
                      <History className="w-4 h-4 text-[#8F6E2B]" />
                    </button>
                  </div>
                </div>

                {/* Student 30-Para Progress & Manzil Status Grid (matches Student view colors) */}
                <div className="bg-[#F8F4EC]/75 border border-[#E2D4B7] rounded-xl p-3 sm:p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#241811] flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-[#1F4E3D]" />
                      <span>
                        {state.language === 'ur'
                          ? 'مکمل شدہ پارے اور منزل'
                          : 'Completed Paras & Manzil'}
                      </span>
                      <span className="text-[11px] font-mono bg-[#E8F0EC] text-[#1F4E3D] px-1.5 py-0.5 rounded font-bold">
                        {student.completedParas?.length || 0} / 30
                      </span>
                    </div>

                    {viewedPlan?.manzil?.assignedParas &&
                      viewedPlan.manzil.assignedParas.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-md bg-[#F59E0B] border border-[#B45309] text-[#1C120C] text-[11px] font-bold">
                          {t.manzilDuePrefix}: {viewedDate} — Para{' '}
                          {viewedPlan.manzil.assignedParas.join(', ')}
                        </span>
                      )}
                  </div>

                  <ParaProgressGrid
                    completedParas={student.completedParas || []}
                    currentJuz={student.currentJuz}
                    manzilAssignedParas={viewedPlan?.manzil?.assignedParas || []}
                    currentDate={viewedDate}
                    language={state.language}
                    manzilDuePrefix={t.manzilDuePrefix}
                    onTapPara={() =>
                      setAssignModalTarget({
                        student,
                        initialPart: 'manzil',
                        targetDate: viewedDate,
                      })
                    }
                    compact
                  />
                </div>

                {/* Para Completion & "Start New Para" Section */}
                {paraStatus.isParaFinished && (
                  <div
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      paraStatus.canStartNewPara
                        ? 'bg-[#EBF3EE] border-[#2E6A54]'
                        : 'bg-[#FEF3C7] border-[#D97706]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 text-xs">
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
                              All {paraStatus.passedCountInPara} Sabaqs in Para{' '}
                              {paraStatus.currentJuz} passed. Ready to move to Manzil!
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
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        paraStatus.canStartNewPara
                          ? 'bg-[#1F4E3D] hover:bg-[#16382C] text-white border-[#C5A059] shadow-xs cursor-pointer'
                          : 'bg-stone-200 text-stone-500 border-stone-300 cursor-not-allowed opacity-70'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>{t.startNewParaButton}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Assign Work Modal */}
      {assignModalTarget && (
        <AssignWorkModal
          state={state}
          student={assignModalTarget.student}
          initialPart={assignModalTarget.initialPart}
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
          students={halqaStudents}
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
