/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Settings, Globe, ShieldAlert } from 'lucide-react';
import { MadrasaState } from '../types/hifz';
import {
  DEFAULT_SCHOOL_TIMEZONE,
  SCHOOL_TIMEZONE_OPTIONS,
} from '../services/dateService';
import { translations } from '../i18n/translations';

interface SettingsModalProps {
  state: MadrasaState;
  onChangeTimeZone: (timeZone: string) => void;
  onUpdatePauseSettings?: (patch: {
    pauseNewSabaqOnSabqiRepeat?: boolean;
    pauseNewSabaqOnManzilRepeat?: boolean;
  }) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  state,
  onChangeTimeZone,
  onUpdatePauseSettings,
  onClose,
}) => {
  const activeTimeZone = state.settings?.timeZone || DEFAULT_SCHOOL_TIMEZONE;
  const isUr = state.language === 'ur';
  const t = translations[state.language];
  const pauseSabqi =
    state.settings?.pauseNewSabaqOnSabqiRepeat ??
    state.settings?.freezeSabaqOnSabqiOrManzilFail ??
    true;
  const pauseManzil =
    state.settings?.pauseNewSabaqOnManzilRepeat ??
    state.settings?.freezeSabaqOnSabqiOrManzilFail ??
    true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[#C5A059] flex items-center justify-between bg-[#241811] text-[#FCFAF6]">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#C5A059]" />
            <span>{isUr ? 'مدرسہ کی ترتیبات' : 'School Settings'}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-[#3E2B20] rounded-xl transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-4 rounded-xl border border-[#DFCFA8] bg-[#F8F4EC] space-y-2.5">
            <label
              htmlFor="school-timezone-select"
              className="flex items-center gap-2 text-sm font-bold text-[#241811]"
            >
              <Globe className="w-4 h-4 text-[#8F6E2B]" />
              <span>{isUr ? 'مدرسہ کا ٹائم زون' : 'School Time Zone'}</span>
            </label>
            <p className="text-xs text-[#7A6C60]">
              {isUr
                ? 'آج کی تاریخ اور آدھی رات کو تاریخ کی تبدیلی اسی ٹائم زون کے مطابق شمار ہوتی ہے۔'
                : 'Used internally to calculate today’s date and automatic midnight rollover.'}
            </p>
            <select
              id="school-timezone-select"
              value={activeTimeZone}
              onChange={e => onChangeTimeZone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#DFCFA8] bg-white text-sm font-medium text-[#241811] focus:outline-none focus:ring-2 focus:ring-[#C5A059] cursor-pointer"
            >
              {SCHOOL_TIMEZONE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {onUpdatePauseSettings && (
            <div className="p-4 rounded-xl border border-[#DFCFA8] bg-[#F8F4EC] space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#241811]">
                <ShieldAlert className="w-4 h-4 text-[#8F6E2B]" />
                <span>
                  {isUr ? 'نیا سبق روکنے کے اصول (مدرسہ ڈیفالٹ)' : 'New Sabaq Pause Rules (School Defaults)'}
                </span>
              </div>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-semibold text-[#241811]">
                  {t.pauseOnSabqiRepeatLabel}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pauseSabqi}
                  onClick={() =>
                    onUpdatePauseSettings({ pauseNewSabaqOnSabqiRepeat: !pauseSabqi })
                  }
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    pauseSabqi ? 'bg-[#1F4E3D] justify-end' : 'bg-[#CDBE9F] justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-[#FCFAF6] shadow-md" />
                </button>
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer pt-2 border-t border-[#DFCFA8]/70">
                <span className="text-xs font-semibold text-[#241811]">
                  {t.pauseOnManzilRepeatLabel}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pauseManzil}
                  onClick={() =>
                    onUpdatePauseSettings({ pauseNewSabaqOnManzilRepeat: !pauseManzil })
                  }
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    pauseManzil ? 'bg-[#1F4E3D] justify-end' : 'bg-[#CDBE9F] justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-[#FCFAF6] shadow-md" />
                </button>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#DFCFA8] bg-[#FCFAF6] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] border border-[#C5A059] text-xs font-bold transition-colors cursor-pointer"
          >
            {isUr ? 'بند کریں' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
