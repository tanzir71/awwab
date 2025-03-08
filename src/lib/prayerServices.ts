import { Prayer } from "@/types/Prayer";
import { isPrayerCompletedToday } from "./storageService";

let notificationPermission: NotificationPermission = "default";

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported in this browser");
    return false;
  }

  try {
    // Request permission directly
    notificationPermission = await Notification.requestPermission();
    localStorage.setItem("notificationPermission", notificationPermission);
    
    // If granted, send a test notification
    if (notificationPermission === "granted") {
      new Notification("Prayer Notifications Enabled", {
        body: "You will now receive alerts for upcoming prayer times.",
        icon: "/favicon.ico",
      });
    }
    
    return notificationPermission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

export const checkNotificationPermission = (): NotificationPermission => {
  if (!("Notification" in window)) {
    return "denied";
  }
  
  // Get current browser permission
  const browserPermission = Notification.permission;
  
  // Use browser's current value
  if (browserPermission) {
    notificationPermission = browserPermission;
    localStorage.setItem("notificationPermission", notificationPermission);
  } else {
    const savedPermission = localStorage.getItem("notificationPermission");
    if (savedPermission) {
      notificationPermission = savedPermission as NotificationPermission;
    }
  }
  
  return notificationPermission;
};

export const scheduleNotification = (prayer: Prayer): void => {
  if (!("Notification" in window) || notificationPermission !== "granted") {
    return;
  }

  try {
    // Get the prayer time
    const prayerTime = convertTo24Hour(prayer.time);
    const [hours, minutes] = prayerTime.split(":").map(Number);
    
    // Create a Date object for this prayer time today
    const prayerDate = new Date();
    prayerDate.setHours(hours, minutes, 0, 0);
    
    // Get current time
    const now = new Date();
    
    // Only schedule if the prayer time is in the future
    if (prayerDate > now) {
      const timeUntilPrayer = prayerDate.getTime() - now.getTime();
      
      // Schedule the notification
      setTimeout(() => {
        new Notification(`Time for ${prayer.name} Prayer`, {
          body: `It's time for ${prayer.name} prayer (${prayer.rakats.total} Rakats: ${prayer.prayerOrder})`,
          icon: '/favicon.ico',
        });
      }, timeUntilPrayer);
      
      console.log(`Notification scheduled for ${prayer.name} in ${Math.round(timeUntilPrayer / 60000)} minutes`);
    }
  } catch (error) {
    console.error(`Error scheduling notification for ${prayer.name}:`, error);
  }
};

export const fetchPrayerTimes = async (latitude: number, longitude: number): Promise<Prayer[]> => {
  try {
    // Get the current date
    const date = new Date();
    const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
    
    // Fetch prayer times from the API
    const response = await fetch(
      `https://api.aladhan.com/v1/timings/${formattedDate}?latitude=${latitude}&longitude=${longitude}&method=2`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch prayer times");
    }
    
    const data = await response.json();
    const timings = data.data.timings;
    
    // Create prayer objects with accurate rakats info including Sunnah and Fard
    const prayers: Prayer[] = [
      { 
        name: "Fajr", 
        time: timings.Fajr, 
        rakats: {
          sunnah: 2,
          fard: 2,
          total: 4
        },
        prayerOrder: "2 Sunnah → 2 Fard"
      },
      { 
        name: "Dhuhr", 
        time: timings.Dhuhr, 
        rakats: {
          sunnah: 4,
          fard: 4,
          nafl: 2,
          sunnah2: 2,
          total: 12
        },
        prayerOrder: "4 Sunnah → 4 Fard → 2 Nafl → 2 Sunnah"
      },
      { 
        name: "Asr", 
        time: timings.Asr, 
        rakats: {
          sunnah: 4,
          fard: 4,
          total: 8
        },
        prayerOrder: "4 Sunnah → 4 Fard"
      },
      { 
        name: "Maghrib", 
        time: timings.Maghrib, 
        rakats: {
          fard: 3,
          sunnah: 2,
          nafl: 2,
          total: 7
        },
        prayerOrder: "3 Fard → 2 Sunnah → 2 Nafl"
      },
      { 
        name: "Isha", 
        time: timings.Isha, 
        rakats: {
          sunnah: 4,
          fard: 4,
          nafl: 2,
          witr: 3,
          total: 13
        },
        prayerOrder: "4 Sunnah → 4 Fard → 2 Nafl → 3 Witr"
      }
    ];
    
    // Determine which prayers are completed and which is next
    const currentTime = new Date();
    let hasSetNextPrayer = false;
    
    const processedPrayers = prayers.map(prayer => {
      const prayerTime = convertTo24Hour(prayer.time);
      const prayerDateTime = new Date();
      const [hours, minutes] = prayerTime.split(":").map(Number);
      prayerDateTime.setHours(hours, minutes, 0);
      
      // Check if completed from local storage
      const isCompletedToday = isPrayerCompletedToday(prayer.name);
      
      // Only mark as completed based on time if not manually completed
      const isCompleted = isCompletedToday || currentTime > prayerDateTime;
      
      // Mark the next upcoming prayer
      let isNext = false;
      if (!isCompleted && !hasSetNextPrayer) {
        isNext = true;
        hasSetNextPrayer = true;
      }
      
      return {
        ...prayer,
        isCompleted,
        isNext
      };
    });
    
    // Schedule notifications for upcoming prayers if permission is granted
    if (checkNotificationPermission() === "granted") {
      processedPrayers.filter(prayer => !prayer.isCompleted).forEach(scheduleNotification);
    }
    
    return processedPrayers;
  } catch (error) {
    console.error("Error in fetchPrayerTimes:", error);
    throw error;
  }
};

// Helper function to convert prayer times to 24-hour format
const convertTo24Hour = (timeStr: string): string => {
  // The API returns times in 24-hour format (HH:MM), but we'll keep this helper
  // in case we need to handle different formats in the future
  return timeStr;
};
