/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Users,
  BookOpen,
  Check,
  Layers,
  BookmarkCheck,
  CheckSquare,
  Square,
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
  getFullParaRange,
  getManzilParaRanges,
} from '../services/hifzService';
import { translations } from '../i18n/translations';

interface AssignWorkModalProps {
  state: MadrasaState;
  student: StudentProfile;
  initialPart?: PartType;
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
      updatedCompletedParas?: number[];
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
  targetDate,
  onClose,
  onSave,
  onUpdateMushafSettings,
}) => {
  const isNazra = student.studentType === 'nazra';
  const [selectedPart, setSelectedPart] = useState<PartType>(isNazra ? 'sabaq' : initialPart);
  const effectivePart: PartType = isNazra ? 'sabaq' : selectedPart;
  const t = translations[state.language];
  const activeDate = targetDate || state.currentDate;

  const todayPlan = state.dailyPlans[student.id]?.[activeDate];
  const currentPlan = todayPlan?.[effectivePart];
  const currentRange = currentPlan?.range || null;

  const currentParaSabqi = computeCurrentParaSabqiRange(student, state, activeDate);

  // If no Sabaq is assigned yet, open on student's current Para page for browsing ONLY,
  // with selectionStart & selectionEnd STRICTLY null (nothing pre-selected or pre-marked!)
  const defaultBrowsePage =
    currentRange?.start.page || getParaPageRange(student.currentJuz || 1).startPage;

  const [pageNumber, setPageNumber] = useState<number>(defaultBrowsePage);
  const [selectionStart, setSelectionStart] = useState<WordLocation | null>(
    currentRange ? currentRange.start : null
  );
  const [selectionEnd, setSelectionEnd] = useState<WordLocation | null>(
    currentRange ? currentRange.end : null
  );

  // Sabqi specific state
  const [sabqiMode, setSabqiMode] = useState<
    'current_para_passed' | 'custom' | 'quarter_para' | 'half_para' | 'full_para'
  >(currentPlan?.portionType || 'current_para_passed');
  const [sabqiTargetPara, setSabqiTargetPara] = useState<number>(
    currentPlan?.juzNumber || student.currentJuz || 1
  );

  // Manzil specific state (multi-select completed Paras)
  const [completedParasState, setCompletedParasState] = useState<number[]>(
    student.completedParas ? [...student.completedParas] : []
  );
  const savedManzilParas = todayPlan?.manzil?.assignedParas;
  const [assignedManzilParas, setAssignedManzilParas] = useState<number[]>(
    savedManzilParas && savedManzilParas.length > 0
      ? [...savedManzilParas].sort((a, b) => a - b)
      : completedParasState.slice(0, 1)
  );
  const [isEditingCompletedParas, setIsEditingCompletedParas] = useState<boolean>(false);
  const [showManzilCustomRange, setShowManzilCustomRange] = useState<boolean>(false);
  const [manzilUsingCustomRange, setManzilUsingCustomRange] = useState<boolean>(false);

  // Tap handler on mushaf words: first tap sets start, second tap sets end!
  const handleWordClick = (word: MushafWord) => {
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

  // Multi-select toggle for Manzil Paras: tapping toggles each completed Para on or off
  const toggleManzilPara = (paraNum: number) => {
    setManzilUsingCustomRange(false);
    setSelectionStart(null);
    setSelectionEnd(null);

    setAssignedManzilParas(prev => {
      const exists = prev.includes(paraNum);
      const next = exists
        ? prev.filter(p => p !== paraNum)
        : [...prev, paraNum].sort((a, b) => a - b);

      if (!exists) {
        setPageNumber(getFullParaRange(paraNum).start.page);
      } else if (next.length > 0) {
        setPageNumber(getFullParaRange(next[0]).start.page);
      }
      return next;
    });
  };

  const toggleStudentCompletedPara = (paraNum: number) => {
    setCompletedParasState(prev => {
      const next = prev.includes(paraNum)
        ? prev.filter(p => p !== paraNum)
        : [...prev, paraNum].sort((a, b) => a - b);
      setAssignedManzilParas(curr => curr.filter(p => next.includes(p)));
      return next;
    });
  };

  const switchPartTab = (partKey: PartType) => {
    setSelectedPart(partKey);
    if (partKey === 'sabaq') {
      const existingSabaq = todayPlan?.sabaq?.range || null;
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
      setManzilUsingCustomRange(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      if (assignedManzilParas.length > 0) {
        setPageNumber(getFullParaRange(assignedManzilParas[0]).start.page);
      } else if (todayPlan?.manzil?.range) {
        setPageNumber(todayPlan.manzil.range.start.page);
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
    }
  };

  const manzilCombinedRange =
    selectedPart === 'manzil' && !manzilUsingCustomRange
      ? buildManzilCombinedRange(assignedManzilParas)
      : null;

  const manzilHighlightRanges =
    selectedPart === 'manzil' && !manzilUsingCustomRange && assignedManzilParas.length > 0
      ? getManzilParaRanges(assignedManzilParas)
      : undefined;

  const hasValidRange =
    selectedPart === 'manzil' && !manzilUsingCustomRange
      ? assignedManzilParas.length > 0 && Boolean(manzilCombinedRange)
      : Boolean(selectionStart && selectionEnd);

  const metadata =
    selectedPart === 'manzil' && !manzilUsingCustomRange
      ? manzilCombinedRange
      : selectionStart && selectionEnd
      ? getRangeMetadata(selectionStart, selectionEnd)
      : null;

  const handleConfirm = (applyToAll: boolean) => {
    if (!hasValidRange) return;

    let range: AssignmentRange | null = null;
    if (selectedPart === 'manzil' && !manzilUsingCustomRange) {
      range = manzilCombinedRange;
    } else if (selectionStart && selectionEnd) {
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
        assignedManzilParas.length > 0 && !manzilUsingCustomRange
          ? `Para ${assignedManzilParas.join(', ')}`
          : `Pages ${range.startPage} - ${range.endPage}`;
    }

    onSave(student.id, selectedPart, range, applyToAll, {
      assignedParas:
        selectedPart === 'manzil'
          ? manzilUsingCustomRange
            ? []
            : assignedManzilParas
          : undefined,
      portionType: selectedPart === 'sabqi' ? sabqiMode : undefined,
      portionLabel,
      updatedCompletedParas: completedParasState,
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
          {/* A. SABAQ CONTROLS: Pure manual selection (no defaults, no auto-start-from-last-end) */}
          {selectedPart === 'sabaq' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#241811]">{t.selectParasForManzil}</h4>
                  <p className="text-[11px] text-[#7A6C60]">
                    Tap completed Paras to toggle each one on or off ({completedParasState.length}{' '}
                    completed · {assignedManzilParas.length} selected).
                  </p>
                </div>

                <div className="flex items-center gap-3">
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
                          if (!selectionStart || !selectionEnd) {
                            const seed =
                              assignedManzilParas.length > 0
                                ? getFullParaRange(assignedManzilParas[0])
                                : getFullParaRange(1);
                            setSelectionStart(seed.start);
                            setSelectionEnd(seed.end);
                          }
                        }
                        return next;
                      });
                    }}
                    className="text-xs text-[#1F4E3D] hover:text-[#241811] font-bold underline cursor-pointer"
                  >
                    {showManzilCustomRange ? 'Hide Custom Range' : t.manzilCustomSubRange}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCompletedParas(prev => !prev)}
                    className="text-xs text-[#8F6E2B] hover:text-[#241811] font-bold underline cursor-pointer"
                  >
                    {isEditingCompletedParas ? 'Done Managing' : t.manageCompletedParas}
                  </button>
                </div>
              </div>

              {isEditingCompletedParas ? (
                <div className="p-3 bg-[#F8F4EC] border border-[#DFCFA8] rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-[#42362E]">
                    Check all Paras that {student.name} has memorized/completed:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(paraNum => {
                      const isCompleted = completedParasState.includes(paraNum);
                      return (
                        <button
                          key={paraNum}
                          type="button"
                          onClick={() => toggleStudentCompletedPara(paraNum)}
                          className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
                            isCompleted
                              ? 'bg-[#1F4E3D] text-white border border-[#C5A059]'
                              : 'bg-[#FCFAF6] border border-[#DFCFA8] text-[#5A4333] hover:bg-[#F3ECE1]'
                          }`}
                        >
                          Para {paraNum} {isCompleted ? '✓' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {completedParasState.length === 0 ? (
                    <div className="text-xs text-[#7A6C60] italic">
                      {t.noParasCompleted}. Finish a Para or click "{t.manageCompletedParas}".
                    </div>
                  ) : (
                    completedParasState.map(paraNum => {
                      const isAssigned = !manzilUsingCustomRange && assignedManzilParas.includes(paraNum);
                      return (
                        <button
                          key={paraNum}
                          type="button"
                          onClick={() => toggleManzilPara(paraNum)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isAssigned
                              ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#1C120C] border-2 border-[#B45309] shadow-md'
                              : 'bg-[#1F4E3D] hover:bg-[#16382C] text-white border border-[#C5A059] shadow-xs'
                          }`}
                        >
                          {isAssigned ? (
                            <CheckSquare className="w-4 h-4 text-[#1C120C]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#DFCFA8]" />
                          )}
                          <span>Para {paraNum}</span>
                          <span
                            className={`text-[10px] font-normal ${
                              isAssigned ? 'text-[#451A03]' : 'text-[#DFCFA8]'
                            }`}
                          >
                            ({getParaSurahName(paraNum)})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {showManzilCustomRange && (
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
              )}

              {!manzilUsingCustomRange && assignedManzilParas.length > 0 && metadata ? (
                <div className="text-xs font-mono bg-[#EBF3EE] border border-[#2E6A54] p-2.5 rounded-lg text-[#143429] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong>Manzil Target:</strong>
                    {assignedManzilParas.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleManzilPara(p)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#2E6A54]/50 text-[#143429] hover:bg-rose-50 hover:border-rose-400 hover:text-rose-800 font-bold cursor-pointer transition-colors"
                        title={`Remove Para ${p} from selection`}
                      >
                        <span>Para {p}</span>
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                  <span className="font-bold text-[#1F4E3D]">{metadata.linesCount} lines total</span>
                </div>
              ) : (
                !manzilUsingCustomRange &&
                completedParasState.length > 0 && (
                  <div className="text-xs text-[#78350F] bg-[#FEF3C7] border border-[#F59E0B]/50 px-3 py-1.5 rounded-lg font-semibold">
                    No Para selected yet — tap one or more completed Paras above to assign Manzil.
                  </div>
                )
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
            selectionStart={manzilHighlightRanges ? null : selectionStart}
            selectionEnd={manzilHighlightRanges ? null : selectionEnd}
            highlightRanges={manzilHighlightRanges}
            interactiveMode="assigning"
            onWordClick={handleWordClick}
            language={state.language}
            mushafLayout={student.mushafLayout || state.settings.mushafLayout || 'madinah'}
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
              disabled={!hasValidRange}
              onClick={() => handleConfirm(false)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] border border-[#C5A059] disabled:opacity-40 text-xs md:text-sm font-bold shadow-xs transition-colors cursor-pointer"
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
