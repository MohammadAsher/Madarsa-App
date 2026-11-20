/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { getParaPageRange, getParaSurahName } from '../data/quranData';

export interface ParaProgressGridProps {
  completedParas: number[];
  currentJuz: number;
  manzilAssignedParas: number[];
  manzilRepeatParas?: Record<number, string>;
  currentDate: string;
  language: 'en' | 'ur';
  manzilDuePrefix: string;
  repeatPrefix?: string;
  previewParaNum?: number | null;
  onTapPara?: (paraNum: number) => void;
  compact?: boolean;
  isNazra?: boolean;
  mushafLayout?: 'hafizi' | 'madinah';
}

export const ParaProgressGrid: React.FC<ParaProgressGridProps> = ({
  completedParas,
  currentJuz,
  manzilAssignedParas,
  manzilRepeatParas = {},
  currentDate,
  language,
  manzilDuePrefix,
  repeatPrefix,
  previewParaNum = null,
  onTapPara,
  compact = false,
  isNazra = false,
  mushafLayout = 'madinah',
}) => {
  const isUr = language === 'ur';
  const repeatLabel = repeatPrefix || (isUr ? 'دہرائیں' : 'Repeat');

  const [activeTooltipPara, setActiveTooltipPara] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleTouchStart = (paraNum: number) => {
    clearTimers();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setActiveTooltipPara(paraNum);
      autoHideTimerRef.current = setTimeout(() => {
        setActiveTooltipPara(curr => (curr === paraNum ? null : curr));
      }, 2800);
    }, 400);
  };

  const handleTouchEndOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={`grid grid-cols-6 min-[420px]:grid-cols-7 sm:grid-cols-8 lg:grid-cols-15 gap-1.5 ${
          compact ? 'max-w-[660px]' : 'max-w-[680px]'
        }`}
      >
        {Array.from({ length: 30 }, (_, i) => i + 1).map(paraNum => {
          const isCompleted = completedParas.includes(paraNum);
          const isCurrent = currentJuz === paraNum && !isCompleted;
          const isManzilDue = !isNazra && manzilAssignedParas.includes(paraNum);
          const repeatDate = !isNazra ? manzilRepeatParas[paraNum] : undefined;
          const isManzilRepeat = !isNazra && !isManzilDue && Boolean(repeatDate);
          const isPreviewing = previewParaNum === paraNum;
          const { startPage, endPage } = getParaPageRange(paraNum, mushafLayout);
          const surahName = getParaSurahName(paraNum);

          // Color states (unchanged):
          // 1. Manzil due -> Amber (#F59E0B)
          // 2. Repeat -> Red (#B91C1C)
          // 3. Completed -> Green (#1F4E3D) or Nazra Blue (#16365D)
          // 4. Current para -> White (#FFFFFF)
          // 5. Not started -> Grey (#E5E7EB)
          let tileColorClasses =
            'bg-[#E5E7EB] text-[#374151] border-[#D1D5DB] hover:bg-[#D1D5DB]/80';
          if (isManzilDue) {
            tileColorClasses =
              'bg-[#F59E0B] text-[#1C120C] border-2 border-[#B45309] hover:bg-[#D97706] shadow-xs';
          } else if (isManzilRepeat) {
            tileColorClasses =
              'bg-[#B91C1C] text-white border-2 border-[#7F1D1D] hover:bg-[#991B1B] shadow-xs';
          } else if (isCompleted) {
            tileColorClasses = isNazra
              ? 'bg-[#16365D] text-white border-[#C5A059] hover:bg-[#102946] shadow-2xs'
              : 'bg-[#1F4E3D] text-white border-[#C5A059] hover:bg-[#16382C] shadow-2xs';
          } else if (isCurrent) {
            tileColorClasses =
              'bg-white text-[#241811] border-2 border-[#C5A059] hover:bg-[#FAF6EF] shadow-2xs';
          }

          let statusText = isUr ? 'شروع نہیں ہوا' : 'Not started';
          let tooltipStatusColor = 'text-[#D1D5DB]';
          if (isManzilDue) {
            statusText = `${manzilDuePrefix}: ${currentDate}`;
            tooltipStatusColor = 'text-[#FCD34D]';
          } else if (isManzilRepeat && repeatDate) {
            statusText = `${repeatLabel}: ${repeatDate}`;
            tooltipStatusColor = 'text-[#FCA5A5]';
          } else if (isCompleted) {
            statusText = isNazra
              ? isUr
                ? 'ناظرہ مکمل'
                : 'Read in Nazra'
              : isUr
              ? 'مکمل شدہ'
              : 'Completed';
            tooltipStatusColor = 'text-[#86EFAC]';
          } else if (isCurrent) {
            statusText = isUr ? 'موجودہ پارہ' : 'Current para';
            tooltipStatusColor = 'text-[#FDE68A]';
          }

          const nativeTitle = `${
            isUr ? `پارہ ${paraNum}` : `Para ${paraNum}`
          } (${surahName}) · ${
            isUr ? `صفحات ${startPage}–${endPage}` : `Pages ${startPage}–${endPage}`
          } · ${statusText}`;

          const isTooltipOpen = activeTooltipPara === paraNum;
          const placeBelow = paraNum <= 15;
          const alignClass =
            paraNum % 6 === 1 || paraNum % 15 === 1
              ? 'left-0'
              : paraNum % 6 === 0 || paraNum % 15 === 0 || paraNum % 6 === 5
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2';

          return (
            <div key={paraNum} className="relative">
              <button
                type="button"
                aria-label={nativeTitle}
                title={nativeTitle}
                onClick={e => {
                  if (longPressTriggeredRef.current) {
                    e.preventDefault();
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  setActiveTooltipPara(null);
                  onTapPara?.(paraNum);
                }}
                onPointerEnter={e => {
                  if (e.pointerType !== 'touch') {
                    setActiveTooltipPara(paraNum);
                  }
                }}
                onPointerLeave={e => {
                  if (e.pointerType !== 'touch') {
                    setActiveTooltipPara(curr => (curr === paraNum ? null : curr));
                  }
                }}
                onFocus={() => setActiveTooltipPara(paraNum)}
                onBlur={() => setActiveTooltipPara(curr => (curr === paraNum ? null : curr))}
                onTouchStart={() => handleTouchStart(paraNum)}
                onTouchMove={handleTouchEndOrCancel}
                onTouchCancel={handleTouchEndOrCancel}
                onTouchEnd={handleTouchEndOrCancel}
                onContextMenu={e => {
                  if (longPressTriggeredRef.current) {
                    e.preventDefault();
                  }
                }}
                disabled={!onTapPara}
                className={`w-full min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] sm:h-9 rounded-lg border text-center transition-all flex flex-col items-center justify-center relative select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#241811] ${
                  onTapPara ? 'cursor-pointer' : 'cursor-default'
                } ${tileColorClasses} ${
                  isPreviewing ? 'scale-[1.04] ring-2 ring-[#241811]' : ''
                }`}
              >
                <span className="text-xs font-bold tabular-nums leading-none">
                  {paraNum}
                </span>

                {!isManzilDue && !isManzilRepeat && isCurrent && (
                  <span className="text-[7px] font-extrabold tracking-tight leading-none text-[#8F6E2B] mt-0.5">
                    {isUr ? 'موجودہ' : 'Current'}
                  </span>
                )}

                {isManzilDue && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#1C120C] text-[#FDE68A] border border-[#F59E0B] text-[8px] font-black leading-none flex items-center justify-center shadow-2xs"
                  >
                    {isUr ? 'م' : 'M'}
                  </span>
                )}

                {isManzilRepeat && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FEF2F2] text-[#7F1D1D] border border-[#7F1D1D] text-[8px] font-black leading-none flex items-center justify-center shadow-2xs"
                  >
                    {isUr ? 'د' : 'R'}
                  </span>
                )}
              </button>

              {isTooltipOpen && (
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute z-40 ${
                    placeBelow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                  } ${alignClass} px-2.5 py-1.5 rounded-lg bg-[#241811] text-[#FCFAF6] border border-[#C5A059] shadow-lg text-[10px] leading-snug whitespace-nowrap`}
                >
                  <div className="font-bold text-[#DFCFA8]">
                    {isUr ? `پارہ ${paraNum}` : `Para ${paraNum}`} · {surahName}
                  </div>
                  <div className="font-mono text-[#FCFAF6]/90">
                    {isUr ? `صفحات ${startPage}–${endPage}` : `Pages ${startPage}–${endPage}`}
                  </div>
                  <div className={`font-bold mt-0.5 ${tooltipStatusColor}`}>{statusText}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Single-line Compact Colour Legend */}
      <div className="flex items-center gap-x-2.5 sm:gap-x-3.5 pt-0.5 text-[10px] sm:text-[11px] text-[#42362E] overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`w-2.5 h-2.5 rounded-xs border border-[#C5A059] inline-block shrink-0 ${
              isNazra ? 'bg-[#16365D]' : 'bg-[#1F4E3D]'
            }`}
          />
          <span className="font-medium">
            {isNazra
              ? isUr
                ? 'نیلا = ناظرہ مکمل'
                : 'Blue = Read in Nazra'
              : isUr
              ? 'سبز = مکمل'
              : 'Green = Completed'}
          </span>
        </div>
        {!isNazra && (
          <>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B] border border-[#B45309] inline-block shrink-0" />
              <span className="font-semibold text-[#78350F]">
                {isUr ? 'عنبری (م) = منزل' : 'Amber (M) = Manzil due'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#B91C1C] border border-[#7F1D1D] inline-block shrink-0" />
              <span className="font-semibold text-[#991B1B]">
                {isUr ? 'سرخ (د) = دہرائیں' : 'Red (R) = Repeat'}
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-xs bg-white border border-[#C5A059] inline-block shrink-0" />
          <span className="font-medium">{isUr ? 'سفید = موجودہ' : 'White = Current para'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#E5E7EB] border border-[#9CA3AF] inline-block shrink-0" />
          <span className="font-medium">{isUr ? 'سرمئی = باقی' : 'Grey = Not started'}</span>
        </div>
      </div>
    </div>
  );
};
