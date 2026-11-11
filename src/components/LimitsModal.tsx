/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Sliders, RotateCcw, Check, ShieldAlert } from 'lucide-react';
import { MadrasaState, StudentProfile, StudentLimits } from '../types/hifz';
import { getEffectiveLimits } from '../services/storageService';
import { translations } from '../i18n/translations';

interface LimitsModalProps {
  state: MadrasaState;
  student: StudentProfile;
  onClose: () => void;
  onSaveStudentLimits: (studentId: string, limits: Partial<StudentLimits>) => void;
  onSaveHalqaDefaultLimits: (limits: StudentLimits) => void;
  onResetToDefaults: (studentId: string) => void;
}

export const LimitsModal: React.FC<LimitsModalProps> = ({
  state,
  student,
  onClose,
  onSaveStudentLimits,
  onSaveHalqaDefaultLimits,
  onResetToDefaults,
}) => {
  const t = translations[state.language];
  const effective = getEffectiveLimits(student.id, state);
  const halqaDefaults = state.settings.halqaDefaultLimits;
  const isOverridden = Boolean(state.studentLimitsOverride[student.id]);

  const [mode, setMode] = useState<'student' | 'halqa'>('student');

  // Form states
  const [sabaqGhalti, setSabaqGhalti] = useState<number>(effective.sabaqGhaltiLimit);
  const [sabaqAtkan, setSabaqAtkan] = useState<number>(effective.sabaqAtkanLimit);
  const [sabqiGhalti, setSabqiGhalti] = useState<number>(effective.sabqiGhaltiLimit);
  const [sabqiAtkan, setSabqiAtkan] = useState<number>(effective.sabqiAtkanLimit);
  const [manzilGhalti, setManzilGhalti] = useState<number>(effective.manzilGhaltiLimit);
  const [manzilAtkan, setManzilAtkan] = useState<number>(effective.manzilAtkanLimit);

  const handleSave = () => {
    const limits: StudentLimits = {
      sabaqGhaltiLimit: Math.max(1, sabaqGhalti),
      sabaqAtkanLimit: Math.max(1, sabaqAtkan),
      sabqiGhaltiLimit: Math.max(1, sabqiGhalti),
      sabqiAtkanLimit: Math.max(1, sabqiAtkan),
      manzilGhaltiLimit: Math.max(1, manzilGhalti),
      manzilAtkanLimit: Math.max(1, manzilAtkan),
    };

    if (mode === 'student') {
      onSaveStudentLimits(student.id, limits);
    } else {
      onSaveHalqaDefaultLimits(limits);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-700" />
              <span>{t.limitsModalTitle}</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {t.limitsModalDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Selector: Student Override vs Halqa Defaults */}
        <div className="p-4 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-stone-300">
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
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'student'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.studentOverride}: {state.language === 'ur' ? student.urduName : student.name}
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
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'halqa'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
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
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.useHalqaDefaults}</span>
            </button>
          )}
        </div>

        {/* 6 Limits Form */}
        <div className="p-5 space-y-4">
          {/* Sabaq Limits */}
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50">
            <div className="text-sm font-bold text-stone-800 mb-2 flex items-center justify-between">
              <span>{t.parts.sabaq} ({t.parts.sabaqDesc})</span>
              <span className="text-xs text-stone-500 font-normal">Max before repeat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-rose-700 mb-1">
                  {t.ghaltiShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sabaqGhalti}
                  onChange={e => setSabaqGhalti(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-700 mb-1">
                  {t.atkanShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sabaqAtkan}
                  onChange={e => setSabaqAtkan(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Sabqi Limits */}
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50">
            <div className="text-sm font-bold text-stone-800 mb-2 flex items-center justify-between">
              <span>{t.parts.sabqi} ({t.parts.sabqiDesc})</span>
              <span className="text-xs text-stone-500 font-normal">Max before repeat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-rose-700 mb-1">
                  {t.ghaltiShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sabqiGhalti}
                  onChange={e => setSabqiGhalti(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-700 mb-1">
                  {t.atkanShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sabqiAtkan}
                  onChange={e => setSabqiAtkan(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Manzil Limits */}
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50">
            <div className="text-sm font-bold text-stone-800 mb-2 flex items-center justify-between">
              <span>{t.parts.manzil} ({t.parts.manzilDesc})</span>
              <span className="text-xs text-stone-500 font-normal">Max before repeat</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-rose-700 mb-1">
                  {t.ghaltiShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={manzilGhalti}
                  onChange={e => setManzilGhalti(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-700 mb-1">
                  {t.atkanShort} Limit
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={manzilAtkan}
                  onChange={e => setManzilAtkan(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono font-bold text-stone-900 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 hover:bg-white text-xs md:text-sm font-medium transition-colors cursor-pointer"
          >
            {t.close}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs md:text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t.saveLimits}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
