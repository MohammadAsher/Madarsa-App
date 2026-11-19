/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { X, BookOpen, BookmarkCheck, Play, SlidersHorizontal } from 'lucide-react';
import { MadrasaState, StudentProfile } from '../types/hifz';
import { MushafViewer } from './MushafViewer';
import { StudentTypeBadge } from './StudentTypeBadge';
import { getParaPageRange, getParaSurahName } from '../data/quranData';
import {
  computeManzilParaStates,
  getFullParaRange,
  getValidatedManzilParasForStudent,
  isWholeParaManzilPlan,
} from '../services/hifzService';
import { translations } from '../i18n/translations';

interface UstaadParaMushafModalProps {
  state: MadrasaState;
  student: StudentProfile;
  initialPara: number;
  targetDate: string;
  onClose: () => void;
  onListenManzil?: (student: StudentProfile, targetDate: string) => void;
  onAssignManzil?: (student: StudentProfile, paraNum: number, targetDate: string) => void;
  onUpdateMushafSettings?: (patch: {
    mushafLayout?: 'hafizi' | 'madinah';
    mushafScript?: 'indopak' | 'uthmani';
    highContrastMushaf?: boolean;
  }) => void;
}

export const UstaadParaMushafModal: React.FC<UstaadParaMushafModalProps> = ({
  state,
  student,
  initialPara,
  targetDate,
  onClose,
  onListenManzil,
  onAssignManzil,
  onUpdateMushafSettings,
}) => {
  const t = translations[state.language];
  const isUr = state.language === 'ur';
  const isNazra = student.studentType === 'nazra';
  const activeLayout = student.mushafLayout || state.settings.mushafLayout || 'madinah';

  const dayPlan = state.dailyPlans[student.id]?.[targetDate];
  const manzilPlan = dayPlan?.manzil;
  const completedSet = useMemo(() => new Set(student.completedParas || []), [student.completedParas]);
  const manzilState = useMemo(
    () =>
      isNazra
        ? { dueParas: [], repeatParas: {} as Record<number, string> }
        : computeManzilParaStates(student, state, targetDate),
    [isNazra, student, state, targetDate]
  );

  const planManzilParas = useMemo(
    () =>
      isNazra
        ? []
        : getValidatedManzilParasForStudent(student, manzilPlan),
    [isNazra, student, manzilPlan]
  );

  const isManzilDueTapped = !isNazra && completedSet.has(initialPara) && manzilState.dueParas.includes(initialPara);
  const isManzilRepeatTapped =
    !isNazra &&
    completedSet.has(initialPara) &&
    !isManzilDueTapped &&
    Boolean(manzilState.repeatParas[initialPara]);
  const isInAssignedManzil =
    !isNazra && completedSet.has(initialPara) && planManzilParas.includes(initialPara);
  const isManzilMode = isManzilDueTapped || isManzilRepeatTapped || isInAssignedManzil;

  // For Manzil mode: order assigned/repeat completed Manzil paras with the tapped para FIRST so user can switch between others
  const orderedManzilParas = useMemo(() => {
    if (!isManzilMode) return [];
    const repeatNums = Object.keys(manzilState.repeatParas)
      .map(k => parseInt(k, 10))
      .filter(n => !Number.isNaN(n) && completedSet.has(n));
    const pool = Array.from(
      new Set([
        initialPara,
        ...manzilState.dueParas,
        ...planManzilParas,
        ...(isManzilRepeatTapped ? repeatNums : []),
      ])
    ).filter(p => p >= 1 && p <= 30 && completedSet.has(p));
    const others = pool.filter(p => p !== initialPara).sort((a, b) => a - b);
    return [initialPara, ...others];
  }, [
    initialPara,
    isManzilMode,
    isManzilRepeatTapped,
    manzilState.dueParas,
    manzilState.repeatParas,
    planManzilParas,
    completedSet,
  ]);

  const isCustomSubRangeInitial =
    isManzilMode &&
    Boolean(manzilPlan?.range) &&
    !isWholeParaManzilPlan(manzilPlan) &&
    planManzilParas.includes(initialPara);

  const [activePara, setActivePara] = useState<number>(initialPara);
  const [pageNumber, setPageNumber] = useState<number>(() =>
    isCustomSubRangeInitial && manzilPlan?.range
      ? manzilPlan.range.start.page
      : getParaPageRange(initialPara, activeLayout).startPage
  );

  const handleSelectPara = (paraNum: number) => {
    setActivePara(paraNum);
    setPageNumber(getParaPageRange(paraNum, activeLayout).startPage);
  };

  const isCustomSubRangeActive =
    isManzilMode &&
    Boolean(manzilPlan?.range) &&
    !isWholeParaManzilPlan(manzilPlan) &&
    planManzilParas.includes(activePara);

  const activeRange = useMemo(() => getFullParaRange(activePara), [activePara]);
  const activeParaRangeInfo = getParaPageRange(activePara, activeLayout);

  const getTileBadgeLabel = (pNum: number) => {
    if (isNazra) {
      return student.nazraCompletedParas?.includes(pNum)
        ? isUr
          ? 'ناظرہ مکمل'
          : 'Read in Nazra'
        : pNum === student.currentJuz
        ? isUr
          ? 'موجودہ پارہ'
          : 'Current Para'
        : isUr
        ? 'شروع نہیں ہوا'
        : 'Not Started';
    }
    if (completedSet.has(pNum) && manzilState.dueParas.includes(pNum)) {
      return `${t.manzilDuePrefix}: ${targetDate}`;
    }
    if (completedSet.has(pNum) && manzilState.repeatParas[pNum]) {
      return `${t.repeatPrefix}: ${manzilState.repeatParas[pNum]}`;
    }
    if (completedSet.has(pNum)) {
      return isUr ? 'مکمل شدہ' : 'Completed';
    }
    if (pNum === student.currentJuz) {
      return isUr ? 'موجودہ پارہ' : 'Current Para';
    }
    return isUr ? 'شروع نہیں ہوا' : 'Not Started';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start [@media(min-height:600px)]:items-center justify-center bg-black/65 backdrop-blur-xs p-1 sm:p-4 overflow-y-auto">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-5xl [@media(min-height:600px)]:max-h-[95vh] flex flex-col [@media(min-height:600px)]:overflow-hidden my-auto">
        {/* Modal Header */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-b-2 border-[#C5A059] flex items-center justify-between gap-3 ${
            isManzilMode ? 'bg-[#1F4E3D] text-[#FCFAF6]' : 'bg-[#241811] text-[#FCFAF6]'
          }`}
        >
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-2">
              {isManzilMode ? (
                <BookmarkCheck className="w-5 h-5 text-[#F59E0B] shrink-0" />
              ) : (
                <BookOpen className="w-5 h-5 text-[#C5A059] shrink-0" />
              )}
              <span>
                {isManzilMode
                  ? isUr
                    ? `منزل موڈ · پارہ ${activePara}`
                    : `Manzil Mode · Para ${activePara}`
                  : isUr
                  ? `پارہ ${activePara} کا معائنہ`
                  : `Para ${activePara} on Mushaf`}
              </span>
              <span className="text-xs font-mono bg-[#FCFAF6]/15 border border-[#C5A059]/60 px-2 py-0.5 rounded">
                P{activeParaRangeInfo.startPage}–{activeParaRangeInfo.endPage}
              </span>
            </h2>

            <div className="text-xs text-[#DFCFA8] mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-white">
                {isUr ? student.urduName : student.name}
              </span>
              <StudentTypeBadge
                type={student.studentType || 'hifz'}
                language={state.language}
                size="xs"
              />
              <span>· {getParaSurahName(activePara)} ·</span>
              <span className="px-1.5 py-0.5 rounded bg-black/25 text-[#FAF3E3] font-semibold">
                {getTileBadgeLabel(activePara)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isManzilMode && manzilPlan?.range && planManzilParas.length > 0 && onListenManzil && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onListenManzil(student, targetDate);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C5A059] hover:bg-[#DFCFA8] text-[#241811] text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t.listenAndMark}</span>
              </button>
            )}
            {!isNazra && completedSet.size > 0 && onAssignManzil && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAssignManzil(student, activePara, targetDate);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#241811]/80 hover:bg-[#241811] border border-[#C5A059]/70 text-[#FAF3E3] text-xs font-bold cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>{isUr ? 'منزل مقرر / تبدیل کریں' : 'Assign Manzil'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-black/25 rounded-xl transition-colors cursor-pointer"
              aria-label={t.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Manzil Multi-Para Switcher Bar (shows tapped para first, allows switching between assigned/repeat paras) */}
        {isManzilMode && orderedManzilParas.length > 0 && (
          <div className="px-4 sm:px-5 py-2.5 border-b border-[#DFCFA8] bg-[#F8F4EC] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-bold text-[#241811] mr-1">
                {isUr ? 'منزل کے پارے:' : 'Manzil Paras:'}
              </span>
              {orderedManzilParas.map(pNum => {
                const isSelected = activePara === pNum;
                const pRange = getParaPageRange(pNum, activeLayout);
                const isDue = manzilState.dueParas.includes(pNum);
                const repDate = manzilState.repeatParas[pNum];
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => handleSelectPara(pNum)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#241811] text-[#FCFAF6] border-[#C5A059] shadow-xs ring-1 ring-[#C5A059]'
                        : repDate
                        ? 'bg-[#FEE2E2] text-[#7F1D1D] border-[#B91C1C]/50 hover:bg-[#FECACA]'
                        : isDue
                        ? 'bg-[#FEF3C7] text-[#78350F] border-[#D97706]/60 hover:bg-[#FDE68A]'
                        : 'bg-white text-[#1F4E3D] border-[#DFCFA8] hover:bg-[#F3ECE1]'
                    }`}
                  >
                    <span>{isUr ? `پارہ ${pNum}` : `Para ${pNum}`}</span>
                    <span className="font-mono text-[10px] opacity-80">
                      P{pRange.startPage}
                    </span>
                    {isDue && (
                      <span className="px-1 py-0.2 rounded bg-[#F59E0B] text-[#1C120C] text-[9px] font-extrabold">
                        Due
                      </span>
                    )}
                    {!isDue && repDate && (
                      <span className="px-1 py-0.2 rounded bg-[#B91C1C] text-white text-[9px] font-extrabold">
                        {t.repeatPrefix}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <span className="text-[11px] font-mono text-[#5A4333]">
              {activeRange.linesCount} {t.linesCount}
            </span>
          </div>
        )}

        {/* Mushaf Viewer Canvas */}
        <div
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto p-1.5 sm:p-3 bg-[#FAF6EF] bg-islamic-pattern block focus:outline-none"
        >
          <MushafViewer
            pageNumber={pageNumber}
            onPageChange={setPageNumber}
            highlightRange={isCustomSubRangeActive && manzilPlan?.range ? manzilPlan.range : undefined}
            highlightRanges={undefined}
            manzilHeaderPara={isManzilMode && !isCustomSubRangeActive ? activePara : null}
            activeParaNumber={activePara}
            interactiveMode="view"
            language={state.language}
            mushafLayout={activeLayout}
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

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#DFCFA8] bg-[#FCFAF6] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isManzilMode && manzilPlan?.range && planManzilParas.length > 0 && onListenManzil && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onListenManzil(student, targetDate);
                }}
                className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C5A059] text-[#241811] text-xs font-bold cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t.listenAndMark}</span>
              </button>
            )}
            {!isNazra && completedSet.size > 0 && onAssignManzil && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAssignManzil(student, activePara, targetDate);
                }}
                className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F4EC] border border-[#DFCFA8] text-[#241811] text-xs font-bold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#8F6E2B]" />
                <span>{isUr ? 'منزل مقرر کریں' : 'Assign Manzil'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 border border-[#DFCFA8] rounded-xl text-[#42362E] hover:bg-[#F3ECE1] text-xs md:text-sm font-semibold transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
