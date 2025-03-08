
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const AppInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

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
      e.preventDefault();
      setInstallPromptEvent(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show prompt for iOS users
    if (isIOSDevice && !isAppInstalled) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent && !isIOS) return;

    if (installPromptEvent) {
      // For Android/Chrome
      installPromptEvent.prompt();
      const choiceResult = await installPromptEvent.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setIsVisible(false);
      }
      
      setInstallPromptEvent(null);
    }
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-50">
      <div className="flex items-center justify-between">
        <div className="mr-4">
          <p className="font-medium">Install Prayer Tracker</p>
          <p className="text-sm text-muted-foreground">
            {isIOS 
              ? 'Add to your home screen for a better experience'
              : 'Install this app on your device'}
          </p>
        </div>
        <Button onClick={handleInstallClick} size="sm">
          <Download className="mr-2 h-4 w-4" />
          {isIOS ? 'Tap Share, then Add to Home Screen' : 'Install'}
        </Button>
      </div>
    </div>
  );
};

export default AppInstallPrompt;
