/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  Users,
  BookOpen,
  Check,
  Layers,
  BookmarkCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  MadrasaState,
  StudentProfile,
  PartType,
  AssignmentRange,
} from '../types/hifz';
import { MushafViewer } from './MushafViewer';
import { StudentTypeBadge } from './StudentTypeBadge';
import {
  MushafWord,
  WordLocation,
  getRangeMetadata,
  getParaPageRange,
  getParaSurahName,
  getFirstWordOnOrAfter,
  getLastWordOnOrBefore,
} from '../data/quranData';
import {
  buildManzilCombinedRange,
  computeCurrentParaSabqiRange,
  computeManzilParaStates,
  getFullParaRange,
  getLatestUnpassedRepeatSabaq,
  getManzilParasFromPlan,
  getNewSabaqPauseStatus,
  getValidatedManzilParasForStudent,
  isWholeParaManzilPlan,
} from '../services/hifzService';
import { translations } from '../i18n/translations';

interface AssignWorkModalProps {
  state: MadrasaState;
  student: StudentProfile;
  initialPart?: PartType;
  initialParaNum?: number;
  targetDate?: string;
  onClose: () => void;
  onSave: (
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
  ) => void;
  onUpdateMushafSettings?: (patch: {
    mushafLayout?: 'hafizi' | 'madinah';
    mushafScript?: 'indopak' | 'uthmani';
    highContrastMushaf?: boolean;
  }) => void;
}

