import React, { useState } from 'react';
import { Dashboard } from './Dashboard';
import { Stats } from './Stats';
import type { UserProfile } from './types';

// ─── Sample User ────────────────────────────────────────
const sampleUser: UserProfile = {
  name: 'Alex Johnson',
  ntrp: 4.5,
  rank: 12,
  badge: 'Club Elite',
  club: 'Seoul Tennis Club',
  joinDate: 'Jan 2023',
  verified: true,
};

// ─── App (Simple Client-Side Router) ────────────────────
const App: React.FC = () => {
  const [page, setPage] = useState<'home' | 'stats'>('home');

  const handleNavigate = (tab: string) => {
    if (tab === 'home' || tab === 'stats') {
      setPage(tab);
    }
  };

  if (page === 'stats') {
    return (
      <Stats
        player={sampleUser}
        onBack={() => setPage('home')}
        onNavigate={handleNavigate}
        onFabPress={() => console.log('FAB pressed')}
        onSharePress={() => console.log('Share pressed')}
      />
    );
  }

  return (
    <Dashboard
      user={sampleUser}
      onNavigate={handleNavigate}
      onFabPress={() => console.log('FAB pressed')}
      onBookCourt={() => console.log('Book court')}
      onRecordMatch={() => console.log('Record match')}
      onFindPartners={() => console.log('Find partners')}
    />
  );
};

export default App;
