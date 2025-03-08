
import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import NotificationToggle from "./NotificationToggle";

const AppInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showInstallCard, setShowInstallCard] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPromptEvent(e);
      // Show the install card
      setShowInstallCard(true);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    
    // Show the install prompt
    installPromptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await installPromptEvent.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      toast({
        title: "App Installed",
        description: "Prayer Tracker has been installed on your device!",
        duration: 3000,
      });
    }
    
    // Hide the card regardless of outcome
    setShowInstallCard(false);
    // Clear the saved prompt since it can't be used again
    setInstallPromptEvent(null);
  };
  
  return (
    <div className="space-y-4 mb-6">
      {/* Always show the notification toggle */}
      <NotificationToggle />
      
      {showInstallCard && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Install Prayer Tracker App</CardTitle>
            <CardDescription>Add this app to your home screen for quick access</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              onClick={handleInstallClick}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default AppInstallPrompt;
