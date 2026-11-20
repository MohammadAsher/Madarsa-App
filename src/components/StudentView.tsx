/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  RotateCcw,
  Plus,
  AlertTriangle,
  Award,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  BookmarkCheck,
  History,
  Grid,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  MadrasaState,
  StudentProfile,
  PartType,
  AssignmentRange,
} from '../types/hifz';
import { MushafViewer } from './MushafViewer';
import { StudentHistoryModal } from './StudentHistoryModal';
import { ParaProgressGrid } from './ParaProgressGrid';
import { DateNavigator } from './DateNavigator';
import { StudentTypeBadge } from './StudentTypeBadge';
import { translations } from '../i18n/translations';
import {
  computeCurrentParaSabqiRange,
  computeManzilParaStates,
  getNewSabaqPauseStatus,
  getValidatedManzilParasForStudent,
  isWholeParaManzilPlan,
} from '../services/hifzService';
import { getParaPageRange, getParaSurahName } from '../data/quranData';

interface StudentViewProps {
  state: MadrasaState;
  student: StudentProfile;
  onUpdateState: (updater: (prev: MadrasaState) => MadrasaState) => void;
  targetJumpWord?: { page: number; wordId: string } | null;
  onClearTargetJumpWord?: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  state,
  student,
  onUpdateState,
  targetJumpWord,
  onClearTargetJumpWord,
}) => {
  const t = translations[state.language];

  const [selectedDate, setSelectedDate] = useState<string>(state.currentDate);
  const prevCurrentDateRef = useRef<string>(state.currentDate);

  useEffect(() => {
    if (prevCurrentDateRef.current !== state.currentDate) {
      if (selectedDate >= prevCurrentDateRef.current) {
        setSelectedDate(state.currentDate);
      }
      prevCurrentDateRef.current = state.currentDate;
    }
  }, [state.currentDate, selectedDate]);

  useEffect(() => {
    setSelectedDate(state.currentDate);
  }, [student.id]);

  const activeDate = selectedDate <= state.currentDate ? selectedDate : state.currentDate;
  const isPastDate = activeDate < state.currentDate;
  const todayPlan = state.dailyPlans[student.id]?.[activeDate];

  const isNazra = student.studentType === 'nazra';
  const [activePart, setActivePart] = useState<PartType>('sabaq');
  const effectivePart: PartType = isNazra ? 'sabaq' : activePart;

  useEffect(() => {
    if (isNazra && activePart !== 'sabaq') {
      setActivePart('sabaq');
    }
  }, [isNazra, activePart]);

  const activeLayout = student.mushafLayout || state.settings.mushafLayout || 'madinah';

  // Optional Para tile preview when student taps a non-Manzil tile in "My Completed Paras"
  const [previewParaNum, setPreviewParaNum] = useState<number | null>(null);
  // Active Manzil para switcher state when viewing Manzil (keeps tapped para first when multiple assigned)
  const [selectedManzilPara, setSelectedManzilPara] = useState<number | null>(null);
  const [manzilLeadPara, setManzilLeadPara] = useState<number | null>(null);
  // Student portal keeps Completed Paras expanded by default
  const [isStudentParaGridExpanded, setIsStudentParaGridExpanded] = useState<boolean>(true);

  const currentParaSabqi = isNazra ? null : computeCurrentParaSabqiRange(student, state, activeDate);

  // Effective Sabqi range respects Ustaad manual narrowing override if present; otherwise all passed Sabaqs in current Para
  const effectiveSabqiRange: AssignmentRange | null = isNazra
    ? null
    : todayPlan?.sabqi?.sabqiCustomOverride && todayPlan.sabqi.range
    ? todayPlan.sabqi.range
    : currentParaSabqi?.range || null;

  const completedParasList = student.completedParas || [];
  const hasCompletedParas = completedParasList.length > 0;

  const manzilState = isNazra
    ? { dueParas: [], repeatParas: {} as Record<number, string> }
    : computeManzilParaStates(student, state, activeDate);
  const pauseStatus = isNazra
    ? null
    : getNewSabaqPauseStatus(student, state, activeDate);
  const manzilRepeatEntries = Object.entries(manzilState.repeatParas)
    .map(([k, dt]) => [parseInt(k, 10), dt] as [number, string])
    .sort((a, b) => a[0] - b[0]);

  const planManzilParas =
    !isNazra && todayPlan?.manzil
      ? getValidatedManzilParasForStudent(student, todayPlan.manzil)
      : [];
  const isWholeParaManzil =
    !isNazra && Boolean(todayPlan?.manzil) && isWholeParaManzilPlan(todayPlan?.manzil);
  const hasCustomRangeManzil =
    !isNazra &&
    hasCompletedParas &&
    Boolean(todayPlan?.manzil?.range) &&
    !isWholeParaManzil &&
    planManzilParas.length > 0;
  const hasValidManzilAssignment =
    !isNazra &&
    hasCompletedParas &&
    Boolean(todayPlan?.manzil?.range) &&
    planManzilParas.length > 0;

  const manzilSwitchParas = React.useMemo(() => {
    if (isNazra || !hasCompletedParas) return [];
    const basePool = new Set<number>([
      ...planManzilParas,
      ...manzilState.dueParas,
      ...(selectedManzilPara && Boolean(manzilState.repeatParas[selectedManzilPara])
        ? [selectedManzilPara]
        : []),
      ...(manzilLeadPara && Boolean(manzilState.repeatParas[manzilLeadPara])
        ? [manzilLeadPara]
        : []),
    ]);
    if (basePool.size === 0 && manzilRepeatEntries.length > 0) {
      manzilRepeatEntries.forEach(([p]) => basePool.add(p));
    }
    const sorted = Array.from(basePool)
      .filter(p => p >= 1 && p <= 30)
      .sort((a, b) => a - b);
    if (manzilLeadPara && sorted.includes(manzilLeadPara)) {
      return [manzilLeadPara, ...sorted.filter(p => p !== manzilLeadPara)];
    }
    return sorted;
  }, [isNazra, hasCompletedParas, planManzilParas, manzilState.dueParas, manzilState.repeatParas, selectedManzilPara, manzilLeadPara, manzilRepeatEntries]);

  const activeManzilPara =
    effectivePart === 'manzil' && previewParaNum === null && hasCompletedParas
      ? selectedManzilPara && manzilSwitchParas.includes(selectedManzilPara)
        ? selectedManzilPara
        : manzilSwitchParas[0] || null
      : null;

  // Highlight ONLY what Ustaad actually assigned (Sabaq range, Sabqi range, or custom from-to Manzil).
  // Never highlight an entire para on tile tap or whole-para Manzil!
  const mushafHighlightRange: AssignmentRange | null =
    previewParaNum !== null
      ? null
      : effectivePart === 'sabqi'
      ? effectiveSabqiRange
      : effectivePart === 'manzil'
      ? hasCustomRangeManzil
        ? todayPlan?.manzil?.range || null
        : null
      : todayPlan?.[effectivePart]?.range || null;

  // Plan range used for repeat counter enablement and header lines count
  const activePlanRange: AssignmentRange | null =
    previewParaNum !== null
      ? null
      : effectivePart === 'sabqi'
      ? effectiveSabqiRange
      : effectivePart === 'manzil'
      ? hasValidManzilAssignment
        ? todayPlan?.manzil?.range || null
        : null
      : todayPlan?.[effectivePart]?.range || null;

  const manzilHeaderParaBadge: number | null =
    previewParaNum === null &&
    effectivePart === 'manzil' &&
    !hasCustomRangeManzil &&
    activeManzilPara !== null
      ? activeManzilPara
      : null;

  const [currentPage, setCurrentPage] = useState<number>(
    targetJumpWord?.page ||
      mushafHighlightRange?.start.page ||
      activePlanRange?.start.page ||
      getParaPageRange(student.currentJuz || 1, activeLayout).startPage
  );

  // Keep page synced when switching student roles or dates
  useEffect(() => {
    if (targetJumpWord) {
      setCurrentPage(targetJumpWord.page);
      return;
    }
    setPreviewParaNum(null);
    setSelectedManzilPara(null);
    setManzilLeadPara(null);
    const defaultPlan = state.dailyPlans[student.id]?.[activeDate];
    if (effectivePart === 'manzil' && hasCompletedParas && defaultPlan?.manzil) {
      const mParas = getValidatedManzilParasForStudent(student, defaultPlan.manzil);
      if (mParas.length > 0) {
        if (!isWholeParaManzilPlan(defaultPlan.manzil) && defaultPlan.manzil.range) {
          setSelectedManzilPara(mParas[0]);
          setCurrentPage(defaultPlan.manzil.range.start.page);
          return;
        }
        setSelectedManzilPara(mParas[0]);
        setCurrentPage(getParaPageRange(mParas[0], activeLayout).startPage);
        return;
      }
    }
    const startPage =
      effectivePart === 'manzil' ? undefined : defaultPlan?.[effectivePart]?.range?.start.page;
    if (startPage) {
      setCurrentPage(startPage);
    } else {
      setCurrentPage(getParaPageRange(student.currentJuz || 1, activeLayout).startPage);
    }
  }, [student.id, activeDate, isNazra]);

  const [hideAndRevealActive, setHideAndRevealActive] = useState<boolean>(false);
  const [pulsingWordId, setPulsingWordId] = useState<string | null>(
    targetJumpWord?.wordId || null
  );
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const handleJumpToMistake = (page: number, wordId: string) => {
    setPreviewParaNum(null);
    setCurrentPage(page);
    setPulsingWordId(wordId);
    setTimeout(() => {
      setPulsingWordId(null);
      if (onClearTargetJumpWord) onClearTargetJumpWord();
    }, 5000);
  };

  const handleOpenMySabqi = () => {
    if (isNazra) return;
    setPreviewParaNum(null);
    setActivePart('sabqi');
    if (effectiveSabqiRange) {
      setCurrentPage(effectiveSabqiRange.start.page);
    } else {
      setCurrentPage(getParaPageRange(student.currentJuz || 1, activeLayout).startPage);
    }
  };

  const handleSwitchManzilPara = (paraNum: number) => {
    setPreviewParaNum(null);
    setActivePart('manzil');
    setSelectedManzilPara(paraNum);
    setCurrentPage(getParaPageRange(paraNum, activeLayout).startPage);
  };

  const handleTapParaTile = (paraNum: number) => {
    const isManzilPara =
      !isNazra &&
      hasCompletedParas &&
      (manzilState.dueParas.includes(paraNum) ||
        Boolean(manzilState.repeatParas[paraNum]) ||
        planManzilParas.includes(paraNum));
    const { startPage } = getParaPageRange(paraNum, activeLayout);

    if (isManzilPara) {
      setPreviewParaNum(null);
      setActivePart('manzil');
      setManzilLeadPara(paraNum);
      setSelectedManzilPara(paraNum);
      setCurrentPage(
        hasCustomRangeManzil && todayPlan?.manzil?.range
          ? todayPlan.manzil.range.start.page
          : startPage
      );
    } else {
      setPreviewParaNum(paraNum);
      setCurrentPage(startPage);
    }
  };

  const currentPartPlan = todayPlan ? todayPlan[effectivePart] : null;

  const handleIncrementRepeat = () => {
    if (isPastDate || !currentPartPlan || !activePlanRange) return;
    onUpdateState(prev => {
      const studentHistory = { ...(prev.dailyPlans[student.id] || {}) };
      const dayPlan = studentHistory[activeDate]
        ? { ...studentHistory[activeDate] }
        : null;

      if (dayPlan) {
        const currentCount = dayPlan[effectivePart].repeatPracticeCount || 0;
        dayPlan[effectivePart] = {
          ...dayPlan[effectivePart],
          repeatPracticeCount: currentCount + 1,
          lastPracticedAt: new Date().toISOString(),
        };
        studentHistory[activeDate] = dayPlan;
      }

      return {
        ...prev,
        dailyPlans: {
          ...prev.dailyPlans,
          [student.id]: studentHistory,
        },
      };
    });
  };

  const handleResetRepeat = () => {
    if (isPastDate || !currentPartPlan || !activePlanRange) return;
    onUpdateState(prev => {
      const studentHistory = { ...(prev.dailyPlans[student.id] || {}) };
      const dayPlan = studentHistory[activeDate]
        ? { ...studentHistory[activeDate] }
        : null;

      if (dayPlan) {
        dayPlan[effectivePart] = {
          ...dayPlan[effectivePart],
          repeatPracticeCount: 0,
        };
        studentHistory[activeDate] = dayPlan;
      }

      return {
        ...prev,
        dailyPlans: {
          ...prev.dailyPlans,
          [student.id]: studentHistory,
        },
      };
    });
  };

  const handleUpdateMushafSettings = (patch: {
    mushafLayout?: 'hafizi' | 'madinah';
    mushafScript?: 'indopak' | 'uthmani';
    highContrastMushaf?: boolean;
  }) => {
    onUpdateState(prev => ({
      ...prev,
      students: patch.mushafLayout
        ? {
            ...prev.students,
            [student.id]: {
              ...prev.students[student.id],
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

  const todayResults = state.sessionResults.filter(
    s =>
      s.studentId === student.id &&
      s.date === activeDate &&
      (!isNazra || s.part === 'sabaq')
  );

  const activePartMarks =
    previewParaNum === null
      ? state.marksHistory.filter(
          m =>
            m.studentId === student.id &&
            m.date === activeDate &&
            m.part === effectivePart
        )
      : [];

  const repeatCount = currentPartPlan?.repeatPracticeCount || 0;
  const targetRepeats = currentPartPlan?.targetRepeats || 10;
  const displayedParasCount = isNazra
    ? student.nazraCompletedParas?.length || 0
    : student.completedParas?.length || 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-5">
      {/* Student Profile Banner */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-3.5 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />

        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3E2B20] to-[#241811] text-[#DFCFA8] font-bold flex items-center justify-center text-lg shadow-xs border border-[#C5A059]">
            {student.name.charAt(0)}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8F6E2B]">
              {isNazra ? t.nazraPortalTitle : t.studentPortalTitle}
            </div>
            <h1 className="text-lg md:text-xl font-bold text-[#241811] flex flex-wrap items-center gap-2">
              <span>{state.language === 'ur' ? student.urduName : student.name}</span>
              <StudentTypeBadge
                type={student.studentType || 'hifz'}
                language={state.language}
                size="sm"
              />
              <span className="text-[#C5A059] text-xs">۞</span>
            </h1>
            <div className="text-xs text-[#7A6C60] mt-0.5">
              {student.halqaName} ·{' '}
              {state.language === 'ur' ? `پارہ ${student.currentJuz}` : `Juz ${student.currentJuz}`} ·{' '}
              <span className={isNazra ? 'text-[#16365D] font-bold' : 'text-[#1F4E3D] font-bold'}>
                {isNazra
                  ? state.language === 'ur'
                    ? `${displayedParasCount} ناظرہ پارے پڑھے`
                    : `${displayedParasCount} Nazra Paras Read`
                  : `${displayedParasCount} Paras Done`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 text-xs text-[#7A6C60]">
          <div>
            {t.roleLabel}{' '}
            <strong className="text-[#241811]">
              {state.language === 'ur' ? student.urduName : student.name}
            </strong>
          </div>
          <DateNavigator
            selectedDate={activeDate}
            todayDate={state.currentDate}
            onChangeDate={d => setSelectedDate(d > state.currentDate ? state.currentDate : d)}
            language={state.language}
          />
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F4EC] hover:bg-[#F3ECE1] border border-[#DFCFA8] hover:border-[#C5A059] text-[#241811] text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-[#8F6E2B]" />
            <span>{t.viewLessonHistory}</span>
          </button>
        </div>
      </div>

      {/* Sabaq Paused Notice Banner (Hifz only, shown ONLY while Sabqi/Manzil Repeat is pending) */}
      {!isNazra && pauseStatus?.isPaused && (
        <div className="bg-[#FEF3C7] border-2 border-[#D97706] rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#78350F]">
              {pauseStatus.reasons.join(' · ')}
            </h4>
            <p className="text-xs text-[#92400E] mt-0.5 font-medium">
              {pauseStatus.detailedReasons.join(' ')}
            </p>
          </div>
        </div>
      )}

      {/* Requirement E: Dedicated "My Sabqi" Card (Hifz only) */}
      {!isNazra && (
        <button
          type="button"
          onClick={handleOpenMySabqi}
          className={`w-full text-left rounded-2xl border p-4 shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            effectivePart === 'sabqi' && previewParaNum === null
              ? 'bg-[#FDFCF9] border-[#C5A059] ring-2 ring-[#C5A059]/40'
              : 'bg-[#FCFAF6] border-[#E8DCC4] hover:border-[#C5A059]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8F4EC] border border-[#C5A059] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-[#8F6E2B]" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-[#241811] flex items-center gap-2">
                <span>{t.mySabqiTitle}</span>
                <span className="text-[11px] font-mono bg-[#E8F0EC] text-[#1F4E3D] px-2 py-0.5 rounded">
                  Para {student.currentJuz}
                </span>
              </h2>
              <p className="text-xs text-[#7A6C60] mt-0.5">{t.mySabqiHelp}</p>
              {effectiveSabqiRange ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-[#143429]">
                  <span className="bg-[#EBF3EE] border border-[#2E6A54]/40 px-2.5 py-0.5 rounded-md">
                    Page {effectiveSabqiRange.start.page} line {effectiveSabqiRange.start.line} to Page{' '}
                    {effectiveSabqiRange.end.page} line {effectiveSabqiRange.end.line}
                  </span>
                  <span className="text-[#8F6E2B]">
                    ({effectiveSabqiRange.linesCount} lines · {currentParaSabqi?.passedCount || 0} passed lessons)
                  </span>
                </div>
              ) : (
                <div className="mt-1.5 text-xs text-[#B45309] font-semibold">
                  {t.noPassedSabqiYet}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-[#8F6E2B] shrink-0">
            <span>{effectiveSabqiRange ? 'Open Sabqi on Mushaf' : 'View Para Start'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      )}

      {/* 1. Assigned Work Cards: Sabaq (plus Sabqi & Manzil for Hifz) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#241811] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#8F6E2B]" />
            <span>
              {isPastDate
                ? state.language === 'ur'
                  ? `اسباق (${activeDate})`
                  : `Assigned Work (${activeDate})`
                : t.todayPlan}
            </span>
          </h2>
          <span className="text-xs text-[#7A6C60]">
            Tap a plan to open and practice its lines
          </span>
        </div>

        <div className={isNazra ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-3 gap-4'}>
          {(isNazra ? (['sabaq'] as PartType[]) : (['sabaq', 'sabqi', 'manzil'] as PartType[])).map(partKey => {
            const plan = todayPlan ? todayPlan[partKey] : null;
            const isSelected = effectivePart === partKey && previewParaNum === null;
            const status = plan?.status || 'pending';

            let statusBadge = (
              <span className="text-xs font-medium text-[#7A6C60] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t.status.pending}
              </span>
            );

            if (status === 'passed') {
              statusBadge = (
                <span className="text-xs font-bold text-[#1F4E3D] flex items-center gap-1 bg-[#E8F0EC] px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1F4E3D]" />
                  {t.status.passed}
                </span>
              );
            } else if (status === 'repeat') {
              statusBadge = (
                <span className="text-xs font-bold text-[#991B1B] flex items-center gap-1 bg-[#FEE2E2] px-2 py-0.5 rounded">
                  <XCircle className="w-3.5 h-3.5 text-[#991B1B]" />
                  {t.status.repeat}
                </span>
              );
            }

            const displayedSabqiRange = effectiveSabqiRange;
            const isManzilCardBlocked = partKey === 'manzil' && !hasCompletedParas;
            const isManzilCardInactive =
              partKey === 'manzil' &&
              (!hasCompletedParas || (!hasValidManzilAssignment && manzilSwitchParas.length === 0));

            return (
              <button
                key={partKey}
                type="button"
                disabled={isManzilCardInactive}
                onClick={() => {
                  if (isManzilCardInactive) return;
                  setPreviewParaNum(null);
                  setActivePart(partKey);
                  if (partKey === 'sabqi') {
                    if (displayedSabqiRange) {
                      setCurrentPage(displayedSabqiRange.start.page);
                    } else {
                      setCurrentPage(getParaPageRange(student.currentJuz || 1, activeLayout).startPage);
                    }
                  } else if (partKey === 'manzil') {
                    if (hasCustomRangeManzil && plan?.range) {
                      setCurrentPage(plan.range.start.page);
                    } else {
                      const firstManzil =
                        planManzilParas[0] ||
                        manzilState.dueParas[0] ||
                        manzilRepeatEntries[0]?.[0] ||
                        null;
                      if (firstManzil) {
                        setManzilLeadPara(firstManzil);
                        setSelectedManzilPara(firstManzil);
                        setCurrentPage(getParaPageRange(firstManzil, activeLayout).startPage);
                      }
                    }
                  } else if (plan?.range) {
                    setCurrentPage(plan.range.start.page);
                  } else {
                    setCurrentPage(getParaPageRange(student.currentJuz || 1, activeLayout).startPage);
                  }
                }}
                className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between relative overflow-hidden ${
                  isManzilCardInactive
                    ? 'bg-[#F8F4EC]/70 border-[#E8DCC4] cursor-default opacity-90'
                    : isSelected
                    ? 'bg-[#FDFCF9] border-[#C5A059] ring-2 ring-[#C5A059]/40 shadow-md cursor-pointer'
                    : 'bg-[#FCFAF6] border-[#E8DCC4] hover:border-[#C5A059]/60 shadow-xs cursor-pointer'
                }`}
              >
                {isSelected && !isManzilCardInactive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#C5A059]" />
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-bold text-[#241811] flex items-center gap-1.5">
                      {partKey === 'sabaq' && <Sparkles className="w-4 h-4 text-[#C5A059]" />}
                      {partKey === 'sabqi' && <Layers className="w-4 h-4 text-[#8F6E2B]" />}
                      {partKey === 'manzil' && <BookmarkCheck className="w-4 h-4 text-[#1F4E3D]" />}
                      <span>{t.parts[partKey]}</span>
                    </span>
                    {!isManzilCardBlocked && !(partKey === 'manzil' && !hasValidManzilAssignment) && statusBadge}
                  </div>

                  <div className="text-xs text-[#7A6C60] mb-3">
                    {t.parts[`${partKey}Desc` as keyof typeof t.parts]}
                  </div>

                  {plan ? (
                    <div className="space-y-2">
                      {/* SABAQ */}
                      {partKey === 'sabaq' &&
                        (plan.range ? (
                          <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1.5">
                            <div className="flex items-center justify-between font-semibold text-[#241811]">
                              <span>
                                Surah: <strong>{plan.range.surahName || plan.surahName || 'Al-Baqarah'}</strong>
                              </span>
                              <span className="text-[#1F4E3D] font-bold bg-[#E8F0EC] px-2 py-0.5 rounded">
                                Para {plan.range.juzNumber || plan.juzNumber || 1}
                              </span>
                            </div>

                            {(plan.range.startAyah || plan.startAyah) && (
                              <div className="text-xs font-mono text-[#1F4E3D] bg-[#EBF3EE] px-2 py-0.5 rounded font-bold inline-block">
                                {(plan.range.startAyah || plan.startAyah) ===
                                (plan.range.endAyah || plan.endAyah)
                                  ? `Ayah ${plan.range.startAyah || plan.startAyah}`
                                  : `Ayat ${plan.range.startAyah || plan.startAyah} – ${plan.range.endAyah || plan.endAyah}`}
                              </div>
                            )}

                            <div className="text-[#42362E] font-mono text-[11px] pt-1.5 border-t border-[#DFCFA8]">
                              <div>
                                Pages: <strong>{plan.range.startPage || plan.range.start.page}</strong>{' '}
                                {plan.range.start.page !== plan.range.end.page
                                  ? `to ${plan.range.endPage || plan.range.end.page}`
                                  : ''}
                              </div>
                              <div className="text-[#1F4E3D] font-bold mt-0.5">
                                Start: Line {plan.range.startLine || plan.range.start.line} · End: Line{' '}
                                {plan.range.endLine || plan.range.end.line}
                              </div>
                              <div className="text-[#7A6C60] text-[10px] mt-0.5">
                                Exact Length: <strong>{plan.range.linesCount} lines assigned</strong>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs text-[#78350F] font-semibold">
                            {t.sabaqNotAssignedYet}
                          </div>
                        ))}

                      {/* SABQI */}
                      {partKey === 'sabqi' && (
                        <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1.5">
                          {displayedSabqiRange ? (
                            <>
                              <div className="font-semibold text-[#241811]">
                                Current Para {student.currentJuz}:{' '}
                                <strong className="text-[#8F6E2B]">
                                  {plan.sabqiCustomOverride
                                    ? plan.portionLabel
                                    : `${currentParaSabqi?.passedCount || 0} Passed Sabaq(s)`}
                                </strong>
                              </div>
                              <div className="text-[#42362E] font-mono text-[11px] pt-1 border-t border-[#DFCFA8]">
                                Page {displayedSabqiRange.start.page} line{' '}
                                {displayedSabqiRange.start.line} to Page{' '}
                                {displayedSabqiRange.end.page} line {displayedSabqiRange.end.line} (
                                {displayedSabqiRange.linesCount} lines)
                              </div>
                            </>
                          ) : (
                            <div className="text-[11px] text-[#B45309] font-medium">
                              {t.noPassedSabqiYet}
                            </div>
                          )}
                        </div>
                      )}

                      {/* MANZIL */}
                      {partKey === 'manzil' && (
                        !hasCompletedParas ? (
                          <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs text-[#7A6C60] font-semibold">
                            {t.noCompletedParasYet}
                          </div>
                        ) : hasValidManzilAssignment ? (
                          <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-[#7A6C60]">
                              <span>Total Completed:</span>
                              <span className="font-bold text-[#241811]">
                                {completedParasList.length} Paras
                              </span>
                            </div>

                            <div className="pt-1.5 border-t border-[#DFCFA8]">
                              <div className="text-[10px] text-[#7A6C60] uppercase tracking-wide font-semibold">
                                {status === 'passed'
                                  ? `${t.status.passed}: ${activeDate}`
                                  : status === 'repeat'
                                  ? `${t.repeatPrefix}: ${activeDate}`
                                  : `${t.manzilDuePrefix}: ${activeDate}`}
                              </div>
                              <div className="text-sm font-bold text-[#1F4E3D] mt-0.5">
                                {planManzilParas.length > 0 && isWholeParaManzilPlan(plan)
                                  ? `Para ${planManzilParas.join(', ')}`
                                  : plan.range
                                  ? `Para ${planManzilParas.join(', ')} (Pages ${plan.range.start.page} - ${plan.range.end.page})`
                                  : 'Not assigned'}
                              </div>
                            </div>

                            {plan.paraResults && Object.keys(plan.paraResults).length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {Object.entries(plan.paraResults)
                                  .filter(([pKey]) => completedParasList.includes(parseInt(pKey, 10)))
                                  .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
                                  .map(([pKey, outcome]) => (
                                    <span
                                      key={pKey}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
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

                            {plan.range && (
                              <div className="text-[11px] font-mono text-[#5A4333]">
                                {planManzilParas.length > 1 && isWholeParaManzilPlan(plan) ? (
                                  <>
                                    {planManzilParas.length} Paras ({plan.range.linesCount} lines)
                                  </>
                                ) : (
                                  <>
                                    Pages {plan.range.start.page} - {plan.range.end.page} (
                                    {plan.range.linesCount} lines)
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-[#7A6C60]">
                              <span>Total Completed:</span>
                              <span className="font-bold text-[#241811]">
                                {completedParasList.length} Paras
                              </span>
                            </div>
                            <div className="text-[#7A6C60] italic">
                              No Manzil assigned yet
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : partKey === 'sabaq' ? (
                    <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs text-[#78350F] font-semibold">
                      {t.sabaqNotAssignedYet}
                    </div>
                  ) : partKey === 'manzil' && !hasCompletedParas ? (
                    <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs text-[#7A6C60] font-semibold">
                      {t.noCompletedParasYet}
                    </div>
                  ) : (
                    <div className="text-xs text-[#A69888] italic">No assignment set</div>
                  )}
                </div>

                {!isManzilCardInactive && (
                  <div className="mt-4 pt-2.5 border-t border-[#DFCFA8] flex items-center justify-between text-xs text-[#8F6E2B] font-bold">
                    <span>{isSelected ? 'Currently Viewing on Mushaf' : 'Tap to Open on Mushaf'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 30-Para Compact Chip Grid (Expanded by default on Student Portal) */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] shadow-xs">
        <button
          type="button"
          aria-expanded={isStudentParaGridExpanded}
          onClick={() => setIsStudentParaGridExpanded(prev => !prev)}
          className="w-full px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-[#F8F4EC]/70 transition-colors rounded-2xl min-h-[40px]"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <span className="text-sm font-bold text-[#241811] flex items-center gap-2 tabular-nums">
              <Grid className={`w-4 h-4 shrink-0 ${isNazra ? 'text-[#16365D]' : 'text-[#1F4E3D]'}`} />
              <span>
                {isNazra ? t.parasReadInNazra : t.myCompletedParasTitle}{' '}
                <span className={isNazra ? 'text-[#16365D]' : 'text-[#1F4E3D]'}>
                  {displayedParasCount} / 30
                </span>
              </span>
            </span>

            <span
              aria-hidden="true"
              className="w-20 sm:w-28 h-1.5 rounded-full bg-[#E5DEC9] overflow-hidden inline-block shrink-0"
            >
              <span
                className={`block h-full rounded-full transition-all ${
                  isNazra ? 'bg-[#16365D]' : 'bg-[#1F4E3D]'
                }`}
                style={{ width: `${Math.min(100, Math.round((displayedParasCount / 30) * 100))}%` }}
              />
            </span>

            {!isNazra && (manzilState.dueParas.length > 0 || manzilRepeatEntries.length > 0) && (
              <span className="text-xs font-bold text-[#92400E] tabular-nums">
                {[
                  manzilState.dueParas.length > 0
                    ? state.language === 'ur'
                      ? `${manzilState.dueParas.length} ${t.manzilDuePrefix}`
                      : `${manzilState.dueParas.length} Manzil due`
                    : '',
                  manzilRepeatEntries.length > 0
                    ? state.language === 'ur'
                      ? `${manzilRepeatEntries.length} ${t.repeatPrefix}`
                      : `${manzilRepeatEntries.length} Repeat`
                    : '',
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            )}
          </div>

          <span className="text-[#7A6C60] shrink-0 flex items-center">
            {isStudentParaGridExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </button>

        {isStudentParaGridExpanded && (
          <div className="px-3.5 sm:px-4 pb-3.5 pt-2 border-t border-[#E8DCC4]/70 space-y-2">
            {!isNazra && (manzilState.dueParas.length > 0 || manzilRepeatEntries.length > 0) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                {manzilState.dueParas.length > 0 && (
                  <span className="font-bold text-[#92400E]">
                    {t.manzilDuePrefix}: {activeDate} — Para {manzilState.dueParas.join(', ')}
                  </span>
                )}
                {manzilRepeatEntries.length > 0 && (
                  <span className="font-bold text-[#991B1B]">
                    {t.repeatPrefix}:{' '}
                    {manzilRepeatEntries.map(([p, dt]) => `Para ${p} (${dt})`).join(', ')}
                  </span>
                )}
              </div>
            )}

            <ParaProgressGrid
              completedParas={
                isNazra ? student.nazraCompletedParas || [] : student.completedParas || []
              }
              currentJuz={student.currentJuz}
              manzilAssignedParas={manzilState.dueParas}
              manzilRepeatParas={manzilState.repeatParas}
              currentDate={activeDate}
              language={state.language}
              manzilDuePrefix={t.manzilDuePrefix}
              repeatPrefix={t.repeatPrefix}
              previewParaNum={previewParaNum ?? activeManzilPara}
              onTapPara={handleTapParaTile}
              isNazra={isNazra}
              mushafLayout={activeLayout}
              compact
            />
          </div>
        )}
      </div>

      {/* 2. Practice Toolbar: Repeat Counter & Hide-and-Reveal Mode */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPastDate || (previewParaNum === null && !activePlanRange)}
              onClick={handleIncrementRepeat}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] text-sm font-bold shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[46px] border border-[#C5A059]"
            >
              <Plus className="w-5 h-5 text-[#C5A059]" />
              <span>{t.practiceIncrement}</span>
            </button>

            <button
              type="button"
              disabled={isPastDate || (previewParaNum === null && !activePlanRange)}
              onClick={handleResetRepeat}
              className="p-2.5 rounded-xl border border-[#DFCFA8] text-[#7A6C60] hover:text-[#241811] hover:bg-[#F3ECE1] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[46px]"
              title={t.resetCounter}
            >
              <RotateCcw className="w-4 h-4 text-[#8F6E2B]" />
            </button>
          </div>

          <div className="text-xs">
            <div className="font-mono text-base font-bold text-[#241811]">
              {repeatCount}{' '}
              <span className="text-[#7A6C60] text-xs font-normal">/ {targetRepeats} target</span>
            </div>
            <div className="text-[#7A6C60] text-[11px]">
              {t.practiceCounter} for {t.parts[effectivePart]}
              {isPastDate && (
                <span className="ml-1.5 text-[#8F6E2B] font-semibold">
                  ({state.language === 'ur' ? 'صرف مطالعہ' : 'Read-only'})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHideAndRevealActive(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
              hideAndRevealActive
                ? 'bg-[#C5A059] text-[#241811] shadow-xs ring-2 ring-[#DFCFA8]'
                : 'bg-[#F8F4EC] hover:bg-[#F3ECE1] text-[#241811] border border-[#DFCFA8]'
            }`}
          >
            {hideAndRevealActive ? (
              <EyeOff className="w-4 h-4 text-[#241811]" />
            ) : (
              <Eye className="w-4 h-4 text-[#8F6E2B]" />
            )}
            <span>{hideAndRevealActive ? 'Hide Mode Active' : t.hideAndRevealTitle}</span>
          </button>
        </div>
      </div>

      {hideAndRevealActive && (
        <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-xl p-3 text-xs text-[#92400E] flex items-center gap-2 shadow-2xs">
          <Info className="w-4 h-4 text-[#B45309] shrink-0" />
          <span>{t.hideRevealHelp}</span>
        </div>
      )}

      {/* 3. Interactive Mushaf Viewer */}
      <div className="flex flex-col items-center gap-2 w-full">
        {previewParaNum !== null ? (
          <div className="w-full max-w-4xl bg-[#1F4E3D] text-[#FCFAF6] border-2 border-[#C5A059] px-4 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider bg-[#C5A059] text-[#241811] px-2 py-0.5 rounded text-[10px]">
                Para {previewParaNum}
              </span>
              <span>
                Viewing Para {previewParaNum} ({getParaSurahName(previewParaNum)}) from {isNazra ? t.parasReadInNazra : 'Completed Paras'} grid.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPreviewParaNum(null);
                if (currentPartPlan?.range) setCurrentPage(currentPartPlan.range.start.page);
              }}
              className="underline font-bold text-[#DFCFA8] hover:text-white cursor-pointer"
            >
              Return to Today's {t.parts[effectivePart]}
            </button>
          </div>
        ) : (
          (currentPartPlan || effectivePart === 'sabaq') && (
            <div className="w-full max-w-4xl bg-[#241811] text-[#FCFAF6] border-2 border-[#C5A059] px-4 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider bg-[#C5A059] text-[#241811] px-2 py-0.5 rounded text-[10px]">
                  {t.parts[effectivePart]}
                </span>
                <span>
                  {effectivePart === 'sabaq' &&
                    (currentPartPlan?.range ? (
                      <>
                        {t.showingAssignedOnly}:{' '}
                        <strong>{currentPartPlan.range.surahName || 'Al-Baqarah'}</strong>, Para{' '}
                        {currentPartPlan.range.juzNumber || 1}, Page{' '}
                        {currentPartPlan.range.startPage || currentPartPlan.range.start.page} (Line{' '}
                        {currentPartPlan.range.startLine || currentPartPlan.range.start.line}) to Page{' '}
                        {currentPartPlan.range.endPage || currentPartPlan.range.end.page} (Line{' '}
                        {currentPartPlan.range.endLine || currentPartPlan.range.end.line}).
                      </>
                    ) : (
                      <>{t.sabaqNotAssignedYet} — wait for your Ustaad to assign today's Sabaq.</>
                    ))}
                  {effectivePart === 'sabqi' &&
                    (effectiveSabqiRange ? (
                      <>
                        My Sabqi (Para {student.currentJuz} passed Sabaqs): Page{' '}
                        {effectiveSabqiRange.start.page} line {effectiveSabqiRange.start.line} to Page{' '}
                        {effectiveSabqiRange.end.page} line {effectiveSabqiRange.end.line} (
                        {effectiveSabqiRange.linesCount} lines).
                      </>
                    ) : (
                      <>{t.noPassedSabqiYet}</>
                    ))}
                  {effectivePart === 'manzil' &&
                    (!hasCompletedParas ? (
                      <>{t.noCompletedParasYet}.</>
                    ) : hasCustomRangeManzil && currentPartPlan?.range ? (
                      <>
                        {t.manzilDuePrefix} ({activeDate}):{' '}
                        <strong>Para {planManzilParas.join(', ')}</strong>{' '}
                        (Page {currentPartPlan.range.start.page} L{currentPartPlan.range.start.line} – Page{' '}
                        {currentPartPlan.range.end.page} L{currentPartPlan.range.end.line}).
                      </>
                    ) : manzilSwitchParas.length > 0 ? (
                      <>
                        {t.manzilDuePrefix} ({activeDate}):{' '}
                        <strong>
                          Para {manzilSwitchParas.join(', ')}
                        </strong>{' '}
                        {activeManzilPara &&
                          `(Viewing Para ${activeManzilPara} · Pages ${getParaPageRange(activeManzilPara, activeLayout).startPage}–${getParaPageRange(activeManzilPara, activeLayout).endPage})`}
                      </>
                    ) : (
                      <>No Manzil assigned yet.</>
                    ))}
                </span>
              </div>
              {activePlanRange && (
                <span className="text-[#DFCFA8] text-[11px] font-mono">
                  {activePlanRange.linesCount} {t.linesCount}
                </span>
              )}
            </div>
          )
        )}

        {/* Manzil Multi-Para Switcher Bar (ordered with tapped para first) */}
        {previewParaNum === null &&
          effectivePart === 'manzil' &&
          hasCompletedParas &&
          !hasCustomRangeManzil &&
          manzilSwitchParas.length > 0 && (
            <div className="w-full max-w-4xl bg-[#F8F4EC] border border-[#C5A059] px-3 sm:px-4 py-2 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-[#241811] mr-1">
                  {state.language === 'ur' ? 'منزل کے پارے تبدیل کریں:' : 'Switch Manzil Para:'}
                </span>
                {manzilSwitchParas.map(pNum => {
                  const isCurrentSelected = activeManzilPara === pNum;
                  const pRange = getParaPageRange(pNum, activeLayout);
                  const isDue = manzilState.dueParas.includes(pNum);
                  const repDate = manzilState.repeatParas[pNum];
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => handleSwitchManzilPara(pNum)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        isCurrentSelected
                          ? 'bg-[#1F4E3D] text-white border-[#C5A059] shadow-xs ring-1 ring-[#C5A059]'
                          : repDate
                          ? 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]/50 hover:bg-[#FECACA]'
                          : isDue
                          ? 'bg-[#FEF3C7] text-[#78350F] border-[#D97706]/60 hover:bg-[#FDE68A]'
                          : 'bg-white text-[#241811] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                      }`}
                    >
                      <span>{state.language === 'ur' ? `پارہ ${pNum}` : `Para ${pNum}`}</span>
                      <span className="font-mono text-[10px] opacity-85">P{pRange.startPage}</span>
                      {repDate && !isDue && (
                        <span className="px-1 rounded bg-[#B91C1C] text-white text-[9px] font-extrabold">
                          {t.repeatPrefix}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {activeManzilPara && (
                <span className="text-[11px] text-[#5A4333] font-medium">
                  {getParaSurahName(activeManzilPara)}
                </span>
              )}
            </div>
          )}

        <MushafViewer
          pageNumber={currentPage}
          onPageChange={setCurrentPage}
          highlightRange={mushafHighlightRange || undefined}
          highlightRanges={undefined}
          activeParaNumber={
            previewParaNum !== null
              ? previewParaNum
              : effectivePart === 'manzil' && activeManzilPara
              ? activeManzilPara
              : undefined
          }
          manzilHeaderPara={manzilHeaderParaBadge}
          interactiveMode="view"
          currentMarks={activePartMarks}
          hideAndRevealActive={hideAndRevealActive}
          targetPulseWordId={pulsingWordId}
          language={state.language}
          mushafLayout={activeLayout}
          onLayoutChange={l => handleUpdateMushafSettings({ mushafLayout: l })}
          mushafScript={state.settings.mushafScript || 'indopak'}
          onScriptChange={s => handleUpdateMushafSettings({ mushafScript: s })}
          highContrast={Boolean(state.settings.highContrastMushaf)}
          onToggleHighContrast={() =>
            handleUpdateMushafSettings({ highContrastMushaf: !state.settings.highContrastMushaf })
          }
        />
      </div>

      {/* 4. Assessment Result Card */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#241811] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#8F6E2B]" />
            <span>
              {isPastDate
                ? state.language === 'ur'
                  ? `نتائج (${activeDate})`
                  : `Assessment Results (${activeDate})`
                : t.resultCardTitle}
            </span>
          </h3>
          <span className="text-xs text-[#7A6C60] font-mono">{activeDate}</span>
        </div>

        {todayResults.length === 0 ? (
          <div className="p-4 bg-[#F8F4EC] rounded-xl border border-[#DFCFA8] text-xs text-[#7A6C60] text-center">
            {t.noResultsYet}
          </div>
        ) : (
          <div className="space-y-4">
            {todayResults.map(result => {
              const isPassed = result.finalResult === 'passed';
              return (
                <div
                  key={result.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPassed
                      ? 'bg-[#EBF3EE] border-[#2E6A54]'
                      : 'bg-[#FDF2F2] border-[#B91C1C]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#241811] capitalize">
                        {t.parts[result.part]} (
                        {t.parts[`${result.part}Desc` as keyof typeof t.parts]})
                      </span>
                      {result.isOverridden && (
                        <span className="text-[10px] bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] px-1.5 py-0.5 rounded font-medium">
                          {t.overriddenBadge}
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                        isPassed ? 'bg-[#1F4E3D] text-white' : 'bg-[#B91C1C] text-white'
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span>{isPassed ? t.status.passed : t.status.repeat}</span>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-[#241811] mb-3 flex items-center gap-4">
                    <span>
                      {t.ghaltiShort}: <strong>{result.ghaltiCount}</strong> (limit{' '}
                      {result.ghaltiLimit})
                    </span>
                    <span className="text-[#C5A059]">·</span>
                    <span>
                      {t.atkanShort}: <strong>{result.atkanCount}</strong> (limit{' '}
                      {result.atkanLimit})
                    </span>
                  </div>

                  {result.part === 'manzil' &&
                    result.paraResults &&
                    Object.keys(result.paraResults).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Object.entries(result.paraResults)
                          .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
                          .map(([pKey, outcome]) => (
                            <span
                              key={pKey}
                              className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                                outcome === 'passed'
                                  ? 'bg-[#1F4E3D] text-white border-[#143429]'
                                  : 'bg-[#B91C1C] text-white border-[#7F1D1D]'
                              }`}
                            >
                              {state.language === 'ur' ? `پارہ ${pKey}` : `Para ${pKey}`}:{' '}
                              {outcome === 'passed'
                                ? state.language === 'ur'
                                  ? 'پاس'
                                  : 'Pass'
                                : t.repeatPrefix}
                            </span>
                          ))}
                      </div>
                    )}

                  {result.marks.length > 0 ? (
                    <div>
                      <div className="text-[11px] font-semibold text-[#5A4333] uppercase mb-1.5">
                        Marked Mistakes (tap to jump to page and inspect):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.marks.map(mark => (
                          <button
                            key={mark.id}
                            type="button"
                            onClick={() => handleJumpToMistake(mark.page, mark.wordId)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs border font-mono flex items-center gap-1.5 cursor-pointer hover:shadow-xs transition-all ${
                              mark.type === 'ghalti'
                                ? 'bg-rose-100 border-rose-300 text-rose-950 hover:bg-rose-200'
                                : 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200'
                            }`}
                          >
                            <span className="font-bold">
                              {mark.type === 'ghalti' ? t.ghaltiShort : t.atkanShort}
                            </span>
                            <span>
                              P{mark.page} : L{mark.line} : W{mark.wordIndex}
                            </span>
                            <ArrowRight className="w-3 h-3 text-[#5A4333]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#1F4E3D] font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>No mistakes recorded! Excellent recitation.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Student Historical Lessons & Mistakes Modal */}
      {showHistoryModal && (
        <StudentHistoryModal
          state={state}
          student={student}
          onClose={() => setShowHistoryModal(false)}
          onJumpToWord={(page, wordId) => handleJumpToMistake(page, wordId)}
        />
      )}
    </div>
  );
};
