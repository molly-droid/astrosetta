import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { UserPrefsProvider } from '@/lib/UserPrefsContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Page imports
import Landing from './pages/Landing';
import AccountDeletion from './pages/AccountDeletion';
import Login from './pages/Login';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import MyChart from './pages/MyChart.jsx';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import AppLayout from './components/layout/AppLayout';
import Learn from './pages/Learn';
import Planner from './pages/Planner';
import Subscribe from './pages/Subscribe';
import EventMoment from './pages/EventMoment';
import About from './pages/About';

// Legal / policy pages
import Legal from './pages/Legal';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PrivacyNutritionLabel from './pages/PrivacyNutritionLabel';
import TermsOfService from './pages/TermsOfService';
import CookiePolicy from './pages/CookiePolicy';
import RefundPolicy from './pages/RefundPolicy';
import DmcaPolicy from './pages/DmcaPolicy';
import CaliforniaPrivacyNotice from './pages/CaliforniaPrivacyNotice';
import AccessibilityStatement from './pages/AccessibilityStatement';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-cream">
        <div className="text-center space-y-3">
          <div className="text-3xl text-gold-accent font-display animate-pulse">✦</div>
          <div className="w-6 h-6 border-2 border-gold-primary/40 border-t-gold-accent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Show landing page instead of immediately redirecting
      return (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/delete-account" element={<AccountDeletion />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      );
    }
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/delete-account" element={<AccountDeletion />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Onboarding />} />

      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/chart" element={<MyChart />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/about" element={<About />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/moment" element={<EventMoment />} />
        <Route path="/admin" element={<Admin />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/delete-account" element={<AccountDeletion />} />

      {/* Legal / policy pages */}
      <Route path="/legal" element={<Legal />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/privacy-label" element={<PrivacyNutritionLabel />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />
      <Route path="/dmca" element={<DmcaPolicy />} />
      <Route path="/california-privacy-notice" element={<CaliforniaPrivacyNotice />} />
      <Route path="/accessibility" element={<AccessibilityStatement />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <UserPrefsProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </UserPrefsProvider>
    </AuthProvider>
  );
}

export default App;