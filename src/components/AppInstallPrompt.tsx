
import { useState, useEffect } from "react";
import { Bell, Download } from "lucide-react";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestNotificationPermission, checkNotificationPermission } from "@/lib/prayerServices";
import { useToast } from "@/hooks/use-toast";

const AppInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>("default");
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [showNotificationCard, setShowNotificationCard] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if notifications are already enabled
    const currentPermission = checkNotificationPermission();
    setNotificationStatus(currentPermission);
    
    // Only show notification permission request if not already granted or denied
    if (currentPermission === "default" && "Notification" in window) {
      setShowNotificationCard(true);
    }
    
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
  
  const handleNotificationPermissionClick = async () => {
    const granted = await requestNotificationPermission();
    setNotificationStatus(granted ? "granted" : "denied");
    setShowNotificationCard(false);
    
    toast({
      title: granted ? "Notifications Enabled" : "Notifications Disabled",
      description: granted 
        ? "You will receive alerts for upcoming prayers." 
        : "You won't receive prayer time alerts. You can enable them in your browser settings.",
      duration: 3000,
    });
  };
  
  if (!showNotificationCard && !showInstallCard) {
    return null;
  }
  
  return (
    <div className="space-y-4 mb-6">
      {showNotificationCard && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Enable Prayer Notifications</CardTitle>
            <CardDescription>Receive alerts when it's time for prayer</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              onClick={handleNotificationPermissionClick}
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              Enable Notifications
            </Button>
          </CardFooter>
        </Card>
      )}
      
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
