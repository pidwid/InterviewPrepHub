import { useState } from 'react';
import TabNav from './components/TabNav';
import Dashboard from './components/Dashboard';
import TopicList from './components/TopicList';
import { PrimaryBtn, GhostBtn } from './components/ui';
import { useProgress } from './store/useProgress';
import { ALL_TOPICS, CATEGORIES } from './data/topics';
import { ALL_CODING_TOPICS, CODING_CATEGORIES } from './data/codingChallenges';
import { ALL_LLD_TOPICS, LLD_CATEGORIES } from './data/lldTopics';
import './App.css';

function TabSection({ namespace, allTopics, categories }) {
  const { progress, setStatus, getStatus, resetAll, stats } = useProgress(namespace, allTopics);
  const [view, setView] = useState('dashboard');

  if (view === 'dashboard') {
    return (
      <div>
        <Dashboard
          stats={stats}
          progress={progress}
          onNavigate={setView}
          categories={categories}
        />
        <div className="dashboard-actions">
          <PrimaryBtn onClick={() => setView('all-topics')}>
            View All Topics
          </PrimaryBtn>
          <GhostBtn
            danger
            onClick={() => {
              if (window.confirm('Reset all progress for this section? This cannot be undone.')) {
                resetAll();
              }
            }}
          >
            Reset Progress
          </GhostBtn>
        </div>
      </div>
    );
  }

  return (
    <TopicList
      activeCategoryId={view === 'all-topics' ? null : view}
      categories={categories}
      getStatus={getStatus}
      setStatus={setStatus}
      onBack={() => setView('dashboard')}
    />
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('sd');

  const sdProgress  = useProgress('sd',  ALL_TOPICS);
  const ccProgress  = useProgress('cc',  ALL_CODING_TOPICS);
  const lldProgress = useProgress('lld', ALL_LLD_TOPICS);

  const tabStats = {
    sd:  sdProgress.stats,
    cc:  ccProgress.stats,
    lld: lldProgress.stats,
  };

  const SECTIONS = [
    { id: 'sd',  allTopics: ALL_TOPICS,        categories: CATEGORIES },
    { id: 'cc',  allTopics: ALL_CODING_TOPICS,  categories: CODING_CATEGORIES },
    { id: 'lld', allTopics: ALL_LLD_TOPICS,     categories: LLD_CATEGORIES },
  ];

  return (
    <div className="app-root">
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} tabStats={tabStats} />
      <div className="app">
        {SECTIONS.map(({ id, allTopics, categories }) =>
          activeTab === id ? (
            <TabSection
              key={id}
              namespace={id}
              allTopics={allTopics}
              categories={categories}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