export const AssignWorkModal: React.FC<AssignWorkModalProps> = ({
  state,
  student,
  initialPart = 'sabaq',
  initialParaNum,
  targetDate,
  onClose,
  onSave,
  onUpdateMushafSettings,
}) => {
  const isNazra = student.studentType === 'nazra';
  const [selectedPart, setSelectedPart] = useState<PartType>(isNazra ? 'sabaq' : initialPart);
  const effectivePart: PartType = isNazra ? 'sabaq' : selectedPart;
  const activeLayout = student.mushafLayout || state.settings.mushafLayout || 'madinah';
  const t = translations[state.language];
  const activeDate = targetDate || state.currentDate;

  const todayPlan = state.dailyPlans[student.id]?.[activeDate];
  const currentPlan = todayPlan?.[effectivePart];
  const currentRange = currentPlan?.range || null;

  const pauseStatus = getNewSabaqPauseStatus(student, state, activeDate);
  const isSabaqBlocked = effectivePart === 'sabaq' && pauseStatus.isPaused;
  const priorRepeatSabaq =
    !isSabaqBlocked && !todayPlan?.sabaq?.range
      ? getLatestUnpassedRepeatSabaq(student, state, activeDate)
      : null;

  const initialSabaqRange =
    effectivePart === 'sabaq'
      ? currentRange || priorRepeatSabaq?.range || null
      : currentRange;

  const currentParaSabqi = computeCurrentParaSabqiRange(student, state, activeDate);

  // Manzil strictly allows ONLY completed paras (no auto-default and no uncompleted-para selection)
  const studentCompletedParas = React.useMemo(
    () =>
      Array.from(new Set(student.completedParas || []))
        .filter(p => p >= 1 && p <= 30)
        .sort((a, b) => a - b),
    [student.completedParas]
  );
  const completedSet = React.useMemo(
    () => new Set(studentCompletedParas),
    [studentCompletedParas]
  );
  const hasCompletedParas = studentCompletedParas.length > 0;

  const manzilState = isNazra
    ? { dueParas: [], repeatParas: {} }
    : computeManzilParaStates(student, state, activeDate);
  const repeatParaNums = Object.keys(manzilState.repeatParas)
    .map(k => parseInt(k, 10))
    .filter(n => !Number.isNaN(n) && completedSet.has(n))
    .sort((a, b) => a - b);

  const validSavedManzilParas =
    !isNazra && todayPlan?.manzil
      ? getValidatedManzilParasForStudent(student, todayPlan.manzil)
      : [];
  const hasExistingCustomManzil =
    hasCompletedParas &&
    Boolean(todayPlan?.manzil?.range) &&
    validSavedManzilParas.length > 0 &&
    !isWholeParaManzilPlan(todayPlan?.manzil);

  const initialAssignedManzilParas =
    hasCompletedParas &&
    todayPlan?.manzil?.assignedParas &&
    todayPlan.manzil.assignedParas.length > 0
      ? validSavedManzilParas
      : [];

  const [assignedManzilParas, setAssignedManzilParas] = useState<number[]>(initialAssignedManzilParas);
  const [focusedParaNum, setFocusedParaNum] = useState<number | null>(
    initialParaNum && completedSet.has(initialParaNum)
      ? initialParaNum
      : effectivePart === 'manzil'
      ? initialAssignedManzilParas[0] || (hasCompletedParas ? studentCompletedParas[0] : null)
      : null
  );

  // Open on the exact Para start page (initialParaNum, first assigned Manzil para, Sabqi start, Sabaq start, or currentJuz)
  const defaultBrowsePage =
    initialParaNum && (effectivePart !== 'manzil' || completedSet.has(initialParaNum))
      ? getParaPageRange(initialParaNum, activeLayout).startPage
      : effectivePart === 'manzil' && hasExistingCustomManzil && todayPlan?.manzil?.range
      ? todayPlan.manzil.range.start.page
      : effectivePart === 'manzil' && initialAssignedManzilParas.length > 0
      ? getParaPageRange(initialAssignedManzilParas[0], activeLayout).startPage
      : effectivePart === 'sabqi' && (currentRange || currentParaSabqi?.range)
      ? (currentRange || currentParaSabqi!.range).start.page
      : initialSabaqRange?.start.page || getParaPageRange(student.currentJuz || 1, activeLayout).startPage;

  const [pageNumber, setPageNumber] = useState<number>(defaultBrowsePage);
  const [selectionStart, setSelectionStart] = useState<WordLocation | null>(
    effectivePart === 'manzil' && !hasExistingCustomManzil
      ? null
      : initialSabaqRange
      ? initialSabaqRange.start
      : null
  );
  const [selectionEnd, setSelectionEnd] = useState<WordLocation | null>(
    effectivePart === 'manzil' && !hasExistingCustomManzil
      ? null
      : initialSabaqRange
      ? initialSabaqRange.end
      : null
  );

  // Sabqi specific state
  const [sabqiMode, setSabqiMode] = useState<
    'current_para_passed' | 'custom' | 'quarter_para' | 'half_para' | 'full_para'
  >(currentPlan?.portionType || 'current_para_passed');
  const [sabqiTargetPara, setSabqiTargetPara] = useState<number>(
    currentPlan?.juzNumber || student.currentJuz || 1
  );

  const [showManzilCustomRange, setShowManzilCustomRange] = useState<boolean>(hasExistingCustomManzil);
  const [manzilUsingCustomRange, setManzilUsingCustomRange] = useState<boolean>(hasExistingCustomManzil);

  const [manzilChipTooltip, setManzilChipTooltip] = useState<number | null>(null);
  const chipPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipPressFiredRef = useRef<boolean>(false);
  const chipAutoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearChipTimers = () => {
    if (chipPressTimerRef.current) {
      clearTimeout(chipPressTimerRef.current);
      chipPressTimerRef.current = null;
    }
    if (chipAutoHideRef.current) {
      clearTimeout(chipAutoHideRef.current);
      chipAutoHideRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearChipTimers();
  }, []);

  // Tap handler on mushaf words: first tap sets start, second tap sets end!
  const handleWordClick = (word: MushafWord) => {
    if (isSabaqBlocked) return;
    if (selectedPart === 'manzil') {
      if (!hasCompletedParas || !showManzilCustomRange) return;
      if (!completedSet.has(word.juzNumber)) return;
    }

    const loc: WordLocation = {
      page: word.pageNumber,
      line: word.lineNumber,
      wordIndex: word.wordIndex,
      wordId: word.id,
    };

    if (selectedPart === 'sabqi') {
      setSabqiMode('custom');
    }
    if (selectedPart === 'manzil') {
      setManzilUsingCustomRange(true);
    }

    if (!selectionStart || (selectionStart && selectionEnd)) {
      setSelectionStart(loc);
      setSelectionEnd(null);
    } else {
      setSelectionEnd(loc);
    }
  };

  // Use all passed Sabaqs in the student's current Para
  const applyAllPassedCurrentParaSabqi = () => {
    setSabqiMode('current_para_passed');
    setSabqiTargetPara(student.currentJuz || 1);
    if (currentParaSabqi) {
      setSelectionStart(currentParaSabqi.range.start);
      setSelectionEnd(currentParaSabqi.range.end);
      setPageNumber(currentParaSabqi.range.start.page);
    }
  };

  // Narrowing Sabqi presets
  const applySabqiPreset = (
    preset: 'quarter_para' | 'half_para' | 'full_para',
    paraNum: number
  ) => {
    setSabqiMode(preset);
    setSabqiTargetPara(paraNum);
    const { startPage, endPage } = getParaPageRange(paraNum);

    let toPage = endPage;
    if (preset === 'quarter_para') {
      toPage = Math.min(endPage, startPage + 4);
    } else if (preset === 'half_para') {
      toPage = Math.min(endPage, startPage + 9);
    }

    const startLoc = getFirstWordOnOrAfter(startPage, 1);
    const endLoc = getLastWordOnOrBefore(toPage, 15);
    setSelectionStart(startLoc);
    setSelectionEnd(endLoc);
    setPageNumber(startPage);
  };

  // Multi-select toggle for Manzil Paras: ONLY completed paras can be toggled
  const toggleManzilPara = (paraNum: number) => {
    if (!completedSet.has(paraNum)) return;
    setShowManzilCustomRange(false);
    setManzilUsingCustomRange(false);
    setSelectionStart(null);
    setSelectionEnd(null);

    setAssignedManzilParas(prev => {
      const exists = prev.includes(paraNum);
      const next = exists
        ? prev.filter(p => p !== paraNum)
        : [...prev, paraNum].filter(p => completedSet.has(p)).sort((a, b) => a - b);

      if (!exists) {
        setFocusedParaNum(paraNum);
        setPageNumber(getParaPageRange(paraNum, activeLayout).startPage);
      } else if (next.length > 0) {
        setFocusedParaNum(next[0]);
        setPageNumber(getParaPageRange(next[0], activeLayout).startPage);
      }
      return next;
    });
  };

  const switchPartTab = (partKey: PartType) => {
    setSelectedPart(partKey);
    if (partKey === 'sabaq') {
      const existingSabaq = todayPlan?.sabaq?.range || priorRepeatSabaq?.range || null;
      if (existingSabaq) {
        setSelectionStart(existingSabaq.start);
        setSelectionEnd(existingSabaq.end);
        setPageNumber(existingSabaq.start.page);
      } else {
        setSelectionStart(null);
        setSelectionEnd(null);
        setPageNumber(getParaPageRange(student.currentJuz || 1).startPage);
      }
      return;
    }

    if (partKey === 'manzil') {
      if (hasExistingCustomManzil && todayPlan?.manzil?.range) {
        setShowManzilCustomRange(true);
        setManzilUsingCustomRange(true);
        setSelectionStart(todayPlan.manzil.range.start);
        setSelectionEnd(todayPlan.manzil.range.end);
        setFocusedParaNum(validSavedManzilParas[0] || null);
        setPageNumber(todayPlan.manzil.range.start.page);
        return;
      }
      setShowManzilCustomRange(false);
      setManzilUsingCustomRange(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      if (assignedManzilParas.length > 0) {
        setFocusedParaNum(assignedManzilParas[0]);
        setPageNumber(getParaPageRange(assignedManzilParas[0], activeLayout).startPage);
      } else if (hasCompletedParas) {
        setFocusedParaNum(studentCompletedParas[0]);
        setPageNumber(getParaPageRange(studentCompletedParas[0], activeLayout).startPage);
      } else {
        setFocusedParaNum(null);
        setPageNumber(getParaPageRange(student.currentJuz || 1, activeLayout).startPage);
      }
      return;
    }

    if (partKey === 'sabqi' && currentParaSabqi && !todayPlan?.sabqi?.sabqiCustomOverride) {
      setSabqiMode('current_para_passed');
      setSelectionStart(currentParaSabqi.range.start);
      setSelectionEnd(currentParaSabqi.range.end);
      setPageNumber(currentParaSabqi.range.start.page);
      return;
    }
    const existing = todayPlan?.[partKey]?.range;
    if (existing) {
      setSelectionStart(existing.start);
      setSelectionEnd(existing.end);
      setPageNumber(existing.start.page);
    } else {
      setSelectionStart(null);
      setSelectionEnd(null);
      setPageNumber(getParaPageRange(student.currentJuz || 1, activeLayout).startPage);
    }
  };

  const validSelectedManzilParas = assignedManzilParas.filter(p => completedSet.has(p));

  const manzilCombinedRange =
    selectedPart === 'manzil' && !manzilUsingCustomRange && hasCompletedParas
      ? buildManzilCombinedRange(validSelectedManzilParas)
      : null;

  const manzilCustomRangeError = React.useMemo(() => {
    if (selectedPart !== 'manzil' || !manzilUsingCustomRange) return null;
    if (!hasCompletedParas) {
      return t.noCompletedParasYet;
    }
    if (!selectionStart || !selectionEnd) return null;
    const parasInRange = getManzilParasFromPlan([], {
      start: selectionStart,
      end: selectionEnd,
      linesCount: 0,
      surahName: '',
      juzNumber: 1,
      startPage: selectionStart.page,
      endPage: selectionEnd.page,
      startLine: selectionStart.line,
      endLine: selectionEnd.line,
    });
    const uncompleted = parasInRange.filter(p => !completedSet.has(p));
    if (uncompleted.length > 0) {
      return state.language === 'ur'
        ? `صرف مکمل شدہ پاروں میں منزل مقرر کی جا سکتی ہے (پارہ ${uncompleted.join(', ')} مکمل نہیں ہے)۔`
        : `Manzil can only include completed paras (Para ${uncompleted.join(', ')} is not completed).`;
    }
    return null;
  }, [selectedPart, manzilUsingCustomRange, hasCompletedParas, selectionStart, selectionEnd, completedSet, state.language, t.noCompletedParasYet]);

  const hasValidRange =
    selectedPart === 'manzil'
      ? hasCompletedParas &&
        (!manzilUsingCustomRange
          ? validSelectedManzilParas.length > 0 && Boolean(manzilCombinedRange)
          : Boolean(selectionStart && selectionEnd) && !manzilCustomRangeError)
      : Boolean(selectionStart && selectionEnd);

  const metadata =
    selectedPart === 'manzil' && !manzilUsingCustomRange
      ? manzilCombinedRange
      : selectionStart && selectionEnd
      ? getRangeMetadata(selectionStart, selectionEnd)
      : null;

  const handleConfirm = (applyToAll: boolean) => {
    if (!hasValidRange || isSabaqBlocked) return;
    if (selectedPart === 'manzil' && !hasCompletedParas) return;

    let range: AssignmentRange | null = null;
    if (selectedPart === 'manzil' && !manzilUsingCustomRange) {
      if (validSelectedManzilParas.length === 0) return;
      range = manzilCombinedRange;
    } else if (selectionStart && selectionEnd) {
      if (selectedPart === 'manzil' && manzilCustomRangeError) return;
      const calcMeta = getRangeMetadata(selectionStart, selectionEnd);
      range = {
        start: selectionStart,
        end: selectionEnd,
        linesCount: calcMeta.linesCount,
        surahName: calcMeta.surahName,
        juzNumber: calcMeta.juzNumber,
        startLine: calcMeta.startLine,
        endLine: calcMeta.endLine,
        startPage: calcMeta.startPage,
        endPage: calcMeta.endPage,
        startAyah: calcMeta.startAyah,
        endAyah: calcMeta.endAyah,
      };
    }

    if (!range) return;

    // Final guard: every referenced Manzil para MUST be in studentCompletedParas
    if (selectedPart === 'manzil') {
      const checkParas = !manzilUsingCustomRange
        ? validSelectedManzilParas
        : getManzilParasFromPlan([], range);
      if (checkParas.length === 0 || checkParas.some(p => !completedSet.has(p))) {
        return;
      }
    }

    let portionLabel: string | undefined;
    let sabqiCustomOverride = false;
    if (selectedPart === 'sabqi') {
      if (sabqiMode === 'current_para_passed') {
        portionLabel = `Passed Sabaqs in Para ${student.currentJuz} (P${range.startPage}:L${range.startLine} - P${range.endPage}:L${range.endLine})`;
        sabqiCustomOverride = false;
      } else {
        sabqiCustomOverride = true;
        if (sabqiMode === 'quarter_para') portionLabel = `Quarter Para ${sabqiTargetPara}`;
        else if (sabqiMode === 'half_para') portionLabel = `Half Para ${sabqiTargetPara}`;
        else if (sabqiMode === 'full_para') portionLabel = `Complete Para ${sabqiTargetPara}`;
        else
          portionLabel = `Narrowed Sabqi (P${range.startPage}:L${range.startLine} - P${range.endPage}:L${range.endLine})`;
      }
    } else if (selectedPart === 'manzil') {
      portionLabel =
        validSelectedManzilParas.length > 0 && !manzilUsingCustomRange
          ? `Para ${validSelectedManzilParas.join(', ')}`
          : `Pages ${range.startPage} - ${range.endPage}`;
    }

    onSave(student.id, selectedPart, range, applyToAll, {
      assignedParas:
        selectedPart === 'manzil'
          ? manzilUsingCustomRange
            ? []
            : validSelectedManzilParas
          : undefined,
      portionType: selectedPart === 'sabqi' ? sabqiMode : undefined,
      portionLabel,
      sabqiCustomOverride: selectedPart === 'sabqi' ? sabqiCustomOverride : undefined,
      targetDate: activeDate,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start [@media(min-height:600px)]:items-center justify-center bg-black/65 backdrop-blur-xs p-1 sm:p-4 overflow-y-auto">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-5xl [@media(min-height:600px)]:max-h-[95vh] flex flex-col [@media(min-height:600px)]:overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b-2 border-[#C5A059] flex items-center justify-between bg-[#241811] text-[#FCFAF6]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#C5A059]" />
              <span>{t.assignModalTitle}</span>
              <span className="text-[#C5A059] text-xs">۞</span>
            </h2>
            <div className="text-xs text-[#DFCFA8] mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>{state.language === 'ur' ? student.urduName : student.name}</span>
              <StudentTypeBadge
                type={student.studentType || 'hifz'}
                language={state.language}
                size="xs"
              />
              <span>· {student.halqaName} · Para {student.currentJuz} ·</span>
              <span className="font-mono">{activeDate}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-[#3E2B20] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dedicated Part Control Tabs: Sabaq (plus Sabqi | Manzil for Hifz) */}
        <div className="px-5 py-2.5 border-b border-[#DFCFA8] bg-[#F8F4EC] flex items-center gap-2.5">
          {(isNazra ? (['sabaq'] as PartType[]) : (['sabaq', 'sabqi', 'manzil'] as PartType[])).map(partKey => {
            const isSelected = effectivePart === partKey;
            return (
              <button
                key={partKey}
                type="button"
                onClick={() => switchPartTab(partKey)}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-[#241811] text-[#FCFAF6] border border-[#C5A059] shadow-xs scale-[1.01]'
                    : 'bg-[#FCFAF6] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
                }`}
              >
                {partKey === 'sabaq' && <Sparkles className="w-4 h-4 text-[#C5A059]" />}
                {partKey === 'sabqi' && <Layers className="w-4 h-4 text-[#8F6E2B]" />}
                {partKey === 'manzil' && <BookmarkCheck className="w-4 h-4 text-[#1F4E3D]" />}
                <span>
                  {t.parts[partKey]} ({t.parts[`${partKey}Desc` as keyof typeof t.parts]})
                </span>
              </button>
            );
          })}
        </div>

        {/* Section 1: Controls for Selected Part */}
        <div className="px-5 py-3 border-b border-[#DFCFA8] bg-[#FCFAF6]">
          {/* A. SABAQ CONTROLS */}
          {selectedPart === 'sabaq' && (
            isSabaqBlocked ? (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border-2 border-[#B91C1C]/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#7F1D1D]">
                      {pauseStatus.detailedReasons.join(' ')}
                    </div>
                    <div className="text-[11px] font-semibold text-[#991B1B]">
                      {pauseStatus.reasons.join(' · ')}
                    </div>
                  </div>
                </div>
                {!isNazra && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pauseStatus.sabqiPaused && (
                      <button
                        type="button"
                        onClick={() => switchPartTab('sabqi')}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DFCFA8] hover:bg-[#F8F4EC] text-xs font-bold text-[#241811] cursor-pointer"
                      >
                        {t.parts.sabqi}
                      </button>
                    )}
                    {pauseStatus.manzilPaused && (
                      <button
                        type="button"
                        onClick={() => switchPartTab('manzil')}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1F4E3D] text-white hover:bg-[#16382C] text-xs font-bold cursor-pointer"
                      >
                        {t.parts.manzil}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {priorRepeatSabaq && (
                    <span className="font-bold text-[#991B1B] bg-[#FEE2E2] border border-[#B91C1C]/40 px-2.5 py-1 rounded-lg">
                      {t.sameSabaqRepeatNote}
                    </span>
                  )}
                  {!selectionStart && !selectionEnd && (
                    <span className="font-bold text-[#78350F] bg-[#FEF3C7] border border-[#F59E0B]/50 px-2.5 py-1 rounded-lg">
                      {t.sabaqNotAssignedYet} — Tap the FIRST word, then the LAST word on the Mushaf.
                    </span>
                  )}
                  {selectionStart && !selectionEnd && (
                    <span className="font-bold text-[#143429] bg-[#EBF3EE] border border-[#2E6A54] px-2.5 py-1 rounded-lg">
                      First word selected (P{selectionStart.page}:L{selectionStart.line}:W
                      {selectionStart.wordIndex}) — now tap the LAST word.
                    </span>
                  )}
                  {(selectionStart || selectionEnd) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectionStart(null);
                        setSelectionEnd(null);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-[#DFCFA8] bg-[#F8F4EC] hover:bg-[#F3ECE1] text-[#5A4333] font-semibold cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {metadata && (
                  <div className="bg-[#EBF3EE] border border-[#2E6A54] px-3 py-1.5 rounded-lg text-xs font-mono text-[#143429] flex items-center gap-2 font-medium">
                    <span className="font-bold">{metadata.surahName}</span>
                    <span>·</span>
                    <span>Para {metadata.juzNumber}</span>
                    <span>·</span>
                    <span>
                      P{metadata.startPage}:L{metadata.startLine} to P{metadata.endPage}:L
                      {metadata.endLine}
                    </span>
                    <span>·</span>
                    <span className="font-bold bg-[#1F4E3D] text-[#FCFAF6] px-1.5 py-0.5 rounded text-[10px]">
                      {metadata.linesCount} Lines
                    </span>
                  </div>
                )}
              </div>
            )
          )}

          {/* B. SABQI CONTROLS */}
          {selectedPart === 'sabqi' && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#241811]">{t.sabqiPortionTitle}:</span>
                  {currentParaSabqi ? (
                    <span className="font-mono text-[#1F4E3D] bg-[#E8F0EC] px-2 py-0.5 rounded font-bold">
                      Para {student.currentJuz} Passed: P{currentParaSabqi.range.start.page}:L
                      {currentParaSabqi.range.start.line} – P{currentParaSabqi.range.end.page}:L
                      {currentParaSabqi.range.end.line} ({currentParaSabqi.passedCount} passed
                      lessons)
                    </span>
                  ) : (
                    <span className="text-[#7A6C60] italic">
                      No passed Sabaq in Para {student.currentJuz} yet.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!currentParaSabqi}
                  onClick={applyAllPassedCurrentParaSabqi}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                    sabqiMode === 'current_para_passed'
                      ? 'bg-[#1F4E3D] text-white border border-[#C5A059] shadow-2xs'
                      : 'bg-[#F8F4EC] text-[#241811] border border-[#C5A059] hover:bg-[#F3ECE1]'
                  }`}
                >
                  {t.sabqiUseAllPassed}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-[#7A6C60]">{t.sabqiNarrowOption}</span>
                <button
                  type="button"
                  onClick={() => applySabqiPreset('quarter_para', sabqiTargetPara)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    sabqiMode === 'quarter_para'
                      ? 'bg-[#C5A059] text-[#241811] shadow-2xs'
                      : 'bg-[#F8F4EC] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
                  }`}
                >
                  {t.quarterPara}
                </button>

                <button
                  type="button"
                  onClick={() => applySabqiPreset('half_para', sabqiTargetPara)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    sabqiMode === 'half_para'
                      ? 'bg-[#C5A059] text-[#241811] shadow-2xs'
                      : 'bg-[#F8F4EC] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
                  }`}
                >
                  {t.halfPara}
                </button>

                <button
                  type="button"
                  onClick={() => applySabqiPreset('full_para', sabqiTargetPara)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    sabqiMode === 'full_para'
                      ? 'bg-[#C5A059] text-[#241811] shadow-2xs'
                      : 'bg-[#F8F4EC] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
                  }`}
                >
                  {t.fullPara}
                </button>

                <button
                  type="button"
                  onClick={() => setSabqiMode('custom')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    sabqiMode === 'custom'
                      ? 'bg-[#C5A059] text-[#241811] shadow-2xs'
                      : 'bg-[#F8F4EC] text-[#42362E] hover:bg-[#F3ECE1] border border-[#DFCFA8]'
                  }`}
                >
                  {t.customRange}
                </button>

                <div className="ml-auto flex items-center gap-1.5 text-xs">
                  <span className="text-[#7A6C60]">Target Para:</span>
                  <select
                    value={sabqiTargetPara}
                    onChange={e => {
                      const p = parseInt(e.target.value, 10);
                      applySabqiPreset(
                        sabqiMode === 'custom' || sabqiMode === 'current_para_passed'
                          ? 'half_para'
                          : sabqiMode,
                        p
                      );
                    }}
                    className="border border-[#DFCFA8] rounded-md px-2 py-1 bg-[#FAF6EF] text-xs font-bold text-[#241811]"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(pNum => (
                      <option key={pNum} value={pNum}>
                        Para {pNum} ({getParaSurahName(pNum)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* C. MANZIL CONTROLS */}
          {selectedPart === 'manzil' && (
            <div className="space-y-3">
              {!hasCompletedParas ? (
                <div className="p-3.5 rounded-xl bg-[#F8F4EC] border border-[#DFCFA8] text-xs font-bold text-[#7A6C60]">
                  {t.noCompletedParasYet}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#241811]">{t.selectParasForManzil}</h4>
                      <p className="text-[11px] text-[#7A6C60]">
                        Tap completed Paras to toggle each one on or off ({studentCompletedParas.length}{' '}
                        completed · {validSelectedManzilParas.length} selected).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowManzilCustomRange(p => {
                          const next = !p;
                          if (!next) {
                            setManzilUsingCustomRange(false);
                            setSelectionStart(null);
                            setSelectionEnd(null);
                          } else {
                            setManzilUsingCustomRange(true);
                            const seedPara = validSelectedManzilParas[0] || studentCompletedParas[0];
                            if ((!selectionStart || !selectionEnd) && seedPara) {
                              const seed = getFullParaRange(seedPara);
                              setSelectionStart(seed.start);
                              setSelectionEnd(seed.end);
                              setPageNumber(seed.start.page);
                            }
                          }
                          return next;
                        });
                      }}
                      className="text-xs text-[#1F4E3D] hover:text-[#241811] font-bold underline cursor-pointer"
                    >
                      {showManzilCustomRange ? 'Hide Custom Range' : t.manzilCustomSubRange}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {studentCompletedParas.map((paraNum, idx) => {
                      const isAssigned =
                        !manzilUsingCustomRange && validSelectedManzilParas.includes(paraNum);
                      const repeatDate = manzilState.repeatParas[paraNum];
                      const isRepeat = Boolean(repeatDate);
                      const { startPage, endPage } = getParaPageRange(paraNum, activeLayout);
                      const surahName = getParaSurahName(paraNum);
                      const isUr = state.language === 'ur';
                      const statusLine = isAssigned
                        ? isUr
                          ? 'منزل کے لیے منتخب'
                          : 'Selected for Manzil'
                        : isRepeat && repeatDate
                        ? `${t.repeatPrefix}: ${repeatDate}`
                        : isUr
                        ? 'مکمل شدہ'
                        : 'Completed';
                      const chipTitle = `${isUr ? `پارہ ${paraNum}` : `Para ${paraNum}`} (${surahName}) · ${
                        isUr ? `صفحات ${startPage}–${endPage}` : `Pages ${startPage}–${endPage}`
                      } · ${statusLine}`;
                      const isTooltipOpen = manzilChipTooltip === paraNum;

                      return (
                        <div key={paraNum} className="relative">
                          <button
                            type="button"
                            aria-pressed={isAssigned}
                            aria-label={chipTitle}
                            title={chipTitle}
                            onClick={e => {
                              if (chipPressFiredRef.current) {
                                e.preventDefault();
                                chipPressFiredRef.current = false;
                                return;
                              }
                              setManzilChipTooltip(null);
                              toggleManzilPara(paraNum);
                            }}
                            onPointerEnter={e => {
                              if (e.pointerType !== 'touch') {
                                setManzilChipTooltip(paraNum);
                              }
                            }}
                            onPointerLeave={e => {
                              if (e.pointerType !== 'touch') {
                                setManzilChipTooltip(curr => (curr === paraNum ? null : curr));
                              }
                            }}
                            onFocus={() => setManzilChipTooltip(paraNum)}
                            onBlur={() =>
                              setManzilChipTooltip(curr => (curr === paraNum ? null : curr))
                            }
                            onTouchStart={() => {
                              clearChipTimers();
                              chipPressFiredRef.current = false;
                              chipPressTimerRef.current = setTimeout(() => {
                                chipPressFiredRef.current = true;
                                setManzilChipTooltip(paraNum);
                                chipAutoHideRef.current = setTimeout(() => {
                                  setManzilChipTooltip(curr => (curr === paraNum ? null : curr));
                                }, 2800);
                              }, 400);
                            }}
                            onTouchMove={() => {
                              if (chipPressTimerRef.current) {
                                clearTimeout(chipPressTimerRef.current);
                                chipPressTimerRef.current = null;
                              }
                            }}
                            onTouchCancel={() => {
                              if (chipPressTimerRef.current) {
                                clearTimeout(chipPressTimerRef.current);
                                chipPressTimerRef.current = null;
                              }
                            }}
                            onTouchEnd={() => {
                              if (chipPressTimerRef.current) {
                                clearTimeout(chipPressTimerRef.current);
                                chipPressTimerRef.current = null;
                              }
                            }}
                            className={`min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] sm:h-9 px-2 rounded-lg text-xs font-bold tabular-nums transition-all cursor-pointer flex items-center justify-center relative select-none ${
                              isAssigned
                                ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#1C120C] border-2 border-[#B45309] shadow-sm ring-2 ring-[#B45309]/30'
                                : isRepeat
                                ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white border-2 border-[#7F1D1D] shadow-xs'
                                : 'bg-[#1F4E3D] hover:bg-[#16382C] text-white border border-[#C5A059] shadow-2xs'
                            }`}
                          >
                            <span>{paraNum}</span>

                            {isAssigned && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#1C120C] text-[#FDE68A] border border-[#F59E0B] text-[8px] font-black leading-none flex items-center justify-center"
                              >
                                {isUr ? 'م' : 'M'}
                              </span>
                            )}

                            {!isAssigned && isRepeat && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FEF2F2] text-[#7F1D1D] border border-[#7F1D1D] text-[8px] font-black leading-none flex items-center justify-center"
                              >
                                {isUr ? 'د' : 'R'}
                              </span>
                            )}
                          </button>

                          {isTooltipOpen && (
                            <div
                              role="tooltip"
                              className={`pointer-events-none absolute z-50 top-full mt-1.5 ${
                                idx === 0
                                  ? 'left-0'
                                  : idx >= studentCompletedParas.length - 2
                                  ? 'right-0'
                                  : 'left-1/2 -translate-x-1/2'
                              } px-2.5 py-1.5 rounded-lg bg-[#241811] text-[#FCFAF6] border border-[#C5A059] shadow-lg text-[10px] leading-snug whitespace-nowrap`}
                            >
                              <div className="font-bold text-[#DFCFA8]">
                                {isUr ? `پارہ ${paraNum}` : `Para ${paraNum}`} · {surahName}
                              </div>
                              <div className="font-mono text-[#FCFAF6]/90">
                                {isUr
                                  ? `صفحات ${startPage}–${endPage}`
                                  : `Pages ${startPage}–${endPage}`}
                              </div>
                              <div
                                className={`font-bold mt-0.5 ${
                                  isAssigned
                                    ? 'text-[#FCD34D]'
                                    : isRepeat
                                    ? 'text-[#FCA5A5]'
                                    : 'text-[#86EFAC]'
                                }`}
                              >
                                {statusLine}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {showManzilCustomRange && (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-bold text-[#241811]">From Page:</span>
                        <input
                          type="number"
                          min={1}
                          max={604}
                          value={selectionStart?.page || 1}
                          onChange={e => {
                            setManzilUsingCustomRange(true);
                            const p = Math.max(1, Math.min(604, parseInt(e.target.value, 10) || 1));
                            const loc = getFirstWordOnOrAfter(p, selectionStart?.line || 1);
                            setSelectionStart(loc);
                            setPageNumber(p);
                          }}
                          className="w-16 px-2 py-1 border border-[#DFCFA8] rounded bg-white font-mono"
                        />
                        <span className="font-bold text-[#241811]">Line:</span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={selectionStart?.line || 1}
                          onChange={e => {
                            setManzilUsingCustomRange(true);
                            const l = Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 1));
                            const loc = getFirstWordOnOrAfter(selectionStart?.page || 1, l);
                            setSelectionStart(loc);
                          }}
                          className="w-14 px-2 py-1 border border-[#DFCFA8] rounded bg-white font-mono"
                        />
                        <span className="text-[#C5A059] font-bold">→</span>
                        <span className="font-bold text-[#241811]">To Page:</span>
                        <input
                          type="number"
                          min={1}
                          max={604}
                          value={selectionEnd?.page || 1}
                          onChange={e => {
                            setManzilUsingCustomRange(true);
                            const p = Math.max(1, Math.min(604, parseInt(e.target.value, 10) || 1));
                            const loc = getLastWordOnOrBefore(p, selectionEnd?.line || 15);
                            setSelectionEnd(loc);
                          }}
                          className="w-16 px-2 py-1 border border-[#DFCFA8] rounded bg-white font-mono"
                        />
                        <span className="font-bold text-[#241811]">Line:</span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={selectionEnd?.line || 15}
                          onChange={e => {
                            setManzilUsingCustomRange(true);
                            const l = Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 15));
                            const loc = getLastWordOnOrBefore(selectionEnd?.page || 1, l);
                            setSelectionEnd(loc);
                          }}
                          className="w-14 px-2 py-1 border border-[#DFCFA8] rounded bg-white font-mono"
                        />
                      </div>

                      {manzilCustomRangeError && (
                        <div className="p-2.5 bg-[#FEF2F2] border border-[#B91C1C]/60 rounded-xl text-xs font-bold text-[#991B1B] flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0" />
                          <span>{manzilCustomRangeError}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!manzilUsingCustomRange && validSelectedManzilParas.length > 0 && metadata ? (
                    <div className="text-xs font-mono bg-[#EBF3EE] border border-[#2E6A54] p-2.5 rounded-lg text-[#143429] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong>Manzil Target (tap to view / × to remove):</strong>
                        {validSelectedManzilParas.map(p => (
                          <span
                            key={p}
                            className={`inline-flex items-center rounded border font-bold overflow-hidden ${
                              focusedParaNum === p
                                ? 'bg-[#1F4E3D] text-white border-[#143429]'
                                : 'bg-white border-[#2E6A54]/50 text-[#143429]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedParaNum(p);
                                setPageNumber(getParaPageRange(p, activeLayout).startPage);
                              }}
                              className="px-2 py-0.5 hover:underline cursor-pointer"
                              title={`View Para ${p} on Mushaf`}
                            >
                              Para {p} (P{getParaPageRange(p, activeLayout).startPage})
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleManzilPara(p)}
                              className="px-1 py-0.5 hover:bg-rose-600 hover:text-white cursor-pointer transition-colors"
                              title={`Remove Para ${p} from selection`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <span className="font-bold text-[#1F4E3D]">{metadata.linesCount} lines total</span>
                    </div>
                  ) : (
                    !manzilUsingCustomRange &&
                    repeatParaNums.length > 0 && (
                      <div className="text-xs text-[#78350F] bg-[#FEF3C7] border border-[#F59E0B]/50 px-3 py-1.5 rounded-lg font-semibold">
                        Repeat pending on Para {repeatParaNums.join(', ')} — tap above to assign Manzil.
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Mushaf Page Picker Canvas */}
        <div
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto p-1.5 sm:p-3 bg-[#FAF6EF] bg-islamic-pattern block focus:outline-none"
        >
          <MushafViewer
            pageNumber={pageNumber}
            onPageChange={setPageNumber}
            selectionStart={
              isSabaqBlocked || (selectedPart === 'manzil' && !showManzilCustomRange)
                ? null
                : selectionStart
            }
            selectionEnd={
              isSabaqBlocked || (selectedPart === 'manzil' && !showManzilCustomRange)
                ? null
                : selectionEnd
            }
            highlightRanges={undefined}
            manzilHeaderPara={
              selectedPart === 'manzil' &&
              !manzilUsingCustomRange &&
              validSelectedManzilParas.length > 0
                ? focusedParaNum && validSelectedManzilParas.includes(focusedParaNum)
                  ? focusedParaNum
                  : validSelectedManzilParas[0]
                : null
            }
            activeParaNumber={focusedParaNum}
            interactiveMode={
              isSabaqBlocked ||
              (selectedPart === 'manzil' && (!hasCompletedParas || !showManzilCustomRange))
                ? 'view'
                : 'assigning'
            }
            onWordClick={handleWordClick}
            language={state.language}
            mushafLayout={activeLayout}
            onLayoutChange={l => onUpdateMushafSettings?.({ mushafLayout: l })}
            mushafScript={state.settings.mushafScript || 'indopak'}
            onScriptChange={s => onUpdateMushafSettings?.({ mushafScript: s })}
            highContrast={Boolean(state.settings.highContrastMushaf)}
            onToggleHighContrast={() =>
              onUpdateMushafSettings?.({ highContrastMushaf: !state.settings.highContrastMushaf })
            }
          />
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#DFCFA8] bg-[#FCFAF6] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DFCFA8] rounded-xl text-[#42362E] hover:bg-[#F3ECE1] text-xs md:text-sm font-semibold transition-colors cursor-pointer"
          >
            {t.close}
          </button>

          <div className="flex items-center gap-2">
            {selectedPart !== 'sabaq' && (
              <button
                type="button"
                disabled={!hasValidRange}
                onClick={() => handleConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DFCFA8] bg-[#F8F4EC] hover:bg-[#F3ECE1] text-[#241811] disabled:opacity-40 text-xs md:text-sm font-semibold transition-colors cursor-pointer"
                title="Apply this exact range to all students in this Ustaad's Halqa"
              >
                <Users className="w-4 h-4 text-[#8F6E2B]" />
                <span>{t.sameForAllStudents}</span>
              </button>
            )}

            <button
              type="button"
              disabled={!hasValidRange || isSabaqBlocked}
              onClick={() => handleConfirm(false)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] border border-[#C5A059] disabled:opacity-40 disabled:cursor-not-allowed text-xs md:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#C5A059]" />
              <span>
                {t.confirmAssignment} ({student.name.split(' ')[0]})
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
