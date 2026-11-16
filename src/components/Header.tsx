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
  Settings,
  ArrowLeft
} from 'lucide-react';
import { MadrasaState, RoleId } from '../types/hifz';
import { translations } from '../i18n/translations';

interface HeaderProps {
  state: MadrasaState;
  onSelectRole: (role: RoleId) => void;
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
  onResetDemo: () => void;
  onNavigateBack?: () => void;
  canGoBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  onSelectRole,
  onToggleLanguage,
  onOpenSettings,
  onResetDemo,
  onNavigateBack,
  canGoBack = true,
}) => {
  const t = translations[state.language];
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const getRoleDisplayName = (roleId: RoleId) => {
    return t.roles[roleId] || roleId;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#241811] text-[#FCFAF6] border-b-2 border-[#C5A059] shadow-md">
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Back Navigation Button & Brand Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Back Navigation Button */}
          <button
            type="button"
            onClick={onNavigateBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#C5A059]/50 bg-[#2E2017] hover:bg-[#3A291E] active:scale-95 text-[#FCFAF6] text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs min-h-[38px]"
            title={canGoBack ? (t.backTooltip || 'Return to previous screen') : (state.language === 'ur' ? 'مرکزی ڈیش بورڈ' : 'Main Dashboard')}
          >
            <ArrowLeft className="w-4 h-4 text-[#C5A059] shrink-0" />
            <span className="font-semibold">{t.back || 'Back'}</span>
          </button>

          {/* Brand Title with Islamic Medallion */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#DFCFA8] to-[#C5A059] text-[#241811] flex items-center justify-center shadow-xs border border-[#F3ECE1]">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="font-bold text-[#FCFAF6] text-sm sm:text-base md:text-lg tracking-tight whitespace-nowrap flex items-center gap-1.5">
                <span>{state.language === 'ur' ? 'مدرسہ حفظِ قرآن' : 'Hifz Madrasa'}</span>
                <span className="text-[#C5A059] text-xs hidden md:inline">۞</span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-[#C5A059] font-medium tracking-wider uppercase -mt-0.5 hidden xs:block">
                {state.language === 'ur' ? 'نظامِ تعلیم و حفظِ مصحف' : '15-Line Mushaf Workflow'}
              </div>
            </div>
          </div>
        </div>

        {/* Zone 2: Role Switcher & Language */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Role Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRoleMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#C5A059]/40 bg-[#2E2017] hover:bg-[#3A291E] text-[#FCFAF6] text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs min-h-[38px]"
            >
              <UserCheck className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span className="truncate max-w-[90px] sm:max-w-[160px]">
                {getRoleDisplayName(state.currentRole)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#DFCFA8] shrink-0" />
            </button>

            {showRoleMenu && (
              <div 
                className="absolute right-0 mt-2 w-72 bg-[#FCFAF6] text-[#241811] rounded-xl shadow-2xl border-2 border-[#C5A059] py-1.5 z-50 text-xs divide-y divide-[#EADEC7] animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setShowRoleMenu(false)}
              >
                {/* Ustaad Section */}
                <div className="py-1">
                  <div className="px-3 py-1 font-bold text-[#7A6C60] text-[10px] uppercase tracking-wider flex items-center justify-between">
                    <span>{state.language === 'ur' ? 'اساتذہ کرام' : 'Ustaad Accounts'}</span>
                    <span className="text-[#C5A059]">✦</span>
                  </div>
                  {(['ustaad_a', 'ustaad_b'] as RoleId[]).map(roleId => (
                    <button
                      key={roleId}
                      type="button"
                      onClick={() => onSelectRole(roleId)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#F3ECE1] transition-colors cursor-pointer ${
                        state.currentRole === roleId ? 'bg-[#F3ECE1] text-[#241811] font-bold border-l-3 border-[#C5A059]' : 'text-[#3E2B20]'
                      }`}
                    >
                      <span>{getRoleDisplayName(roleId)}</span>
                      {state.currentRole === roleId && (
                        <span className="w-2 h-2 rounded-full bg-[#C5A059]" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Halqa A Students */}
                <div className="py-1">
                  <div className="px-3 py-1 font-bold text-[#7A6C60] text-[10px] uppercase tracking-wider flex items-center justify-between">
                    <span>{state.language === 'ur' ? 'طلبہ حلقہ الف (استاد احمد)' : 'Students: Halqa A (Ustaad A)'}</span>
                    <span className="text-[#C5A059]">✦</span>
                  </div>
                  {(['student_1', 'student_2', 'student_3'] as RoleId[]).map(roleId => (
                    <button
                      key={roleId}
                      type="button"
                      onClick={() => onSelectRole(roleId)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#F3ECE1] transition-colors cursor-pointer ${
                        state.currentRole === roleId ? 'bg-[#F3ECE1] text-[#241811] font-bold border-l-3 border-[#C5A059]' : 'text-[#3E2B20]'
                      }`}
                    >
                      <span>{getRoleDisplayName(roleId)}</span>
                      {state.currentRole === roleId && (
                        <span className="w-2 h-2 rounded-full bg-[#C5A059]" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Halqa B Students */}
                <div className="py-1">
                  <div className="px-3 py-1 font-bold text-[#7A6C60] text-[10px] uppercase tracking-wider flex items-center justify-between">
                    <span>{state.language === 'ur' ? 'طلبہ حلقہ ب (استاد بلال)' : 'Students: Halqa B (Ustaad B)'}</span>
                    <span className="text-[#C5A059]">✦</span>
                  </div>
                  {(['student_4', 'student_5'] as RoleId[]).map(roleId => (
                    <button
                      key={roleId}
                      type="button"
                      onClick={() => onSelectRole(roleId)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#F3ECE1] transition-colors cursor-pointer ${
                        state.currentRole === roleId ? 'bg-[#F3ECE1] text-[#241811] font-bold border-l-3 border-[#C5A059]' : 'text-[#3E2B20]'
                      }`}
                    >
                      <span>{getRoleDisplayName(roleId)}</span>
                      {state.currentRole === roleId && (
                        <span className="w-2 h-2 rounded-full bg-[#C5A059]" />
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
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#C5A059]/40 bg-[#2E2017] hover:bg-[#3A291E] text-[#FCFAF6] text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
            title="Toggle Language / زبان تبدیل کریں"
          >
            <Languages className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>{state.language === 'en' ? 'اردو' : 'EN'}</span>
          </button>
        </div>

        {/* Zone 3: Real Current Date, Settings & Reset */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Today's Real Date Display */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF6EF] text-[#241811] border border-[#C5A059] text-xs font-mono font-bold shadow-xs min-h-[38px]"
            title={state.language === 'ur' ? 'آج کی اصل تاریخ' : 'Today'}
          >
            <Calendar className="w-3.5 h-3.5 text-[#8F6E2B] shrink-0" />
            <span className="hidden sm:inline font-sans text-[#7A6C60] font-semibold">
              {state.language === 'ur' ? 'آج:' : 'Today:'}
            </span>
            <span>{state.currentDate}</span>
          </div>

          {/* School Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 rounded-xl border border-[#C5A059]/40 bg-[#2E2017] hover:bg-[#3A291E] text-[#DFCFA8] hover:text-[#FCFAF6] text-xs font-medium transition-colors cursor-pointer min-h-[38px]"
            title={state.language === 'ur' ? 'ترتیبات' : 'Settings'}
            aria-label="Settings"
          >
            <Settings className="w-3.5 h-3.5 text-[#C5A059]" />
          </button>

          {/* Reset Demo Data button */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t.resetConfirm)) {
                onResetDemo();
              }
            }}
            className="p-1.5 sm:p-2 rounded-xl border border-[#C5A059]/40 bg-[#2E2017] hover:bg-rose-950/60 hover:border-rose-400 text-[#DFCFA8] hover:text-rose-200 text-xs font-medium transition-colors cursor-pointer min-h-[38px]"
            title={t.resetDemo}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline ml-1">{t.resetDemo}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
