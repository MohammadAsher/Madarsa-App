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
  getFullParaRange,
  getManzilParaRanges,
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

  // Optional Para tile preview when student taps a tile in "My Completed Paras"
  const [previewParaNum, setPreviewParaNum] = useState<number | null>(null);

  const currentParaSabqi = isNazra ? null : computeCurrentParaSabqiRange(student, state, activeDate);

  // Effective Sabqi range respects Ustaad manual narrowing override if present; otherwise all passed Sabaqs in current Para
  const effectiveSabqiRange: AssignmentRange | null = isNazra
    ? null
    : todayPlan?.sabqi?.sabqiCustomOverride && todayPlan.sabqi.range
    ? todayPlan.sabqi.range
    : currentParaSabqi?.range || null;

  const activeRange: AssignmentRange | null =
    previewParaNum !== null
      ? getFullParaRange(previewParaNum)
      : effectivePart === 'sabqi'
      ? effectiveSabqiRange
      : todayPlan?.[effectivePart]?.range || null;

  const [currentPage, setCurrentPage] = useState<number>(
    targetJumpWord?.page || activeRange?.start.page || 1
  );

  // Keep page synced when switching student roles or dates
  useEffect(() => {
    if (targetJumpWord) {
      setCurrentPage(targetJumpWord.page);
      return;
    }
    setPreviewParaNum(null);
    const defaultPlan = state.dailyPlans[student.id]?.[activeDate];
    const startPage = defaultPlan?.[effectivePart]?.range?.start.page;
    if (startPage) {
      setCurrentPage(startPage);
    } else if (isNazra) {
      setCurrentPage(getParaPageRange(student.currentJuz || 1).startPage);
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
    }
  };

  const handleTapParaTile = (paraNum: number) => {
    const manzilParas = !isNazra ? todayPlan?.manzil?.assignedParas || [] : [];
    if (!isNazra && manzilParas.includes(paraNum) && todayPlan?.manzil?.range) {
      setPreviewParaNum(null);
      setActivePart('manzil');
      const { startPage } = getParaPageRange(paraNum);
      setCurrentPage(startPage);
    } else {
      setPreviewParaNum(paraNum);
      const { startPage } = getParaPageRange(paraNum);
      setCurrentPage(startPage);
    }
  };

  const currentPartPlan = todayPlan ? todayPlan[effectivePart] : null;

  const handleIncrementRepeat = () => {
    if (isPastDate || !currentPartPlan || !activeRange) return;
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
    if (isPastDate || !currentPartPlan || !activeRange) return;
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
  const manzilAssignedParas = isNazra ? [] : todayPlan?.manzil?.assignedParas || [];
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

      {/* Sabaq Frozen Notice Banner (Hifz only) */}
      {!isNazra && todayPlan?.sabaqFrozenDueToRevisionFail && (
        <div className="bg-[#FEF3C7] border-2 border-[#D97706] rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#78350F]">{t.sabaqFrozenAlert}</h4>
            <p className="text-xs text-[#92400E] mt-0.5">
              Focus today on perfecting your Sabqi and Manzil revision before advancing with new lines.
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

            return (
              <button
                key={partKey}
                type="button"
                onClick={() => {
                  setPreviewParaNum(null);
                  setActivePart(partKey);
                  if (partKey === 'sabqi' && displayedSabqiRange) {
                    setCurrentPage(displayedSabqiRange.start.page);
                  } else if (plan?.range) {
                    setCurrentPage(plan.range.start.page);
                  } else if (partKey === 'sabaq') {
                    setCurrentPage(getParaPageRange(student.currentJuz || 1).startPage);
                  }
                }}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#FDFCF9] border-[#C5A059] ring-2 ring-[#C5A059]/40 shadow-md'
                    : 'bg-[#FCFAF6] border-[#E8DCC4] hover:border-[#C5A059]/60 shadow-xs'
                }`}
              >
                {isSelected && (
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
                    {statusBadge}
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
                        <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-[#7A6C60]">
                            <span>Total Completed:</span>
                            <span className="font-bold text-[#241811]">
                              {student.completedParas?.length || 0} Paras
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-[#DFCFA8]">
                            <div className="text-[10px] text-[#7A6C60] uppercase tracking-wide font-semibold">
                              {t.manzilDuePrefix}: {activeDate}
                            </div>
                            <div className="text-sm font-bold text-[#1F4E3D] mt-0.5">
                              {plan.assignedParas && plan.assignedParas.length > 0
                                ? `Para ${plan.assignedParas.join(', ')}`
                                : student.completedParas.length === 0
                                ? 'None (0 Paras completed yet)'
                                : plan.range
                                ? `Pages ${plan.range.start.page} - ${plan.range.end.page}`
                                : 'Not assigned'}
                            </div>
                          </div>

                          {plan.range && (
                            <div className="text-[11px] font-mono text-[#5A4333]">
                              {plan.assignedParas && plan.assignedParas.length > 1 ? (
                                <>
                                  {plan.assignedParas.length} Paras ({plan.range.linesCount} lines)
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
                      )}
                    </div>
                  ) : partKey === 'sabaq' ? (
                    <div className="bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl p-3 text-xs text-[#78350F] font-semibold">
                      {t.sabaqNotAssignedYet}
                    </div>
                  ) : (
                    <div className="text-xs text-[#A69888] italic">No assignment set</div>
                  )}
                </div>

                <div className="mt-4 pt-2.5 border-t border-[#DFCFA8] flex items-center justify-between text-xs text-[#8F6E2B] font-bold">
                  <span>{isSelected ? 'Currently Viewing on Mushaf' : 'Tap to Open on Mushaf'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Requirement D: 30-Tile Para Grid */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-3.5 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#241811] flex items-center gap-2">
              <Grid className={`w-4 h-4 ${isNazra ? 'text-[#16365D]' : 'text-[#1F4E3D]'}`} />
              <span>{isNazra ? t.parasReadInNazra : t.myCompletedParasTitle}</span>
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                  isNazra ? 'bg-[#E8EEF6] text-[#16365D]' : 'bg-[#E8F0EC] text-[#1F4E3D]'
                }`}
              >
                {displayedParasCount} / 30
              </span>
            </h2>
            <p className="text-xs text-[#7A6C60] mt-0.5">
              {isNazra
                ? state.language === 'ur'
                  ? '۳۰ پارے · ناظرہ میں پڑھے گئے پارے نیلے رنگ میں ہیں۔ مصحف میں کھولنے کے لیے کلک کریں۔'
                  : 'All 30 Paras · Paras read in Nazra are filled in blue. Tap any Para to open it in the Mushaf.'
                : t.myCompletedParasHelp}
            </p>
          </div>

          {!isNazra && manzilAssignedParas.length > 0 && (
            <div className="px-3 py-1 rounded-lg bg-[#FEF3C7] border border-[#D97706] text-[#78350F] text-xs font-bold">
              {t.manzilDuePrefix}: {activeDate} — Para {manzilAssignedParas.join(', ')}
            </div>
          )}
        </div>

        <ParaProgressGrid
          completedParas={isNazra ? student.nazraCompletedParas || [] : student.completedParas || []}
          currentJuz={student.currentJuz}
          manzilAssignedParas={isNazra ? [] : manzilAssignedParas}
          currentDate={activeDate}
          language={state.language}
          manzilDuePrefix={t.manzilDuePrefix}
          previewParaNum={previewParaNum}
          onTapPara={handleTapParaTile}
          isNazra={isNazra}
        />
      </div>

      {/* 2. Practice Toolbar: Repeat Counter & Hide-and-Reveal Mode */}
      <div className="bg-[#FCFAF6] rounded-2xl border border-[#E8DCC4] p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPastDate || (previewParaNum === null && !activeRange)}
              onClick={handleIncrementRepeat}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] text-sm font-bold shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[46px] border border-[#C5A059]"
            >
              <Plus className="w-5 h-5 text-[#C5A059]" />
              <span>{t.practiceIncrement}</span>
            </button>

            <button
              type="button"
              disabled={isPastDate || (previewParaNum === null && !activeRange)}
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
                    (currentPartPlan?.range ? (
                      <>
                        {t.manzilDuePrefix} ({activeDate}):{' '}
                        <strong>
                          Para{' '}
                          {currentPartPlan.assignedParas && currentPartPlan.assignedParas.length > 0
                            ? currentPartPlan.assignedParas.join(', ')
                            : currentPartPlan.range.juzNumber}
                        </strong>{' '}
                        {currentPartPlan.assignedParas && currentPartPlan.assignedParas.length > 1
                          ? `(${currentPartPlan.assignedParas.length} Paras selected).`
                          : `(Pages ${currentPartPlan.range.start.page} - ${currentPartPlan.range.end.page}).`}
                      </>
                    ) : (
                      <>No Manzil assigned yet.</>
                    ))}
                </span>
              </div>
              {activeRange && (
                <span className="text-[#DFCFA8] text-[11px] font-mono">
                  {activeRange.linesCount} {t.linesCount}
                </span>
              )}
            </div>
          )
        )}

        <MushafViewer
          pageNumber={currentPage}
          onPageChange={setCurrentPage}
          highlightRange={activeRange || undefined}
          highlightRanges={
            previewParaNum === null &&
            effectivePart === 'manzil' &&
            currentPartPlan?.assignedParas &&
            currentPartPlan.assignedParas.length > 0
              ? getManzilParaRanges(currentPartPlan.assignedParas, currentPartPlan.range)
              : undefined
          }
          interactiveMode="view"
          currentMarks={activePartMarks}
          hideAndRevealActive={hideAndRevealActive}
          targetPulseWordId={pulsingWordId}
          language={state.language}
          mushafLayout={student.mushafLayout || state.settings.mushafLayout || 'madinah'}
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
