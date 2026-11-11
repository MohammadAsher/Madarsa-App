/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, 
  UserCheck, 
  Calendar, 
  RotateCcw, 
  Languages, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History
} from 'lucide-react';
import { MadrasaState, RoleId } from '../types/hifz';
import { translations } from '../i18n/translations';
import { getAllRecordedDates } from '../services/storageService';

interface HeaderProps {
  state: MadrasaState;
  onSelectRole: (role: RoleId) => void;
  onToggleLanguage: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onSelectDate: (date: string) => void;
  onResetDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  onSelectRole,
  onToggleLanguage,
  onPrevDay,
  onNextDay,
  onSelectDate,
  onResetDemo,
}) => {
  const t = translations[state.language];
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);

  const getRoleDisplayName = (roleId: RoleId) => {
    return t.roles[roleId] || roleId;
  };

  const recordedDates = getAllRecordedDates(state);
  const latestRecordedDate = recordedDates[recordedDates.length - 1];
  const isViewingHistorical = state.currentDate < latestRecordedDate;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-2xs">
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Zone 1: Brand Title (One line) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-800 text-amber-300 flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-stone-900 text-base md:text-lg tracking-tight whitespace-nowrap">
              {state.language === 'ur' ? 'مدرسہ حفظِ قرآن' : 'Hifz Madrasa'}
            </div>
            <div className="text-[10px] text-emerald-800 font-semibold tracking-wider uppercase -mt-0.5">
              15-Line Mushaf Workflow
            </div>
          </div>
        </div>

        {/* Zone 2: Role Switcher & Language */}
        <div className="flex items-center gap-2">
          {/* Role Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRoleMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs md:text-sm font-semibold transition-colors cursor-pointer shadow-2xs min-h-[38px]"
            >
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">
                {getRoleDisplayName(state.currentRole)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            </button>

            {showRoleMenu && (
              <div 
                className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-50 text-xs divide-y divide-stone-100 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setShowRoleMenu(false)}
              >
                {/* Ustaad Section */}
                <div className="py-1">
                  <div className="px-3 py-1 font-bold text-stone-400 text-[10px] uppercase tracking-wider">
                    {state.language === 'ur' ? 'اساتذہ کرام' : 'Ustaad Accounts'}
                  </div>
                  {(['ustaad_a', 'ustaad_b'] as RoleId[]).map(roleId => (
                    <button
                      key={roleId}
                      type="button"
                      onClick={() => onSelectRole(roleId)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-stone-50 transition-colors cursor-pointer ${
                        state.currentRole === roleId ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-stone-700'
                      }`}
                    >
                      <span>{getRoleDisplayName(roleId)}</span>
                      {state.currentRole === roleId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Halqa A Students */}
                <div className="py-1">
                  <div className="px-3 py-1 font-bold text-stone-400 text-[10px] uppercase tracking-wider">
                    {state.language === 'ur' ? 'طلبہ حلقہ الف (استاد احمد)' : 'Students: Halqa A (Ustaad A)'}
                  </div>
                  {(['student_1', 'student_2', 'student_3'] as RoleId[]).map(roleId => (
                    <button
                      key={roleId}
                      type="button"
                      onClick={() => onSelectRole(roleId)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-stone-50 transition-colors cursor-pointer ${
                        state.currentRole === roleId ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-stone-700'
                      }`}
                    >
                      <span>{getRoleDisplayName(roleId)}</span>
                      {state.currentRole === roleId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Halqa B Students */}
                <div className="py-1">
                  <div className="px-3 py-1 font-bold text-stone-400 text-[10px] uppercase tracking-wider">
                    {state.language === 'ur' ? 'طلبہ حلقہ ب (استاد بلال)' : 'Students: Halqa B (Ustaad B)'}
                  </div>
                  {(['student_4', 'student_5'] as RoleId[]).map(roleId => (
                    <button
                      key={roleId}
                      type="button"
                      onClick={() => onSelectRole(roleId)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-stone-50 transition-colors cursor-pointer ${
                        state.currentRole === roleId ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-stone-700'
                      }`}
                    >
                      <span>{getRoleDisplayName(roleId)}</span>
                      {state.currentRole === roleId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Language Toggle: EN / اردو */}
          <button
            type="button"
            onClick={onToggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
            title="Toggle Language / زبان تبدیل کریں"
          >
            <Languages className="w-3.5 h-3.5 text-stone-500" />
            <span>{state.language === 'en' ? 'اردو' : 'EN'}</span>
          </button>
        </div>

        {/* Zone 3: Date Navigation (Prev Day / Date Picker / Next Day) & Reset */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Date Navigator Strip */}
          <div className="flex items-center bg-stone-100 border border-stone-300 rounded-xl p-0.5 shadow-2xs">
            {/* Previous Day Button */}
            <button
              type="button"
              onClick={onPrevDay}
              className="p-1.5 md:px-2 rounded-lg hover:bg-white text-stone-700 hover:text-stone-900 transition-colors cursor-pointer text-xs flex items-center gap-1"
              title={t.prevDayTooltip}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden lg:inline font-medium">{t.prevDay}</span>
            </button>

            {/* Current Date Button / Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDateMenu(prev => !prev)}
                className={`px-2 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isViewingHistorical
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-white text-emerald-900 border border-stone-200 shadow-2xs'
                }`}
                title="Click to jump to another date"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>{state.currentDate}</span>
                <span className="text-[10px] text-stone-500 hidden sm:inline">
                  (D{state.dayCount})
                </span>
                {isViewingHistorical && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                )}
              </button>

              {showDateMenu && (
                <div 
                  className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-50 text-xs divide-y divide-stone-100"
                  onClick={() => setShowDateMenu(false)}
                >
                  <div className="px-3 py-1 font-bold text-stone-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <History className="w-3 h-3" />
                    <span>{t.selectDate}</span>
                  </div>
                  {recordedDates.map((d, idx) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onSelectDate(d)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-stone-50 cursor-pointer ${
                        state.currentDate === d ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-stone-700'
                      }`}
                    >
                      <span className="font-mono">{d}</span>
                      <span className="text-stone-400 font-sans text-[11px]">
                        Day {idx + 1} {d === latestRecordedDate ? '(Latest)' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Next Day Button */}
            <button
              type="button"
              onClick={onNextDay}
              className="p-1.5 md:px-2 rounded-lg hover:bg-white text-stone-700 hover:text-stone-900 transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
              title={t.nextDayTooltip}
            >
              <span className="hidden lg:inline">{t.nextDay}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Reset Demo Data button */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t.resetConfirm)) {
                onResetDemo();
              }
            }}
            className="p-2 md:px-2.5 rounded-xl border border-stone-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-stone-600 hover:text-rose-700 text-xs font-medium transition-colors cursor-pointer min-h-[38px]"
            title={t.resetDemo}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline ml-1">{t.resetDemo}</span>
          </button>
        </div>
      </div>

      {/* Historical viewing alert banner if currently looking at a past date */}
      {isViewingHistorical && (
        <div className="bg-amber-50/90 border-t border-amber-200 px-4 py-1 text-center text-xs text-amber-900 font-medium flex items-center justify-center gap-1.5">
          <History className="w-3.5 h-3.5 text-amber-700" />
          <span>
            {t.viewingHistoricalNotice}: {state.currentDate} (Day {state.dayCount}). Student records and assignments shown below reflect this date.
          </span>
          <button
            type="button"
            onClick={() => onSelectDate(latestRecordedDate)}
            className="ml-2 underline font-bold hover:text-amber-950 cursor-pointer"
          >
            Jump to Today ({latestRecordedDate})
          </button>
        </div>
      )}
    </header>
  );
};
