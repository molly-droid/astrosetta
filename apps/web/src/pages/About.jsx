import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import HowToUseTab from '@/components/about/HowToUseTab';
import LearningLevelsTab from '@/components/about/LearningLevelsTab';
import AboutAppTab from '@/components/about/AboutAppTab';
import ChangelogTab from '@/components/about/ChangelogTab';
import FeedbackTab from '@/components/about/FeedbackTab';
import ScrollableTabs from '@/components/ui/ScrollableTabs';
import { useTabUrl } from '@/hooks/useTabUrl';

const TABS = [
  { key: 'howto',     label: 'How to Use' },
  { key: 'about',     label: 'About' },
  { key: 'learning',  label: 'Learning Path' },
  { key: 'feedback',  label: 'Feedback' },
  { key: 'changelog', label: "What's New" },
];

export default function About() {
  const [activeTab, setActiveTab] = useTabUrl('tab', 'howto');

  return (
    <div className="min-h-screen pb-24">
      <PageHeader>
        <div className="px-4 pt-12 pb-5 space-y-1">
          <p className="font-body text-xs text-white/40 uppercase tracking-widest">Astrosetta</p>
          <h1 className="font-display text-2xl font-bold text-white">Guide & Info</h1>
          <p className="font-body text-xs text-white/50 italic">Everything you need to know about the app</p>
        </div>

        <ScrollableTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </PageHeader>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'howto'     && <HowToUseTab />}
        {activeTab === 'about'     && <AboutAppTab />}
        {activeTab === 'learning'  && <LearningLevelsTab />}
        {activeTab === 'feedback'  && <FeedbackTab />}
        {activeTab === 'changelog' && <ChangelogTab />}
      </div>
    </div>
  );
}