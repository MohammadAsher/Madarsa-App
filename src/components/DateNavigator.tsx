/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftIsoDate } from '../services/dateService';

interface DateNavigatorProps {
  selectedDate: string;
  todayDate: string;
  onChangeDate: (date: string) => void;
  language: 'en' | 'ur';
  compact?: boolean;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  selectedDate,
  todayDate,
  onChangeDate,
  language,
  compact = false,
}) => {
  const isToday = selectedDate >= todayDate;
  const isPast = selectedDate < todayDate;

  const handlePrevDay = () => {
    const prev = shiftIsoDate(selectedDate, -1);
    onChangeDate(prev > todayDate ? todayDate : prev);
  };

  const handleNextDay = () => {
    if (isToday) return;
    const next = shiftIsoDate(selectedDate, 1);
    onChangeDate(next > todayDate ? todayDate : next);
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    onChangeDate(val > todayDate ? todayDate : val);
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <div
        className={`inline-flex items-center rounded-xl border bg-[#FAF6EF] shadow-2xs ${
          isPast ? 'border-[#C5A059]' : 'border-[#DFCFA8]'
        } ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`}
      >
        <button
          type="button"
          onClick={handlePrevDay}
          className="p-1 rounded-lg text-[#42362E] hover:bg-[#F3ECE1] hover:text-[#241811] transition-colors cursor-pointer"
          title={language === 'ur' ? 'پچھلا دن' : 'Previous day'}
          aria-label="Previous day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <label className="inline-flex items-center gap-1 px-1 text-xs font-mono font-bold text-[#241811] cursor-pointer">
          <Calendar className="w-3.5 h-3.5 text-[#8F6E2B] shrink-0" />
          <input
            type="date"
            max={todayDate}
            value={selectedDate}
            onChange={handleDateInput}
            aria-label={language === 'ur' ? 'تاریخ منتخب کریں' : 'Select date'}
            className="bg-transparent text-xs font-mono font-bold text-[#241811] focus:outline-none cursor-pointer"
          />
        </label>

        <button
          type="button"
          onClick={handleNextDay}
          disabled={isToday}
          className="p-1 rounded-lg text-[#42362E] hover:bg-[#F3ECE1] hover:text-[#241811] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title={language === 'ur' ? 'اگلا دن' : 'Next day'}
          aria-label="Next day"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isPast && (
        <button
          type="button"
          onClick={() => onChangeDate(todayDate)}
          className="text-xs font-semibold text-[#1F4E3D] hover:text-[#241811] underline underline-offset-2 cursor-pointer px-1"
        >
          {language === 'ur' ? 'آج پر واپس جائیں' : 'Back to today'}
        </button>
      )}
    </div>
  );
};
