import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Shield } from 'lucide-react';
import RoadmapMarketingTab from '@/components/admin/RoadmapMarketingTab';
import EmailTab from '@/components/admin/EmailTab';
import FeedbackTabAdmin from '@/components/admin/FeedbackTabAdmin';
import EphemerisCheckTab from '@/components/admin/EphemerisCheckTab';
import FeatureHighlightsTab from '@/components/admin/FeatureHighlightsTab';
import SettingsTab from '@/components/admin/SettingsTab';
import EventsTab from '@/components/admin/EventsTab';
import EventQueueTab from '@/components/admin/EventQueueTab';
import PageHeader from '@/components/layout/PageHeader';
import ScrollableTabs from '@/components/ui/ScrollableTabs';

const TABS = [
  { key: 'eventqueue', label: 'Booth Queue' },
  { key: 'events', label: 'Events' },
  { key: 'highlights', label: 'Feature Highlights' },
  { key: 'planning', label: 'Roadmap & Marketing' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'email', label: 'Emails' },
  { key: 'ephemeris', label: 'Ephemeris Check' },
  { key: 'settings', label: 'Settings' },
];

export default function Admin() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('highlights');

  useEffect(() => {
    if (user?.role === 'admin') {
      setLoading(false);
    }
  }, [user]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center space-y-4">
        <Shield size={40} className="text-brass/40" />
        <h2 className="font-display text-xl text-deep-blue">Access Restricted</h2>
        <p className="font-body text-sm text-brass">Admin access only.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gold-primary" size={28} /></div>;
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader>
        <div className="px-4 pt-12 pb-5 space-y-1">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-gold-accent" />
            <h1 className="font-display text-2xl font-bold text-white">Admin Panel</h1>
          </div>
          <p className="font-body text-xs text-brass italic">Internal management tools</p>
        </div>

        {/* Tab bar */}
        <ScrollableTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="px-4"
        />
      </PageHeader>

      {activeTab === 'eventqueue' && <EventQueueTab />}

      {activeTab === 'events' && <EventsTab />}

      {activeTab === 'planning' && <RoadmapMarketingTab />}

      {activeTab === 'email' && <EmailTab />}

      {activeTab === 'feedback' && <FeedbackTabAdmin />}

      {activeTab === 'ephemeris' && (
        <div className="px-5 py-4 max-w-2xl">
          <EphemerisCheckTab />
        </div>
      )}

      {activeTab === 'highlights' && <FeatureHighlightsTab />}

      {activeTab === 'settings' && (
        <div className="px-5 py-4 max-w-2xl">
          <SettingsTab />
        </div>
      )}
    </div>
  );
}