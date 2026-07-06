import { useState, useEffect } from 'react';
import { resolvePosition, resolveTip } from './lib/tipResolver.js';
import { CARD_CONTENT } from './data/tips.js';

import Onboarding from './components/Onboarding.jsx';
import Auth from './components/Auth.jsx';
import BottomNav from './components/shared/BottomNav.jsx';
import Today from './components/Today.jsx';
import Week from './components/Week.jsx';
import Tips from './components/Tips.jsx';
import Calendar from './components/Calendar.jsx';

const STORAGE_KEY = 'tri_momentum_state';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [activeTab, setActiveTab] = useState('today');
  const [profile, setProfile] = useState(null);
  const [calendar, setCalendar] = useState({});
  const [sessionStatuses, setSessionStatuses] = useState({});

  useEffect(() => {
    const saved = loadState();
    if (saved?.profile?.trainingStart) {
      setProfile(saved.profile);
      setCalendar(saved.calendar ?? {});
      setSessionStatuses(saved.sessionStatuses ?? {});
      setScreen('app');
    } else {
      setScreen('onboarding');
    }
  }, []);

  useEffect(() => {
    if (screen === 'app' && profile) {
      saveState({ profile, calendar, sessionStatuses });
    }
  }, [profile, calendar, sessionStatuses, screen]);

  function handleOnboardingComplete({ mode, trainingStart, raceDate, blockConfig, calendar: cal }) {
    const newProfile = { mode, trainingStart, raceDate, blockConfig, currentCadence: 'base' };
    setProfile(newProfile);
    setCalendar(cal);
    setScreen('app');
  }

  function handleStatusChange(key, status) {
    setSessionStatuses(prev => ({ ...prev, [key]: status }));
  }

  function handleCadenceChange(cadence) {
    setProfile(prev => ({ ...prev, currentCadence: cadence }));
  }

  function handleCalendarChange(newCal) {
    setCalendar(newCal);
  }

  if (screen === 'loading') return null;

  if (screen === 'auth') {
    return <Auth onSkip={() => setScreen('onboarding')} />;
  }

  if (screen === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const resolvedPosition = profile?.trainingStart
    ? resolvePosition(new Date(profile.trainingStart), profile.blockConfig)
    : null;

  const enrichedProfile = resolvedPosition
    ? {
        ...profile,
        phase:          resolvedPosition.phase,
        phasePosition:  resolvedPosition.phasePosition,
        emphasisPillar: resolvedPosition.emphasisPillar,
        weekInPhase:    resolvedPosition.weekInPhase,
        blockNumber:    resolvedPosition.blockNumber,
        onCadenceChange: handleCadenceChange,
      }
    : profile;

  const weekTips = resolvedPosition
    ? {
        tue: resolveTip(CARD_CONTENT, resolvedPosition.phase, resolvedPosition.phasePosition, resolvedPosition.emphasisPillar, 'tue'),
        thu: resolveTip(CARD_CONTENT, resolvedPosition.phase, resolvedPosition.phasePosition, resolvedPosition.emphasisPillar, 'thu'),
        sun: resolveTip(CARD_CONTENT, resolvedPosition.phase, resolvedPosition.phasePosition, resolvedPosition.emphasisPillar, 'sun'),
      }
    : {};

  return (
    <div className="app-shell">
      <Today
        profile={enrichedProfile}
        calendar={calendar}
        sessionStatuses={sessionStatuses}
        onStatusChange={handleStatusChange}
        active={activeTab === 'today'}
      />
      <Week
        profile={enrichedProfile}
        weekNum={resolvedPosition?.weekInPhase}
        tips={weekTips}
        active={activeTab === 'week'}
      />
      <Tips
        profile={enrichedProfile}
        active={activeTab === 'tips'}
      />
      <Calendar
        calendar={calendar}
        onCalendarChange={handleCalendarChange}
        active={activeTab === 'calendar'}
      />
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
