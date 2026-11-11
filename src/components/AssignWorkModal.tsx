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
  Calendar,
  Plus,
  CheckSquare,
  Square,
  HelpCircle
} from 'lucide-react';
import { 
  MadrasaState, 
  StudentProfile, 
  PartType, 
  AssignmentRange 
} from '../types/hifz';
import { MushafViewer } from './MushafViewer';
import { 
  MushafWord, 
  WordLocation, 
  calculateRangeLines, 
  advanceLocationByLines,
  getRangeMetadata,
  getParaPageRange,
  getParaSurahName,
  getPage
} from '../data/quranData';
import { translations } from '../i18n/translations';

interface AssignWorkModalProps {
  state: MadrasaState;
  student: StudentProfile;
  initialPart?: PartType;
  onClose: () => void;
  onSave: (
    targetStudentId: string,
    part: PartType,
    range: AssignmentRange,
    applyToAllHalqa: boolean,
    extraMetadata?: {
      assignedParas?: number[];
      portionType?: 'custom' | 'quarter_para' | 'half_para' | 'full_para';
      portionLabel?: string;
      updatedCompletedParas?: number[];
    }
  ) => void;
}

export const AssignWorkModal: React.FC<AssignWorkModalProps> = ({
  state,
  student,
  initialPart = 'sabaq',
  onClose,
  onSave,
}) => {
  const [selectedPart, setSelectedPart] = useState<PartType>(initialPart);
  const t = translations[state.language];

  // Retrieve existing plan for selected part
  const todayPlan = state.dailyPlans[student.id]?.[state.currentDate];
  const currentPlan = todayPlan?.[selectedPart];
  const currentRange = currentPlan?.range;

  const [pageNumber, setPageNumber] = useState<number>(
    currentRange?.start.page || 1
  );

  const [selectionStart, setSelectionStart] = useState<WordLocation | null>(
    currentRange ? currentRange.start : null
  );
  const [selectionEnd, setSelectionEnd] = useState<WordLocation | null>(
    currentRange ? currentRange.end : null
  );

  // Sabqi specific state
  const [sabqiMode, setSabqiMode] = useState<'custom' | 'quarter_para' | 'half_para' | 'full_para'>(
    currentPlan?.portionType || 'half_para'
  );
  const [sabqiTargetPara, setSabqiTargetPara] = useState<number>(
    currentPlan?.juzNumber || student.currentJuz || 1
  );

  // Manzil specific state: Selected completed Paras for revision
  const [completedParasState, setCompletedParasState] = useState<number[]>(
    student.completedParas && student.completedParas.length > 0
      ? student.completedParas
      : [1] // Default at least Para 1 completed if empty
  );

  const [assignedManzilParas, setAssignedManzilParas] = useState<number[]>(
    currentPlan?.assignedParas && currentPlan.assignedParas.length > 0
      ? currentPlan.assignedParas
      : completedParasState.slice(0, 1) // Default to first completed Para
  );

  const [isEditingCompletedParas, setIsEditingCompletedParas] = useState<boolean>(false);

  // Tap handler on mushaf words: first tap sets start, second tap sets end!
  const handleWordClick = (word: MushafWord) => {
    const loc: WordLocation = {
      page: word.pageNumber,
      line: word.lineNumber,
      wordIndex: word.wordIndex,
      wordId: word.id,
    };

    if (!selectionStart || (selectionStart && selectionEnd)) {
      setSelectionStart(loc);
      setSelectionEnd(null);
    } else {
      setSelectionEnd(loc);
    }
  };

  // Helper to start where last Sabaq ended
  const handleStartFromLastSabaqEnd = () => {
    const lastEnd = todayPlan?.sabaq?.range?.end;
    if (lastEnd) {
      setSelectionStart(lastEnd);
      const defaultEnd = advanceLocationByLines(lastEnd, 10);
      setSelectionEnd(defaultEnd);
      setPageNumber(lastEnd.page);
    }
  };

  // Helper for Sabqi presets (Half Para, Quarter Para, Full Para)
  const applySabqiPreset = (preset: 'quarter_para' | 'half_para' | 'full_para', paraNum: number) => {
    setSabqiMode(preset);
    setSabqiTargetPara(paraNum);
    const { startPage, endPage } = getParaPageRange(paraNum);

    let fromPage = startPage;
    let toPage = endPage;

    if (preset === 'quarter_para') {
      toPage = Math.min(endPage, startPage + 4);
    } else if (preset === 'half_para') {
      toPage = Math.min(endPage, startPage + 9);
    }

    const startPageObj = getPage(fromPage);
    const endPageObj = getPage(toPage);

    const startLoc: WordLocation = {
      page: fromPage,
      line: 1,
      wordIndex: 1,
      wordId: startPageObj.lines[0]?.words[0]?.id || `p${fromPage}_l1_w1`,
    };

    const lastLine = endPageObj.lines[endPageObj.lines.length - 1];
    const lastWord = lastLine?.words[lastLine.words.length - 1];

    const endLoc: WordLocation = {
      page: toPage,
      line: lastLine?.lineNumber || 15,
      wordIndex: lastWord?.wordIndex || 8,
      wordId: lastWord?.id || `p${toPage}_l15_w8`,
    };

    setSelectionStart(startLoc);
    setSelectionEnd(endLoc);
    setPageNumber(fromPage);
  };

  // Helper for Manzil Para selection
  const toggleManzilParaSelection = (paraNum: number) => {
    setAssignedManzilParas(prev => {
      let next: number[];
      if (prev.includes(paraNum)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        next = prev.filter(p => p !== paraNum);
      } else {
        next = [...prev, paraNum].sort((a, b) => a - b);
      }

      // Automatically sync page range to the selected Paras
      if (next.length > 0) {
        const minPara = Math.min(...next);
        const maxPara = Math.max(...next);
        const { startPage } = getParaPageRange(minPara);
        const { endPage } = getParaPageRange(maxPara);

        const startPageObj = getPage(startPage);
        const endPageObj = getPage(endPage);

        const startLoc: WordLocation = {
          page: startPage,
          line: 1,
          wordIndex: 1,
          wordId: startPageObj.lines[0]?.words[0]?.id || `p${startPage}_l1_w1`,
        };
        const lastLine = endPageObj.lines[endPageObj.lines.length - 1];
        const lastWord = lastLine?.words[lastLine.words.length - 1];
        const endLoc: WordLocation = {
          page: endPage,
          line: lastLine?.lineNumber || 15,
          wordIndex: lastWord?.wordIndex || 8,
          wordId: lastWord?.id || `p${endPage}_l15_w8`,
        };

        setSelectionStart(startLoc);
        setSelectionEnd(endLoc);
        setPageNumber(startPage);
      }
      return next;
    });
  };

  // Toggle completed Paras list for student
  const toggleStudentCompletedPara = (paraNum: number) => {
    setCompletedParasState(prev => {
      let next: number[];
      if (prev.includes(paraNum)) {
        next = prev.filter(p => p !== paraNum);
      } else {
        next = [...prev, paraNum].sort((a, b) => a - b);
      }
      // If currently assigned manzil paras contain a removed para, remove it
      setAssignedManzilParas(currAssigned => currAssigned.filter(p => next.includes(p)));
      return next;
    });
  };

  // Compute calculated range summary
  const hasValidRange = Boolean(selectionStart && selectionEnd);
  const metadata = hasValidRange
    ? getRangeMetadata(selectionStart!, selectionEnd!)
    : null;

  const handleSave = (applyToAll: boolean) => {
    if (!selectionStart || !selectionEnd || !metadata) return;

    let portionLabel: string | undefined;
    if (selectedPart === 'sabqi') {
      if (sabqiMode === 'quarter_para') portionLabel = `Quarter Para ${sabqiTargetPara}`;
      else if (sabqiMode === 'half_para') portionLabel = `Half Para ${sabqiTargetPara}`;
      else if (sabqiMode === 'full_para') portionLabel = `Complete Para ${sabqiTargetPara}`;
      else portionLabel = `Custom Revision (${metadata.linesCount} lines)`;
    } else if (selectedPart === 'manzil') {
      portionLabel = `Para ${assignedManzilParas.join(', ')}`;
    }

    const range: AssignmentRange = {
      start: selectionStart,
      end: selectionEnd,
      linesCount: metadata.linesCount,
      surahName: metadata.surahName,
      juzNumber: metadata.juzNumber,
      startLine: metadata.startLine,
      endLine: metadata.endLine,
      startPage: metadata.startPage,
      endPage: metadata.endPage,
    };

    onSave(student.id, selectedPart, range, applyToAll, {
      assignedParas: selectedPart === 'manzil' ? assignedManzilParas : undefined,
      portionType: selectedPart === 'sabqi' ? sabqiMode : undefined,
      portionLabel,
      updatedCompletedParas: completedParasState,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-700" />
              <span>{t.assignModalTitle}</span>
            </h2>
            <div className="text-xs text-stone-500 mt-0.5">
              {state.language === 'ur' ? student.urduName : student.name} · {student.halqaName}
              {student.memorizedPortionDesc && (
                <span className="text-emerald-800 font-semibold ml-2">
                  · {student.memorizedPortionDesc}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dedicated Part Control Tabs: Sabaq | Sabqi | Manzil */}
        <div className="px-5 py-2.5 border-b border-stone-200 bg-stone-100 flex items-center gap-2">
          {(['sabaq', 'sabqi', 'manzil'] as PartType[]).map(partKey => {
            const isSelected = selectedPart === partKey;
            return (
              <button
                key={partKey}
                type="button"
                onClick={() => {
                  setSelectedPart(partKey);
                  const existing = todayPlan?.[partKey]?.range;
                  if (existing) {
                    setSelectionStart(existing.start);
                    setSelectionEnd(existing.end);
                    setPageNumber(existing.start.page);
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-xs scale-[1.01]'
                    : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
                }`}
              >
                {partKey === 'sabaq' && <Sparkles className="w-4 h-4" />}
                {partKey === 'sabqi' && <Layers className="w-4 h-4" />}
                {partKey === 'manzil' && <BookmarkCheck className="w-4 h-4" />}
                <span>{t.parts[partKey]} ({t.parts[`${partKey}Desc` as keyof typeof t.parts]})</span>
              </button>
            );
          })}
        </div>

        {/* Section 1: Distinct Controls based on Selected Part */}
        <div className="px-5 py-3 border-b border-stone-200 bg-white">
          {/* A. SABAQ CONTROLS: Exact lines assignment */}
          {selectedPart === 'sabaq' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartFromLastSabaqEnd}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t.startFromLastSabaqEnd}</span>
                </button>
                <span className="text-xs text-stone-500">
                  Tap first word, then tap last word on the Mushaf.
                </span>
              </div>

              {metadata && (
                <div className="bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-950 flex items-center gap-2">
                  <span className="font-bold">{metadata.surahName}</span>
                  <span>·</span>
                  <span>Para {metadata.juzNumber}</span>
                  <span>·</span>
                  <span>P{metadata.startPage}:L{metadata.startLine} to P{metadata.endPage}:L{metadata.endLine}</span>
                  <span>·</span>
                  <span className="font-bold bg-emerald-200 px-1 rounded">{metadata.linesCount} Lines</span>
                </div>
              )}
            </div>
          )}

          {/* B. SABQI CONTROLS: Based on student's memorized portion */}
          {selectedPart === 'sabqi' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">
                  {t.sabqiPortionTitle}:
                </span>
                <span className="text-stone-500 font-medium">
                  {student.memorizedPortionDesc || 'Memorized portion'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => applySabqiPreset('quarter_para', sabqiTargetPara)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    sabqiMode === 'quarter_para'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {t.quarterPara}
                </button>

                <button
                  type="button"
                  onClick={() => applySabqiPreset('half_para', sabqiTargetPara)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    sabqiMode === 'half_para'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {t.halfPara}
                </button>

                <button
                  type="button"
                  onClick={() => applySabqiPreset('full_para', sabqiTargetPara)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    sabqiMode === 'full_para'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {t.fullPara}
                </button>

                <button
                  type="button"
                  onClick={() => setSabqiMode('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    sabqiMode === 'custom'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {t.customRange}
                </button>

                {/* Target Para selector for Sabqi */}
                <div className="ml-auto flex items-center gap-1.5 text-xs">
                  <span className="text-stone-500">Target Para:</span>
                  <select
                    value={sabqiTargetPara}
                    onChange={e => {
                      const p = parseInt(e.target.value, 10);
                      applySabqiPreset(sabqiMode === 'custom' ? 'half_para' : sabqiMode, p);
                    }}
                    className="border border-stone-300 rounded px-2 py-1 bg-white text-xs font-bold text-stone-800"
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

          {/* C. MANZIL CONTROLS: Select which completed Para(s) student recites */}
          {selectedPart === 'manzil' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-stone-900">
                    {t.selectParasForManzil}
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    The student has completed {completedParasState.length} Para(s). Choose the specific Para(s) due for tomorrow's recitation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingCompletedParas(prev => !prev)}
                  className="text-xs text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer"
                >
                  {isEditingCompletedParas ? 'Done Managing' : t.manageCompletedParas}
                </button>
              </div>

              {/* Completed Paras Management Mode (if teacher wants to check off newly completed Paras) */}
              {isEditingCompletedParas ? (
                <div className="p-3 bg-stone-50 border border-stone-300 rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-stone-700">
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
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          Para {paraNum} {isCompleted ? '✓' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Select which completed Para is assigned for Manzil */
                <div className="flex flex-wrap items-center gap-2">
                  {completedParasState.length === 0 ? (
                    <div className="text-xs text-stone-500 italic">
                      {t.noParasCompleted}. Click "Manage Completed Paras" above to record completed Paras.
                    </div>
                  ) : (
                    completedParasState.map(paraNum => {
                      const isAssigned = assignedManzilParas.includes(paraNum);
                      return (
                        <button
                          key={paraNum}
                          type="button"
                          onClick={() => toggleManzilParaSelection(paraNum)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isAssigned
                              ? 'bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-xs scale-105'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
                          }`}
                        >
                          {isAssigned ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-stone-400" />}
                          <span>Para {paraNum}</span>
                          <span className="text-[10px] opacity-80 font-normal">
                            ({getParaSurahName(paraNum)})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Manzil Assigned summary */}
              {assignedManzilParas.length > 0 && metadata && (
                <div className="text-xs font-mono bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-emerald-950 flex items-center justify-between">
                  <span>
                    <strong>Manzil Target:</strong> Para {assignedManzilParas.join(', ')} ({metadata.surahName}, Pages {metadata.startPage} - {metadata.endPage})
                  </span>
                  <span className="font-bold">
                    {metadata.linesCount} lines total
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mushaf Page Picker Canvas */}
        <div className="flex-1 overflow-y-auto p-3 bg-stone-100 flex justify-center">
          <MushafViewer
            pageNumber={pageNumber}
            onPageChange={setPageNumber}
            selectionStart={selectionStart}
            selectionEnd={selectionEnd}
            interactiveMode="assigning"
            onWordClick={handleWordClick}
            language={state.language}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 hover:bg-stone-50 text-xs md:text-sm font-medium transition-colors cursor-pointer"
          >
            {t.close}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasValidRange}
              onClick={() => handleSave(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-800 disabled:opacity-40 text-xs md:text-sm font-medium transition-colors cursor-pointer"
              title="Apply this exact range to all students in this Ustaad's Halqa"
            >
              <Users className="w-4 h-4 text-stone-600" />
              <span>{t.sameForAllStudents}</span>
            </button>

            <button
              type="button"
              disabled={!hasValidRange}
              onClick={() => handleSave(false)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40 text-xs md:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{t.applyChanges} for {student.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
