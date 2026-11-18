/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  Edit3,
  Users,
  BookOpen,
  CheckSquare,
  Square,
  RotateCcw,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import {
  MadrasaState,
  StudentProfile,
  AssignmentRange,
} from '../types/hifz';
import {
  MushafWord,
  WordLocation,
  getRangeMetadata,
  getFirstWordOnOrAfter,
  getLastWordOnOrBefore,
} from '../data/quranData';
import {
  computePreviewRangeByLines,
  getNewSabaqPauseStatus,
  NewSabaqPauseStatus,
} from '../services/hifzService';
import { MushafViewer } from './MushafViewer';
import { StudentTypeBadge } from './StudentTypeBadge';
import { translations } from '../i18n/translations';

interface AssignByLinesModalProps {
  state: MadrasaState;
  students: StudentProfile[];
  onClose: () => void;
  onConfirmBatch: (assignments: Record<string, AssignmentRange>) => void;
  onUpdateMushafSettings?: (patch: {
    mushafLayout?: 'hafizi' | 'madinah';
    mushafScript?: 'indopak' | 'uthmani';
    highContrastMushaf?: boolean;
  }) => void;
}

interface StudentPreviewDraft {
  range: AssignmentRange;
  basisLabel: string;
  isEdited: boolean;
}

export const AssignByLinesModal: React.FC<AssignByLinesModalProps> = ({
  state,
  students,
  onClose,
  onConfirmBatch,
  onUpdateMushafSettings,
}) => {
  const t = translations[state.language];

  const [linesInput, setLinesInput] = useState<string>('10');
  const parsedLines = Math.max(1, Math.min(300, parseInt(linesInput, 10) || 1));

  const pauseByStudent = useMemo(() => {
    const map: Record<string, NewSabaqPauseStatus> = {};
    for (const s of students) {
      map[s.id] = getNewSabaqPauseStatus(s, state, state.currentDate);
    }
    return map;
  }, [students, state]);

  const skippedCount = useMemo(
    () => students.filter(s => pauseByStudent[s.id]?.isPaused).length,
    [students, pauseByStudent]
  );

  // Selected student IDs (default: all non-paused students without an assigned Sabaq, or all non-paused students)
  const initialSelected = useMemo(() => {
    const eligible = students.filter(s => !pauseByStudent[s.id]?.isPaused);
    const unassigned = eligible.filter(
      s => !state.dailyPlans[s.id]?.[state.currentDate]?.sabaq?.range
    );
    return new Set((unassigned.length > 0 ? unassigned : eligible).map(s => s.id));
  }, [students, pauseByStudent, state.dailyPlans, state.currentDate]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelected);
  const [customDrafts, setCustomDrafts] = useState<Record<string, StudentPreviewDraft>>({});

  // Inline Mushaf picker state for editing a specific student's preview range
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editPage, setEditPage] = useState<number>(1);
  const [editStart, setEditStart] = useState<WordLocation | null>(null);
  const [editEnd, setEditEnd] = useState<WordLocation | null>(null);

  // Build live preview per student (purely in-memory until Confirm)
  const previews: Record<string, StudentPreviewDraft> = useMemo(() => {
    const map: Record<string, StudentPreviewDraft> = {};
    for (const st of students) {
      if (customDrafts[st.id]?.isEdited) {
        map[st.id] = customDrafts[st.id];
      } else {
        const calc = computePreviewRangeByLines(st, state, parsedLines);
        map[st.id] = {
          range: calc.range,
          basisLabel: calc.basisLabel,
          isEdited: false,
        };
      }
    }
    return map;
  }, [students, state, parsedLines, customDrafts]);

  const toggleStudent = (id: string) => {
    if (pauseByStudent[id]?.isPaused) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedIds(
      new Set(students.filter(s => !pauseByStudent[s.id]?.isPaused).map(s => s.id))
    );
  const deselectAll = () => setSelectedIds(new Set());

  const openMushafEditForStudent = (studentId: string) => {
    const currentRange = previews[studentId]?.range;
    setEditingStudentId(studentId);
    setEditStart(currentRange ? currentRange.start : null);
    setEditEnd(currentRange ? currentRange.end : null);
    setEditPage(currentRange?.start.page || 1);
  };

  const handleEditWordClick = (word: MushafWord) => {
    const loc: WordLocation = {
      page: word.pageNumber,
      line: word.lineNumber,
      wordIndex: word.wordIndex,
      wordId: word.id,
    };
    if (!editStart || (editStart && editEnd)) {
      setEditStart(loc);
      setEditEnd(null);
    } else {
      setEditEnd(loc);
    }
  };

  const applyInlineEdit = () => {
    if (!editingStudentId || !editStart || !editEnd) return;
    const meta = getRangeMetadata(editStart, editEnd);
    const updatedRange: AssignmentRange = {
      start: editStart,
      end: editEnd,
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
    setCustomDrafts(prev => ({
      ...prev,
      [editingStudentId]: {
        range: updatedRange,
        basisLabel: 'Edited manually by Ustaad',
        isEdited: true,
      },
    }));
    setEditingStudentId(null);
  };

  const resetStudentPreview = (studentId: string) => {
    setCustomDrafts(prev => {
      const copy = { ...prev };
      delete copy[studentId];
      return copy;
    });
  };

  const updateNumericEndpoint = (
    studentId: string,
    endpoint: 'start' | 'end',
    pageNum: number,
    lineNum: number
  ) => {
    const curr = previews[studentId]?.range;
    if (!curr) return;
    const p = Math.max(1, Math.min(604, pageNum));
    const l = Math.max(1, Math.min(15, lineNum));
    const newStart = endpoint === 'start' ? getFirstWordOnOrAfter(p, l) : curr.start;
    const newEnd = endpoint === 'end' ? getLastWordOnOrBefore(p, l) : curr.end;
    const meta = getRangeMetadata(newStart, newEnd);
    setCustomDrafts(prev => ({
      ...prev,
      [studentId]: {
        range: {
          start: newStart,
          end: newEnd,
          linesCount: meta.linesCount,
          surahName: meta.surahName,
          juzNumber: meta.juzNumber,
          startPage: meta.startPage,
          endPage: meta.endPage,
          startLine: meta.startLine,
          endLine: meta.endLine,
          startAyah: meta.startAyah,
          endAyah: meta.endAyah,
        },
        basisLabel: 'Edited manually by Ustaad',
        isEdited: true,
      },
    }));
  };

  const handleConfirm = () => {
    const batch: Record<string, AssignmentRange> = {};
    selectedIds.forEach(id => {
      if (!pauseByStudent[id]?.isPaused && previews[id]?.range) {
        batch[id] = previews[id].range;
      }
    });
    if (Object.keys(batch).length === 0) return;
    onConfirmBatch(batch);
    onClose();
  };

  const editingStudent = editingStudentId
    ? students.find(s => s.id === editingStudentId) || null
    : null;
  const editMetadata =
    editStart && editEnd ? getRangeMetadata(editStart, editEnd) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start [@media(min-height:600px)]:items-center justify-center bg-black/65 backdrop-blur-xs p-2 md:p-4 overflow-y-auto">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-5xl [@media(min-height:600px)]:max-h-[94vh] flex flex-col [@media(min-height:600px)]:overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 border-b-2 border-[#C5A059] flex items-center justify-between bg-[#241811] text-[#FCFAF6]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-[#C5A059]" />
              <span>{t.assignByLinesTitle}</span>
            </h2>
            <p className="text-xs text-[#DFCFA8] mt-0.5">{t.assignByLinesDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-[#3E2B20] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If editing a specific student on Mushaf */}
        {editingStudent ? (
          <div className="flex-1 flex flex-col [@media(min-height:600px)]:overflow-hidden">
            <div className="px-5 py-3 bg-[#F8F4EC] border-b border-[#DFCFA8] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStudentId(null)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DFCFA8] bg-white hover:bg-[#F3ECE1] text-[#241811] text-xs font-bold cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Preview List</span>
                </button>
                <div className="text-xs">
                  <span className="font-bold text-[#241811]">
                    Editing preview for {editingStudent.name}:
                  </span>{' '}
                  <span className="text-[#7A6C60]">
                    Tap FIRST word, then LAST word on the Mushaf.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editMetadata && (
                  <span className="bg-[#EBF3EE] border border-[#2E6A54] px-2.5 py-1 rounded-lg text-xs font-mono text-[#143429] font-bold">
                    {editMetadata.surahName} · P{editMetadata.startPage}:L{editMetadata.startLine} → P
                    {editMetadata.endPage}:L{editMetadata.endLine} ({editMetadata.linesCount} lines)
                  </span>
                )}
                <button
                  type="button"
                  disabled={!editStart || !editEnd}
                  onClick={applyInlineEdit}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#1F4E3D] hover:bg-[#16382C] text-white disabled:opacity-40 text-xs font-bold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Student Preview</span>
                </button>
              </div>
            </div>

            <div
              tabIndex={0}
              className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 bg-[#FAF6EF] bg-islamic-pattern block focus:outline-none"
            >
              <MushafViewer
                pageNumber={editPage}
                onPageChange={setEditPage}
                selectionStart={editStart}
                selectionEnd={editEnd}
                interactiveMode="assigning"
                onWordClick={handleEditWordClick}
                language={state.language}
                mushafLayout={editingStudent.mushafLayout || state.settings.mushafLayout || 'madinah'}
                onLayoutChange={l => onUpdateMushafSettings?.({ mushafLayout: l })}
                mushafScript={state.settings.mushafScript || 'indopak'}
                onScriptChange={s => onUpdateMushafSettings?.({ mushafScript: s })}
                highContrast={Boolean(state.settings.highContrastMushaf)}
                onToggleHighContrast={() =>
                  onUpdateMushafSettings?.({
                    highContrastMushaf: !state.settings.highContrastMushaf,
                  })
                }
              />
            </div>
          </div>
        ) : (
          <>
            {/* Controls Bar: Line count + Select All / Deselect All */}
            <div className="px-5 py-3.5 border-b border-[#DFCFA8] bg-[#F8F4EC] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold text-[#241811] flex items-center gap-2">
                  <span>{t.numberOfLinesLabel}</span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={linesInput}
                    onChange={e => setLinesInput(e.target.value)}
                    className="w-20 px-2.5 py-1.5 rounded-lg border border-[#C5A059] bg-white font-mono text-sm font-bold text-[#241811] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  />
                </label>

                <div className="flex items-center gap-1.5">
                  {[5, 8, 10, 15].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLinesInput(String(preset))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        parsedLines === preset
                          ? 'bg-[#241811] text-[#FCFAF6] border-[#C5A059]'
                          : 'bg-white text-[#42362E] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                      }`}
                    >
                      {preset}L
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-3 py-1.5 rounded-lg border border-[#DFCFA8] bg-white hover:bg-[#F3ECE1] text-xs font-bold text-[#241811] cursor-pointer"
                >
                  {t.selectAllStudents}
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="px-3 py-1.5 rounded-lg border border-[#DFCFA8] bg-white hover:bg-[#F3ECE1] text-xs font-bold text-[#5A4333] cursor-pointer"
                >
                  {t.deselectAllStudents}
                </button>
              </div>
            </div>

            {/* Preview List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {students.map(student => {
                const pauseStatus = pauseByStudent[student.id];
                const isPaused = Boolean(pauseStatus?.isPaused);
                const isSelected = !isPaused && selectedIds.has(student.id);
                const preview = previews[student.id];
                const existingSabaq =
                  state.dailyPlans[student.id]?.[state.currentDate]?.sabaq?.range;

                return (
                  <div
                    key={student.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isPaused
                        ? 'bg-[#FDF2F2]/75 border-[#B91C1C]/40 opacity-90'
                        : isSelected
                        ? 'bg-white border-[#C5A059] shadow-xs'
                        : 'bg-[#F5F1E9] border-[#E2D8C5] opacity-65'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Checkbox + Student Identity + Basis */}
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={() => toggleStudent(student.id)}
                          className={`mt-0.5 shrink-0 ${
                            isPaused
                              ? 'text-[#B91C1C]/50 cursor-not-allowed'
                              : 'text-[#1F4E3D] cursor-pointer'
                          }`}
                          aria-label={`Toggle ${student.name}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-[#1F4E3D]" />
                          ) : (
                            <Square className="w-5 h-5 text-[#A69888]" />
                          )}
                        </button>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-[#241811]">
                              {state.language === 'ur' ? student.urduName : student.name}
                            </span>
                            <StudentTypeBadge
                              type={student.studentType || 'hifz'}
                              language={state.language}
                              size="xs"
                            />
                            <span className="text-[11px] font-medium text-[#5A4333] bg-[#F8F4EC] px-2 py-0.5 rounded border border-[#DFCFA8]">
                              Para {student.currentJuz}
                            </span>
                            {isPaused ? (
                              <span className="text-[11px] font-bold text-[#7F1D1D] bg-[#FEE2E2] border border-[#B91C1C]/50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-[#B91C1C]" />
                                <span>{t.skippedRevisionRepeatPending}</span>
                              </span>
                            ) : existingSabaq ? (
                              <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded">
                                Today already has P{existingSabaq.start.page}:L{existingSabaq.start.line}–P
                                {existingSabaq.end.page}:L{existingSabaq.end.line} (will replace if confirmed)
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-[#7A6C60]">
                                {t.sabaqNotAssignedYet}
                              </span>
                            )}
                          </div>

                          <div
                            className={`text-[11px] mt-1 ${
                              isPaused ? 'text-[#991B1B] font-semibold' : 'text-[#7A6C60]'
                            }`}
                          >
                            {isPaused
                              ? `${pauseStatus.detailedReasons.join(' ')} (${pauseStatus.reasons.join(' · ')})`
                              : preview.basisLabel}
                          </div>
                        </div>
                      </div>

                      {/* Right: Preview Range + Edit actions (hidden when paused/skipped) */}
                      {isPaused ? (
                        <div className="px-3 py-1.5 rounded-xl bg-[#FEE2E2] border border-[#B91C1C]/40 text-xs font-bold text-[#7F1D1D] shrink-0">
                          {t.skippedRevisionRepeatPending}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2.5 justify-end">
                          <div className="bg-[#EBF3EE] border border-[#2E6A54]/60 px-3 py-1.5 rounded-xl text-xs font-mono text-[#143429]">
                            <div className="font-bold">
                              {preview.range.surahName} · P{preview.range.start.page}:L
                              {preview.range.start.line} → P{preview.range.end.page}:L
                              {preview.range.end.line}
                            </div>
                            <div className="text-[10px] text-[#1F4E3D]">
                              {preview.range.linesCount} lines
                              {preview.range.startAyah && preview.range.endAyah
                                ? ` · Ayat ${preview.range.startAyah}–${preview.range.endAyah}`
                                : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openMushafEditForStudent(student.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#C5A059] bg-[#F8F4EC] hover:bg-[#F3ECE1] text-[#241811] text-xs font-bold cursor-pointer"
                              title="Pick exact first and last word on Mushaf"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#8F6E2B]" />
                              <span>{t.editRangeButton}</span>
                            </button>

                            {preview.isEdited && (
                              <button
                                type="button"
                                onClick={() => resetStudentPreview(student.id)}
                                className="p-1.5 rounded-lg border border-[#DFCFA8] bg-white hover:bg-[#F3ECE1] text-[#7A6C60] cursor-pointer"
                                title="Reset to computed lines"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick inline Page/Line fine-tuning inputs */}
                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-[#ECE4D5] flex flex-wrap items-center gap-2 text-[11px] text-[#5A4333]">
                        <Edit3 className="w-3.5 h-3.5 text-[#8F6E2B]" />
                        <span>Quick adjust:</span>
                        <span>Start P</span>
                        <input
                          type="number"
                          min={1}
                          max={604}
                          value={preview.range.start.page}
                          onChange={e =>
                            updateNumericEndpoint(
                              student.id,
                              'start',
                              parseInt(e.target.value, 10) || 1,
                              preview.range.start.line
                            )
                          }
                          className="w-14 px-1.5 py-0.5 border border-[#DFCFA8] rounded bg-[#FAF6EF] font-mono text-center"
                        />
                        <span>L</span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={preview.range.start.line}
                          onChange={e =>
                            updateNumericEndpoint(
                              student.id,
                              'start',
                              preview.range.start.page,
                              parseInt(e.target.value, 10) || 1
                            )
                          }
                          className="w-12 px-1.5 py-0.5 border border-[#DFCFA8] rounded bg-[#FAF6EF] font-mono text-center"
                        />
                        <span className="text-[#C5A059] font-bold">→</span>
                        <span>End P</span>
                        <input
                          type="number"
                          min={1}
                          max={604}
                          value={preview.range.end.page}
                          onChange={e =>
                            updateNumericEndpoint(
                              student.id,
                              'end',
                              parseInt(e.target.value, 10) || 1,
                              preview.range.end.line
                            )
                          }
                          className="w-14 px-1.5 py-0.5 border border-[#DFCFA8] rounded bg-[#FAF6EF] font-mono text-center"
                        />
                        <span>L</span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={preview.range.end.line}
                          onChange={e =>
                            updateNumericEndpoint(
                              student.id,
                              'end',
                              preview.range.end.page,
                              parseInt(e.target.value, 10) || 1
                            )
                          }
                          className="w-12 px-1.5 py-0.5 border border-[#DFCFA8] rounded bg-[#FAF6EF] font-mono text-center"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer: Nothing is saved until Confirm */}
            <div className="px-5 py-3.5 border-t border-[#DFCFA8] bg-[#FCFAF6] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#7A6C60]">
                Nothing is saved until you tap Confirm. ({selectedIds.size} of {students.length}{' '}
                students selected
                {skippedCount > 0 ? ` · ${skippedCount} ${t.skippedRevisionRepeatPending}` : ''})
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#DFCFA8] rounded-xl text-[#42362E] hover:bg-[#F3ECE1] text-xs md:text-sm font-semibold cursor-pointer"
                >
                  {t.close}
                </button>
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onClick={handleConfirm}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1F4E3D] hover:bg-[#16382C] text-white border border-[#C5A059] disabled:opacity-40 text-xs md:text-sm font-bold shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#DFCFA8]" />
                  <span>
                    {t.confirmAssignSelected} ({selectedIds.size})
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
