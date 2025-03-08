import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Info, X, Minus } from 'lucide-react';

const AppInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEdge, setIsEdge] = useState(false);

  useEffect(() => {
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;
    setIsStandalone(isAppInstalled);

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const isEdgeBrowser = /Edg/.test(navigator.userAgent);
    setIsEdge(isEdgeBrowser);

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobileDevice && !isAppInstalled) {
      console.log('Mobile device detected, showing install prompt');
      setIsVisible(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      setIsVisible(true);
      console.log('Before install prompt event captured');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      console.log('App was installed');
      setIsVisible(false);
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    
    if (installPromptEvent) {
      try {
        console.log('Showing install prompt');
        await installPromptEvent.prompt();
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
    } else {
      if (isEdge) {
        console.log('Edge browser detected, showing manual instructions');
        setShowIOSInstructions(true);
      } 
      else if (!isIOS && 'serviceWorker' in navigator) {
        console.log('No install prompt available, showing manual instructions');
        setShowIOSInstructions(true);
      } else {
        setShowIOSInstructions(true);
      }
    }
  };

  const handleCloseClick = () => {
    setIsVisible(false);
  };

  const handleMinimizeClick = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 p-2 bg-background border-t border-border z-50 transition-all duration-300 ${isMinimized ? 'max-h-12' : ''}`}>
      {isMinimized ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleMinimizeClick} className="p-1">
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCloseClick} className="p-1">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute top-0 right-0 flex space-x-1">
            <Button variant="ghost" size="sm" onClick={handleMinimizeClick} className="h-8 w-8 p-0">
              <Minus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCloseClick} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between pt-6">
            <div className="mb-2 md:mb-0 md:mr-4">
              <p className="font-medium">Install PrayerTracker</p>
              <p className="text-sm text-muted-foreground">
                {isIOS 
                  ? 'Add to your home screen for a better experience'
                  : isEdge
                    ? 'Install this app on Microsoft Edge for offline access'
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
            ) : showIOSInstructions && isEdge ? (
              <div className="mt-2 text-sm p-3 bg-muted rounded-md">
                <p className="font-semibold mb-1">How to install in Microsoft Edge:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Tap the hamburger menu (≡) in the bottom right corner</li>
                  <li>Select "Add to home" from the menu</li>
                  <li>Follow the on-screen instructions to complete installation</li>
                </ol>
              </div>
            ) : showIOSInstructions && !isIOS ? (
              <div className="mt-2 text-sm p-3 bg-muted rounded-md">
                <p className="font-semibold mb-1">How to install:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Tap the menu icon (three dots) in the top right</li>
                  <li>Select "Install app" or "Add to Home screen"</li>
                  <li>Follow the on-screen instructions</li>
                </ol>
              </div>
            ) : (
              <Button onClick={handleInstallClick} size="sm">
                <Download className="mr-2 h-4 w-4" />
                {isIOS ? 'Show Instructions' : isEdge ? 'Show Instructions' : 'Install Now'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppInstallPrompt;
