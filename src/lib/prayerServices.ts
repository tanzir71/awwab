import { Prayer } from "@/types/Prayer";

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
    
    // Create prayer objects with rakats info
    const prayers: Prayer[] = [
      { name: "Fajr", time: timings.Fajr, rakats: 2 },
      { name: "Dhuhr", time: timings.Dhuhr, rakats: 4 },
      { name: "Asr", time: timings.Asr, rakats: 4 },
      { name: "Maghrib", time: timings.Maghrib, rakats: 3 },
      { name: "Isha", time: timings.Isha, rakats: 4 }
    ];
    
    // Determine which prayers are completed and which is next
    const currentTime = new Date();
    let hasSetNextPrayer = false;
    
    return prayers.map(prayer => {
      const prayerTime = convertTo24Hour(prayer.time);
      const prayerDateTime = new Date();
      const [hours, minutes] = prayerTime.split(":").map(Number);
      prayerDateTime.setHours(hours, minutes, 0);
      
      const isCompleted = currentTime > prayerDateTime;
      
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
