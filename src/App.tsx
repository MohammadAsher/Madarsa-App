/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  loadState, 
  saveState, 
  resetDemoState, 
  advanceToNextDay,
  goToPreviousDate,
  jumpToDate
} from './services/storageService';
import { MadrasaState, RoleId, PartType, StudentProfile } from './types/hifz';
import { Header } from './components/Header';
import { UstaadDashboard } from './components/UstaadDashboard';
import { StudentView } from './components/StudentView';

interface NavigationHistoryEntry {
  role: RoleId;
  markingSession: { studentId: string; part: PartType } | null;
}

export default function App() {
  const [state, setState] = useState<MadrasaState>(() => loadState());
  const [targetJumpWord, setTargetJumpWord] = useState<{ page: number; wordId: string } | null>(null);

  // Active dedicated marking session (when teacher is listening & marking)
  const [markingSession, setMarkingSession] = useState<{
    studentId: string;
    part: PartType;
  } | null>(null);

  // Navigation history stack for Back navigation
  const [navHistory, setNavHistory] = useState<NavigationHistoryEntry[]>([]);

  // Sync state changes with localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Set document dir & lang attribute
  useEffect(() => {
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === 'ur' ? 'rtl' : 'ltr';
  }, [state.language]);

  // Handle switching roles
  const handleSelectRole = (newRole: RoleId) => {
    if (newRole === state.currentRole && !markingSession) return;

    // Push current view to history stack before navigating
    setNavHistory(prev => [
      ...prev,
      { role: state.currentRole, markingSession }
    ]);

    // Push browser history entry
    try {
      window.history.pushState(
        { role: newRole, markingSession: null },
        '',
        window.location.href
      );
    } catch {
      // Ignore if iframe restricts pushState
    }

    setMarkingSession(null);
    setState(prev => ({
      ...prev,
      currentRole: newRole,
    }));
  };

  // Start marking session for student
  const handleStartMarking = (student: StudentProfile, part: PartType) => {
    setNavHistory(prev => [
      ...prev,
      { role: state.currentRole, markingSession: null }
    ]);

    const session = { studentId: student.id, part };
    setMarkingSession(session);

    try {
      window.history.pushState(
        { role: state.currentRole, markingSession: session },
        '',
        window.location.href
      );
    } catch {
      // Ignore
    }
  };

  // Close marking session
  const handleCloseMarking = () => {
    setMarkingSession(null);
  };

  // Proper Back Navigation Handler
  const handleNavigateBack = useCallback(() => {
    // 1. If currently in a marking session, Back returns to the Ustaad dashboard for that student
    if (markingSession) {
      setMarkingSession(null);
      return;
    }

    // 2. If we have a navigation history stack, pop and restore the actual previous screen
    if (navHistory.length > 0) {
      const nextHistory = [...navHistory];
      const previous = nextHistory.pop()!;
      setNavHistory(nextHistory);

      if (previous.role !== state.currentRole) {
        setState(prev => ({
          ...prev,
          currentRole: previous.role,
        }));
      }
      setMarkingSession(previous.markingSession);
      return;
    }

    // 3. Fallback routing if history stack is empty:
    // If on a student view, navigate to the assigned teacher's dashboard (or default Ustaad A)
    if (!state.currentRole.startsWith('ustaad')) {
      const student = state.students[state.currentRole];
      const fallbackUstaad = student?.ustaadId || 'ustaad_a';
      setState(prev => ({
        ...prev,
        currentRole: fallbackUstaad,
      }));
      setMarkingSession(null);
      return;
    }

    // If on Ustaad B, navigate to Ustaad A dashboard
    if (state.currentRole === 'ustaad_b') {
      setState(prev => ({
        ...prev,
        currentRole: 'ustaad_a',
      }));
      setMarkingSession(null);
      return;
    }

    // If already at Ustaad A (root screen), make sure we remain safely on Ustaad A
    // (Never navigate away to a blank browser page)
    setState(prev => ({
      ...prev,
      currentRole: 'ustaad_a',
    }));
    setMarkingSession(null);
  }, [markingSession, navHistory, state.currentRole, state.students]);

  // Handle browser popstate (browser back/forward buttons)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state === 'object') {
        const stateRole = e.state.role as RoleId | undefined;
        const stateMarking = e.state.markingSession;
        if (stateRole && state.currentRole !== stateRole) {
          setState(prev => ({ ...prev, currentRole: stateRole }));
        }
        setMarkingSession(stateMarking || null);
      } else {
        handleNavigateBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handleNavigateBack, state.currentRole]);

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
    setMarkingSession(null);
    setNavHistory([]);
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

  const canGoBack = Boolean(
    markingSession || 
    navHistory.length > 0 || 
    !isUstaad || 
    state.currentRole === 'ustaad_b'
  );

  return (
    <div 
      className={`min-h-screen bg-[#FAF6EF] bg-islamic-pattern text-[#3C332B] font-sans transition-colors selection:bg-[#C5A059]/30 selection:text-[#241811] ${
        state.language === 'ur' ? 'font-urdu' : ''
      }`}
    >
      {/* Top Header Contract with Back Navigation */}
      <Header
        state={state}
        onSelectRole={handleSelectRole}
        onToggleLanguage={handleToggleLanguage}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onSelectDate={handleSelectDate}
        onResetDemo={handleResetDemo}
        onNavigateBack={handleNavigateBack}
        canGoBack={canGoBack}
      />

      {/* Main Content Area */}
      <main className="w-full">
        {isUstaad && currentUstaad && (
          <UstaadDashboard
            state={state}
            ustaad={currentUstaad}
            onUpdateState={handleUpdateState}
            onJumpToMushafWord={handleJumpToMushafWord}
            activeMarkingSession={
              markingSession && state.students[markingSession.studentId]
                ? {
                    student: state.students[markingSession.studentId],
                    part: markingSession.part,
                  }
                : null
            }
            onStartMarking={handleStartMarking}
            onCloseMarking={handleCloseMarking}
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
