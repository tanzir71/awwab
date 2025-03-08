
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const AppInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode already
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;
    setIsStandalone(isAppInstalled);

    // Detect iOS device
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPromptEvent(e);
      setIsVisible(true);
      console.log('Before install prompt event captured');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if PWA criteria is met for iOS (after page load)
    if (isIOSDevice && !isAppInstalled) {
      // Set timeout to ensure we check after page is fully loaded
      setTimeout(() => {
        console.log('iOS device detected, setting prompt visibility');
        setIsVisible(true);
      }, 1000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    
    if (installPromptEvent) {
      // For Android/Chrome
      console.log('Showing install prompt');
      installPromptEvent.prompt();
      
      try {
        const choiceResult = await installPromptEvent.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setIsVisible(false);
        } else {
          console.log('User dismissed the install prompt');
        }
      } catch (error) {
        console.error('Error with install prompt:', error);
      }
      
      setInstallPromptEvent(null);
    }
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-50">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div className="mb-2 md:mb-0 md:mr-4">
          <p className="font-medium">Install PrayerTracker</p>
          <p className="text-sm text-muted-foreground">
            {isIOS 
              ? 'Add to your home screen for a better experience'
              : 'Install this app on your device for offline access'}
          </p>
        </div>
        
        {showIOSInstructions && isIOS ? (
          <div className="mt-2 text-sm p-3 bg-muted rounded-md">
            <p className="font-semibold mb-1">How to install:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Tap the share icon <span className="inline-block px-2">⎙</span> at the bottom of your browser</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" in the top right</li>
            </ol>
          </div>
        ) : (
          <Button onClick={handleInstallClick} size="sm">
            <Download className="mr-2 h-4 w-4" />
            {isIOS ? 'Show Instructions' : 'Install Now'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default AppInstallPrompt;
