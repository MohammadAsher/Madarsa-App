/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  loadState, 
  saveState, 
  resetDemoState, 
  advanceToNextDay,
  goToPreviousDate,
  jumpToDate
} from './services/storageService';
import { MadrasaState, RoleId } from './types/hifz';
import { Header } from './components/Header';
import { UstaadDashboard } from './components/UstaadDashboard';
import { StudentView } from './components/StudentView';

export default function App() {
  const [state, setState] = useState<MadrasaState>(() => loadState());
  const [targetJumpWord, setTargetJumpWord] = useState<{ page: number; wordId: string } | null>(null);

  // Sync state changes with localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Set document dir & lang attribute
  useEffect(() => {
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === 'ur' ? 'rtl' : 'ltr';
  }, [state.language]);

  const handleSelectRole = (newRole: RoleId) => {
    setState(prev => ({
      ...prev,
      currentRole: newRole,
    }));
  };

  const handleToggleLanguage = () => {
    setState(prev => ({
      ...prev,
      language: prev.language === 'en' ? 'ur' : 'en',
    }));
  };

  const handlePrevDay = () => {
    const updated = goToPreviousDate(state);
    setState(updated);
  };

  const handleNextDay = () => {
    const updated = advanceToNextDay(state);
    setState(updated);
  };

  const handleSelectDate = (date: string) => {
    const updated = jumpToDate(state, date);
    setState(updated);
  };

  const handleResetDemo = () => {
    const fresh = resetDemoState();
    setState(fresh);
    setTargetJumpWord(null);
  };

  const handleUpdateState = (updater: (prev: MadrasaState) => MadrasaState) => {
    setState(updater);
  };

  const handleJumpToMushafWord = (page: number, wordId: string) => {
    setTargetJumpWord({ page, wordId });
  };

  // Determine current active view based on role
  const isUstaad = state.currentRole.startsWith('ustaad');
  const currentUstaad = isUstaad ? state.ustaads[state.currentRole] : null;
  const currentStudent = !isUstaad ? state.students[state.currentRole] : null;

  return (
    <div 
      className={`min-h-screen bg-[#FDFCF9] text-stone-900 font-sans transition-colors ${
        state.language === 'ur' ? 'font-urdu' : ''
      }`}
    >
      {/* Top Header Contract */}
      <Header
        state={state}
        onSelectRole={handleSelectRole}
        onToggleLanguage={handleToggleLanguage}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onSelectDate={handleSelectDate}
        onResetDemo={handleResetDemo}
      />

      {/* Main Content Area */}
      <main className="w-full">
        {isUstaad && currentUstaad && (
          <UstaadDashboard
            state={state}
            ustaad={currentUstaad}
            onUpdateState={handleUpdateState}
            onJumpToMushafWord={handleJumpToMushafWord}
          />
        )}

        {!isUstaad && currentStudent && (
          <StudentView
            state={state}
            student={currentStudent}
            onUpdateState={handleUpdateState}
            targetJumpWord={targetJumpWord}
            onClearTargetJumpWord={() => setTargetJumpWord(null)}
          />
        )}
      </main>
    </div>
  );
}
