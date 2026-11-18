/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Sliders, RotateCcw, Check, ShieldAlert } from 'lucide-react';
import {
  MadrasaState,
  StudentProfile,
  StudentLimits,
  StudentPauseOverride,
} from '../types/hifz';
import { getEffectiveLimits } from '../services/storageService';
import { getEffectivePauseSettings } from '../services/hifzService';
import { StudentTypeBadge } from './StudentTypeBadge';
import { translations } from '../i18n/translations';

interface LimitsModalProps {
  state: MadrasaState;
  student: StudentProfile;
  onClose: () => void;
  onSaveStudentLimits: (studentId: string, limits: Partial<StudentLimits>) => void;
  onSaveHalqaDefaultLimits: (limits: StudentLimits) => void;
  onSaveStudentPauseOverride?: (
    studentId: string,
    pause: Partial<StudentPauseOverride>
  ) => void;
  onSaveSchoolPauseDefaults?: (pause: {
    pauseNewSabaqOnSabqiRepeat: boolean;
    pauseNewSabaqOnManzilRepeat: boolean;
  }) => void;
  onResetToDefaults: (studentId: string) => void;
}

export const LimitsModal: React.FC<LimitsModalProps> = ({
  state,
  student,
  onClose,
  onSaveStudentLimits,
  onSaveHalqaDefaultLimits,
  onSaveStudentPauseOverride,
  onSaveSchoolPauseDefaults,
  onResetToDefaults,
}) => {
  const t = translations[state.language];
  const isNazra = student.studentType === 'nazra';
  const effective = getEffectiveLimits(student.id, state);
  const halqaDefaults = state.settings.halqaDefaultLimits;
  const effectivePause = getEffectivePauseSettings(student.id, state);
  const schoolSabqiPause =
    state.settings.pauseNewSabaqOnSabqiRepeat ??
    state.settings.freezeSabaqOnSabqiOrManzilFail ??
    true;
  const schoolManzilPause =
    state.settings.pauseNewSabaqOnManzilRepeat ??
    state.settings.freezeSabaqOnSabqiOrManzilFail ??
    true;
  const isOverridden = Boolean(
    state.studentLimitsOverride[student.id] || state.studentPauseOverride?.[student.id]
  );

  const [mode, setMode] = useState<'student' | 'halqa'>('student');

  // Form states
  const [sabaqGhalti, setSabaqGhalti] = useState<number>(effective.sabaqGhaltiLimit);
  const [sabaqAtkan, setSabaqAtkan] = useState<number>(effective.sabaqAtkanLimit);
  const [sabqiGhalti, setSabqiGhalti] = useState<number>(effective.sabqiGhaltiLimit);
  const [sabqiAtkan, setSabqiAtkan] = useState<number>(effective.sabqiAtkanLimit);
  const [manzilGhalti, setManzilGhalti] = useState<number>(effective.manzilGhaltiLimit);
  const [manzilAtkan, setManzilAtkan] = useState<number>(effective.manzilAtkanLimit);
  const [pauseOnSabqiRepeat, setPauseOnSabqiRepeat] = useState<boolean>(
    effectivePause.pauseNewSabaqOnSabqiRepeat
  );
  const [pauseOnManzilRepeat, setPauseOnManzilRepeat] = useState<boolean>(
    effectivePause.pauseNewSabaqOnManzilRepeat
  );

  const handleSave = () => {
    if (mode === 'student') {
      if (isNazra) {
        onSaveStudentLimits(student.id, {
          ...(state.studentLimitsOverride[student.id] || {}),
          sabaqGhaltiLimit: Math.max(1, sabaqGhalti),
          sabaqAtkanLimit: Math.max(1, sabaqAtkan),
        });
      } else {
        onSaveStudentLimits(student.id, {
          sabaqGhaltiLimit: Math.max(1, sabaqGhalti),
          sabaqAtkanLimit: Math.max(1, sabaqAtkan),
          sabqiGhaltiLimit: Math.max(1, sabqiGhalti),
          sabqiAtkanLimit: Math.max(1, sabqiAtkan),
          manzilGhaltiLimit: Math.max(1, manzilGhalti),
          manzilAtkanLimit: Math.max(1, manzilAtkan),
        });
        if (onSaveStudentPauseOverride) {
          onSaveStudentPauseOverride(student.id, {
            pauseNewSabaqOnSabqiRepeat: pauseOnSabqiRepeat,
            pauseNewSabaqOnManzilRepeat: pauseOnManzilRepeat,
          });
        }
      }
    } else {
      onSaveHalqaDefaultLimits({
        sabaqGhaltiLimit: Math.max(1, sabaqGhalti),
        sabaqAtkanLimit: Math.max(1, sabaqAtkan),
        sabqiGhaltiLimit: Math.max(1, sabqiGhalti),
        sabqiAtkanLimit: Math.max(1, sabqiAtkan),
        manzilGhaltiLimit: Math.max(1, manzilGhalti),
        manzilAtkanLimit: Math.max(1, manzilAtkan),
      });
      if (onSaveSchoolPauseDefaults) {
        onSaveSchoolPauseDefaults({
          pauseNewSabaqOnSabqiRepeat: pauseOnSabqiRepeat,
          pauseNewSabaqOnManzilRepeat: pauseOnManzilRepeat,
        });
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-[#FCFAF6] rounded-2xl shadow-2xl border-2 border-[#C5A059] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header with Islamic dark coffee identity */}
        <div className="px-5 py-4 border-b-2 border-[#C5A059] flex items-center justify-between bg-[#241811] text-[#FCFAF6] shrink-0">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#C5A059]" />
              <span>{t.limitsModalTitle}</span>
              <span className="text-[#C5A059] text-xs">۞</span>
            </h2>
            <p className="text-xs text-[#DFCFA8] mt-0.5">
              {t.limitsModalDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#DFCFA8] hover:text-[#FCFAF6] hover:bg-[#3E2B20] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Selector: Student Override vs Halqa Defaults */}
        <div className="p-4 bg-[#F8F4EC] border-b border-[#DFCFA8] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-[#FAF6EF] rounded-xl border border-[#DFCFA8]">
            <button
              type="button"
              onClick={() => {
                setMode('student');
                setSabaqGhalti(effective.sabaqGhaltiLimit);
                setSabaqAtkan(effective.sabaqAtkanLimit);
                setSabqiGhalti(effective.sabqiGhaltiLimit);
                setSabqiAtkan(effective.sabqiAtkanLimit);
                setManzilGhalti(effective.manzilGhaltiLimit);
                setManzilAtkan(effective.manzilAtkanLimit);
                setPauseOnSabqiRepeat(effectivePause.pauseNewSabaqOnSabqiRepeat);
                setPauseOnManzilRepeat(effectivePause.pauseNewSabaqOnManzilRepeat);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                mode === 'student'
                  ? 'bg-[#241811] text-[#FCFAF6] shadow-2xs border border-[#C5A059]'
                  : 'text-[#42362E] hover:text-[#241811]'
              }`}
            >
              <span>{t.studentOverride}: {state.language === 'ur' ? student.urduName : student.name}</span>
              <StudentTypeBadge
                type={student.studentType || 'hifz'}
                language={state.language}
                size="xs"
              />
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('halqa');
                setSabaqGhalti(halqaDefaults.sabaqGhaltiLimit);
                setSabaqAtkan(halqaDefaults.sabaqAtkanLimit);
                setSabqiGhalti(halqaDefaults.sabqiGhaltiLimit);
                setSabqiAtkan(halqaDefaults.sabqiAtkanLimit);
                setManzilGhalti(halqaDefaults.manzilGhaltiLimit);
                setManzilAtkan(halqaDefaults.manzilAtkanLimit);
                setPauseOnSabqiRepeat(schoolSabqiPause);
                setPauseOnManzilRepeat(schoolManzilPause);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'halqa'
                  ? 'bg-[#241811] text-[#FCFAF6] shadow-2xs border border-[#C5A059]'
                  : 'text-[#42362E] hover:text-[#241811]'
              }`}
            >
              {t.halqaDefaults}
            </button>
          </div>

          {mode === 'student' && isOverridden && (
            <button
              type="button"
              onClick={() => {
                onResetToDefaults(student.id);
                onClose();
              }}
              className="flex items-center gap-1 text-xs text-[#8F6E2B] hover:text-[#241811] underline cursor-pointer font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.useHalqaDefaults}</span>
            </button>
          )}
        </div>

        {/* 6 Limits Form + Pause Rules */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Sabaq Limits */}
          <div className="p-3.5 rounded-xl border border-[#DFCFA8] bg-[#F8F4EC]">
            <div className="text-sm font-bold text-[#241811] mb-2 flex items-center justify-between">
              <span>{t.parts.sabaq} ({t.parts.sabaqDesc})</span>
              <span className="text-xs text-[#7A6C60] font-normal">Max before repeat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#B91C1C] mb-1">
                  {t.ghaltiShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sabaqGhalti}
                  onChange={e => setSabaqGhalti(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-[#DFCFA8] rounded-lg text-sm font-mono font-bold text-[#241811] bg-[#FAF6EF] focus:ring-2 focus:ring-[#C5A059]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#D97706] mb-1">
                  {t.atkanShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sabaqAtkan}
                  onChange={e => setSabaqAtkan(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-[#DFCFA8] rounded-lg text-sm font-mono font-bold text-[#241811] bg-[#FAF6EF] focus:ring-2 focus:ring-[#C5A059]"
                />
              </div>
            </div>
          </div>

          {!(isNazra && mode === 'student') ? (
            <>
              {/* Sabqi Limits */}
              <div className="p-3.5 rounded-xl border border-[#DFCFA8] bg-[#F8F4EC]">
                <div className="text-sm font-bold text-[#241811] mb-2 flex items-center justify-between">
                  <span>{t.parts.sabqi} ({t.parts.sabqiDesc})</span>
                  <span className="text-xs text-[#7A6C60] font-normal">Max before repeat</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#B91C1C] mb-1">
                      {t.ghaltiShort} Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={sabqiGhalti}
                      onChange={e => setSabqiGhalti(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 border border-[#DFCFA8] rounded-lg text-sm font-mono font-bold text-[#241811] bg-[#FAF6EF] focus:ring-2 focus:ring-[#C5A059]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D97706] mb-1">
                      {t.atkanShort} Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={sabqiAtkan}
                      onChange={e => setSabqiAtkan(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 border border-[#DFCFA8] rounded-lg text-sm font-mono font-bold text-[#241811] bg-[#FAF6EF] focus:ring-2 focus:ring-[#C5A059]"
                    />
                  </div>
                </div>
              </div>

              {/* Manzil Limits */}
              <div className="p-3.5 rounded-xl border border-[#DFCFA8] bg-[#F8F4EC]">
                <div className="text-sm font-bold text-[#241811] mb-2 flex items-center justify-between">
                  <span>{t.parts.manzil} ({t.parts.manzilDesc})</span>
                  <span className="text-xs text-[#7A6C60] font-normal">Max before repeat</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#B91C1C] mb-1">
                      {t.ghaltiShort} Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={manzilGhalti}
                      onChange={e => setManzilGhalti(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 border border-[#DFCFA8] rounded-lg text-sm font-mono font-bold text-[#241811] bg-[#FAF6EF] focus:ring-2 focus:ring-[#C5A059]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D97706] mb-1">
                      {t.atkanShort} Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={manzilAtkan}
                      onChange={e => setManzilAtkan(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 border border-[#DFCFA8] rounded-lg text-sm font-mono font-bold text-[#241811] bg-[#FAF6EF] focus:ring-2 focus:ring-[#C5A059]"
                    />
                  </div>
                </div>
              </div>

              {/* Pause New Sabaq Rules (School Default / Per-Student Override) */}
              <div className="p-3.5 rounded-xl border border-[#C5A059]/70 bg-[#FAF6EF] space-y-2.5">
                <div className="text-sm font-bold text-[#241811] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#8F6E2B]" />
                  <span>
                    {mode === 'student'
                      ? state.language === 'ur'
                        ? 'اس طالب علم کے لیے نیا سبق روکنے کے اصول'
                        : 'Student Override: New Sabaq Pause Rules'
                      : state.language === 'ur'
                      ? 'مدرسہ ڈیفالٹ: نیا سبق روکنے کے اصول'
                      : 'School Default: New Sabaq Pause Rules'}
                  </span>
                </div>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-xs font-semibold text-[#241811]">
                    {t.pauseOnSabqiRepeatLabel}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={pauseOnSabqiRepeat}
                    onClick={() => setPauseOnSabqiRepeat(prev => !prev)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      pauseOnSabqiRepeat ? 'bg-[#1F4E3D] justify-end' : 'bg-[#CDBE9F] justify-start'
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
                    aria-checked={pauseOnManzilRepeat}
                    onClick={() => setPauseOnManzilRepeat(prev => !prev)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      pauseOnManzilRepeat ? 'bg-[#1F4E3D] justify-end' : 'bg-[#CDBE9F] justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-[#FCFAF6] shadow-md" />
                  </button>
                </label>
              </div>
            </>
          ) : (
            <div className="p-3 rounded-xl border border-[#16365D]/30 bg-[#E8EEF6] text-xs text-[#16365D]">
              {state.language === 'ur'
                ? 'ناظرہ طلبہ کے لیے صرف سبق کی حدیں لاگو ہوتی ہیں۔'
                : 'Nazra students track Sabaq reading limits only. Sabqi and Manzil are hidden.'}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#DFCFA8] bg-[#FCFAF6] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DFCFA8] rounded-xl text-[#42362E] hover:bg-[#F3ECE1] text-xs md:text-sm font-semibold transition-colors cursor-pointer"
          >
            {t.close}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl bg-[#241811] hover:bg-[#38271D] text-[#FCFAF6] border border-[#C5A059] text-xs md:text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4 text-[#C5A059]" />
            <span>{t.saveLimits}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
