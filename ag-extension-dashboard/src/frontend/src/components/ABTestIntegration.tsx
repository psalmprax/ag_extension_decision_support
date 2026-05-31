import React, { useState, useEffect } from 'react';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { ABTestBanner, DesignToggle } from '@/components/ABTestBanner';
import DashboardStats from '@/components/DashboardStats';
import FarmerTable from '@/components/FarmerTable';
import ChatInterface from '@/components/ChatInterface';
import VisitsPage from '@/components/VisitsPage';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { shouldShowABTest, setShowABTest } = useFeatureFlags();
  const [hasChosenDesign, setHasChosenDesign] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const flags = useFeatureFlags.getState();
    if (flags.shouldShowABTest && !hasChosenDesign) {
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasChosenDesign]);

  const handleChooseDesign = () => {
    setHasChosenDesign(true);
    setShowBanner(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {showBanner && (
        <ABTestBanner onClose={handleChooseDesign} />
      )}
      
      {children}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { setShowABTest } = useFeatureFlags();
  
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Settings
      </h1>
      
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Design Preference
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Choose your preferred design. You can switch anytime.
          </p>
          <DesignToggle />
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Show A/B Test Prompt
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Enable to show the design preference prompt on next visit.
          </p>
          <button
            onClick={() => setShowABTest(true)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
          >
            Reset A/B Test
          </button>
        </div>
      </div>
    </div>
  );
};

export const ExampleDashboardPage: React.FC = () => {
  const sampleFarmers = [
    { id: '1', name: 'John Doe', phone: '+2547 123 45678', region: 'Nairobi', crops: 'Maize' },
    { id: '2', name: 'Jane Smith', phone: '+2547 987 65432', region: 'Kisumu', crops: 'Rice' },
    { id: '3', name: 'Bob Wilson', phone: '+2547 456 78901', region: 'Nakuru', crops: 'Wheat' },
  ];

  const sampleMessages = [
    { id: '1', role: 'user' as const, content: 'How can I improve soil quality for maize?' },
    { id: '2', role: 'assistant' as const, content: 'Here are some tips for improving soil quality...' },
  ];

  const sampleVisits = [
    { id: '1', farmerName: 'John Doe', date: 'Apr 13', time: '9:00 AM', type: 'Routine' },
    { id: '2', farmerName: 'Jane Smith', date: 'Apr 13', time: '11:00 AM', type: 'Follow-up' },
    { id: '3', farmerName: 'Bob Wilson', date: 'Apr 14', time: '10:00 AM', type: 'Inspection' },
    { id: '4', farmerName: 'Alice Brown', date: 'Apr 15', time: '2:00 PM', type: 'Consultation' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h1>
      
      <DashboardStats />
      
      <div className="mt-8">
        <FarmerTable farmers={sampleFarmers} />
      </div>
      
      <div className="mt-8 h-96">
        <ChatInterface messages={sampleMessages} onSend={() => {}} />
      </div>
      
      <div className="mt-8 h-96">
        <VisitsPage visits={sampleVisits} />
      </div>
    </div>
  );
};

export default AppLayout;
