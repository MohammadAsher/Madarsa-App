/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { getParaPageRange, getParaSurahName } from '../data/quranData';

export interface ParaProgressGridProps {
  completedParas: number[];
  currentJuz: number;
  manzilAssignedParas: number[];
  currentDate: string;
  language: 'en' | 'ur';
  manzilDuePrefix: string;
  previewParaNum?: number | null;
  onTapPara?: (paraNum: number) => void;
  compact?: boolean;
  isNazra?: boolean;
}

export const ParaProgressGrid: React.FC<ParaProgressGridProps> = ({
  completedParas,
  currentJuz,
  manzilAssignedParas,
  currentDate,
  language,
  manzilDuePrefix,
  previewParaNum = null,
  onTapPara,
  compact = false,
  isNazra = false,
}) => {
  const isUr = language === 'ur';

  return (
    <div className="space-y-3">
      <div
        className={
          compact
            ? 'grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-1.5'
            : 'grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2'
        }
      >
        {Array.from({ length: 30 }, (_, i) => i + 1).map(paraNum => {
          const isCompleted = completedParas.includes(paraNum);
          const isCurrent = currentJuz === paraNum && !isCompleted;
          const isManzilDue = !isNazra && manzilAssignedParas.includes(paraNum);
          const isPreviewing = previewParaNum === paraNum;
          const { startPage, endPage } = getParaPageRange(paraNum);

          // Color states:
          // 1. Manzil due (Hifz only) -> solid amber/orange fill (#F59E0B) with dark text (#1C120C)
          // 2. Completed -> dark green (#1F4E3D) (or deep blue #16365D in Nazra) with white text
          // 3. Current para -> white (#FFFFFF) with dark brown text (#241811)
          // 4. Not started -> grey (#E5E7EB) with charcoal text (#4B5563)
          let tileColorClasses =
            'bg-[#E5E7EB] text-[#4B5563] border-[#D1D5DB] hover:bg-[#D1D5DB]/80';
          if (isManzilDue) {
            tileColorClasses =
              'bg-[#F59E0B] text-[#1C120C] border-2 border-[#B45309] hover:bg-[#D97706] shadow-md';
          } else if (isCompleted) {
            tileColorClasses = isNazra
              ? 'bg-[#16365D] text-white border-[#C5A059] hover:bg-[#102946] shadow-xs'
              : 'bg-[#1F4E3D] text-white border-[#C5A059] hover:bg-[#16382C] shadow-xs';
          } else if (isCurrent) {
            tileColorClasses =
              'bg-white text-[#241811] border-2 border-[#C5A059] hover:bg-[#FAF6EF] shadow-2xs';
          }

          return (
            <button
              key={paraNum}
              type="button"
              onClick={() => onTapPara?.(paraNum)}
              disabled={!onTapPara}
              className={`rounded-xl border text-center transition-all flex flex-col items-center justify-center relative ${
                compact ? 'p-1.5 min-h-[58px]' : 'p-2 min-h-[70px]'
              } ${onTapPara ? 'cursor-pointer' : 'cursor-default'} ${tileColorClasses} ${
                isPreviewing ? 'scale-[1.03] ring-2 ring-[#241811]' : ''
              }`}
              title={`Para ${paraNum} (${getParaSurahName(paraNum)}, Pages ${startPage}–${endPage})`}
            >
              <span className={compact ? 'text-[11px] font-bold leading-tight' : 'text-xs font-bold leading-tight'}>
                {isUr ? `پارہ ${paraNum}` : `Para ${paraNum}`}
              </span>
              <span
                className={`font-mono leading-tight mt-0.5 ${
                  compact ? 'text-[9px]' : 'text-[10px]'
                } ${isManzilDue ? 'text-[#241811] font-semibold' : 'opacity-85'}`}
              >
                P{startPage}–{endPage}
              </span>

              {isManzilDue && (
                <span className="mt-1 px-1.5 py-0.5 rounded bg-[#FFFBEB] border border-[#B45309]/50 text-[#78350F] text-[9px] font-extrabold leading-tight break-words max-w-full">
                  {manzilDuePrefix}: {currentDate}
                </span>
              )}
              {!isManzilDue && isCurrent && (
                <span className="mt-1 px-1.5 py-0.5 rounded bg-[#F3ECE1] border border-[#C5A059]/60 text-[#241811] text-[9px] font-bold leading-tight">
                  {isUr ? 'موجودہ' : 'Current'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Colour Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-[#42362E]">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-3.5 h-3.5 rounded border border-[#C5A059] inline-block shrink-0 ${
              isNazra ? 'bg-[#16365D]' : 'bg-[#1F4E3D]'
            }`}
          />
          <span className="font-medium">
            {isNazra
              ? isUr
                ? 'نیلا = ناظرہ مکمل'
                : 'Blue = Read in Nazra'
              : isUr
              ? 'سبز = مکمل شدہ'
              : 'Green = Completed'}
          </span>
        </div>
        {!isNazra && (
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#F59E0B] border border-[#B45309] inline-block shrink-0" />
            <span className="font-semibold text-[#78350F]">
              {isUr ? 'عنبری (نارنجی) = منزل مقرر' : 'Amber = Manzil due'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-white border border-[#C5A059] inline-block shrink-0" />
          <span className="font-medium">{isUr ? 'سفید = موجودہ پارہ' : 'White = Current para'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-[#E5E7EB] border border-[#9CA3AF] inline-block shrink-0" />
          <span className="font-medium">{isUr ? 'سرمئی = شروع نہیں ہوا' : 'Grey = Not started'}</span>
        </div>
      </div>
    </div>
  );
};
