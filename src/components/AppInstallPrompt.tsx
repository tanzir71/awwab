
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

  // Function to check and update notification status
  const updateNotificationStatus = () => {
    const currentPermission = checkNotificationPermission();
    setNotificationStatus(currentPermission);
    
    // Only show notification permission request if not already granted
    if (currentPermission !== "granted" && "Notification" in window) {
      setShowNotificationCard(true);
    } else {
      setShowNotificationCard(false);
    }
  };

  useEffect(() => {
    // Initialize notification status
    updateNotificationStatus();
    
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
    
    // Set up an interval to periodically check notification permission
    // This helps detect when users change permissions in browser settings
    const permissionCheckInterval = setInterval(updateNotificationStatus, 5000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(permissionCheckInterval);
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
    try {
      const granted = await requestNotificationPermission();
      
      // Update status immediately after permission request
      updateNotificationStatus();
      
      toast({
        title: granted ? "Notifications Enabled" : "Notifications Disabled",
        description: granted 
          ? "You will receive alerts for upcoming prayers." 
          : "You won't receive prayer time alerts. Please try again or check browser settings.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast({
        title: "Permission Error",
        description: "There was a problem requesting notification permissions.",
        variant: "destructive",
        duration: 3000,
      });
    }
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
            <CardDescription>
              {notificationStatus === "denied" 
                ? "Notifications are blocked. Please update your browser settings." 
                : "Receive alerts when it's time for prayer"}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              onClick={handleNotificationPermissionClick}
              className="w-full"
              variant={notificationStatus === "denied" ? "outline" : "default"}
            >
              <Bell className="h-4 w-4 mr-2" />
              {notificationStatus === "denied" ? "Update Browser Settings" : "Enable Notifications"}
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
