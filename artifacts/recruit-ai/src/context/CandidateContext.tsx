import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ScoredCandidate, PipelineStats } from '@workspace/api-client-react';

interface CandidateContextType {
  candidates: ScoredCandidate[];
  stats: PipelineStats | null;
  setScoredData: (candidates: ScoredCandidate[], stats: PipelineStats) => void;
  updateCandidate: (name: string, updates: Partial<ScoredCandidate>) => void;
  clearData: () => void;
}

const CandidateContext = createContext<CandidateContextType | undefined>(undefined);

export function CandidateProvider({ children }: { children: React.ReactNode }) {
  const [candidates, setCandidates] = useState<ScoredCandidate[]>(() => {
    try {
      const saved = localStorage.getItem('recruitai_candidates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState<PipelineStats | null>(() => {
    try {
      const saved = localStorage.getItem('recruitai_stats');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem('recruitai_candidates', JSON.stringify(candidates));
    localStorage.setItem('recruitai_stats', JSON.stringify(stats));
  }, [candidates, stats]);

  const setScoredData = (newCandidates: ScoredCandidate[], newStats: PipelineStats) => {
    setCandidates(newCandidates);
    setStats(newStats);
  };

  const updateCandidate = (name: string, updates: Partial<ScoredCandidate>) => {
    setCandidates(prev => prev.map(c => 
      c.name === name ? { ...c, ...updates } : c
    ));
  };

  const clearData = () => {
    setCandidates([]);
    setStats(null);
    localStorage.removeItem('recruitai_candidates');
    localStorage.removeItem('recruitai_stats');
  };

  return (
    <CandidateContext.Provider value={{ candidates, stats, setScoredData, updateCandidate, clearData }}>
      {children}
    </CandidateContext.Provider>
  );
}

export function useCandidates() {
  const context = useContext(CandidateContext);
  if (context === undefined) {
    throw new Error('useCandidates must be used within a CandidateProvider');
  }
  return context;
}
