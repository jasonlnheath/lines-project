/**
 * Onboarding Wrapper
 * Client component that wraps the main content and shows onboarding modal if needed
 */

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { OnboardingModal } from './OnboardingModal';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const { needsOnboarding, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* Show onboarding modal if needed */}
      {needsOnboarding && <OnboardingModal />}

      {/* Main content */}
      {children}
    </>
  );
}
