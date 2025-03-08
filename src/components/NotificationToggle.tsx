
import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const NotificationToggle = () => {
  const [enabled, setEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>("default");
  const { toast } = useToast();

  // Update notification status when component mounts and when toggled
  useEffect(() => {
    const updateStatus = () => {
      // Check current browser notification permission state
      const currentPermission = Notification.permission;
      setNotificationStatus(currentPermission);
      // Only set enabled if permission is granted
      setEnabled(currentPermission === "granted");
    };

    updateStatus();
    // Set up a periodic check for permission changes
    const interval = setInterval(updateStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      try {
        // Directly request browser notification permission
        if (!("Notification" in window)) {
          throw new Error("Notifications not supported in this browser");
        }
        
        // Force a new permission request
        const permission = await Notification.requestPermission();
        
        // Update status and toggle state based on result
        setNotificationStatus(permission);
        setEnabled(permission === "granted");
        
        toast({
          title: permission === "granted" ? "Notifications Enabled" : "Notifications Disabled",
          description: permission === "granted" 
            ? "You will receive alerts for upcoming prayers." 
            : "You won't receive prayer time alerts. Please try again or check browser settings.",
          duration: 3000,
        });
      } catch (error) {
        console.error("Error requesting notification permission:", error);
        setEnabled(false);
        toast({
          title: "Permission Error",
          description: "There was a problem requesting notification permissions.",
          variant: "destructive",
          duration: 3000,
        });
      }
    } else {
      // User is explicitly disabling notifications in our UI
      // We can't actually revoke permissions, but we can update our UI state
      setEnabled(false);
      toast({
        title: "Notifications Disabled",
        description: "You won't receive prayer time alerts. Toggle on to re-enable.",
        duration: 3000,
      });
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border rounded-lg bg-card">
      <div className="flex items-center gap-3">
        {enabled ? 
          <Bell className="h-5 w-5 text-primary" /> : 
          <BellOff className="h-5 w-5 text-muted-foreground" />
        }
        <div>
          <h3 className="font-medium">Prayer Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {notificationStatus === "granted" 
              ? "You will be notified when it's time to pray" 
              : notificationStatus === "denied"
                ? "Notifications are blocked in browser settings"
                : "Enable to receive prayer time alerts"}
          </p>
        </div>
      </div>
      <Switch 
        checked={enabled} 
        onCheckedChange={handleToggle}
        disabled={notificationStatus === "denied"}
      />
    </div>
  );
};

export default NotificationToggle;
