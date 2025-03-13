
import { Prayer } from "@/types/Prayer";

// Key for storing completed prayers in localStorage
const COMPLETED_PRAYERS_KEY = "completedPrayers";
const LAST_ACTIVE_DAY_KEY = "lastActiveDay";

// Interface for storing prayer completion data
export interface PrayerCompletion {
  date: string; // Format: YYYY-MM-DD
  prayerName: string;
  completedAt: string; // ISO string
}

// Get the current date in local timezone (YYYY-MM-DD)
export const getCurrentLocalDate = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Check if a new day has started since last app activity
export const hasNewDayStarted = (): boolean => {
  const currentDate = getCurrentLocalDate();
  const lastActiveDay = localStorage.getItem(LAST_ACTIVE_DAY_KEY);
  
  if (!lastActiveDay) {
    // First time using the app
    localStorage.setItem(LAST_ACTIVE_DAY_KEY, currentDate);
    return false;
  }
  
  if (currentDate !== lastActiveDay) {
    // Update the last active day
    localStorage.setItem(LAST_ACTIVE_DAY_KEY, currentDate);
    return true;
  }
  
  return false;
};

// Get all completed prayers from localStorage
export const getCompletedPrayers = (): PrayerCompletion[] => {
  try {
    const storedData = localStorage.getItem(COMPLETED_PRAYERS_KEY);
    if (!storedData) return [];
    return JSON.parse(storedData);
  } catch (error) {
    console.error("Error retrieving completed prayers:", error);
    return [];
  }
};

// Mark a prayer as completed
export const markPrayerAsCompleted = (prayer: Prayer): void => {
  try {
    const completedPrayers = getCompletedPrayers();
    const today = getCurrentLocalDate();
    
    // Check if prayer is already completed today
    const alreadyCompleted = completedPrayers.some(
      (p) => p.date === today && p.prayerName === prayer.name
    );
    
    if (!alreadyCompleted) {
      completedPrayers.push({
        date: today,
        prayerName: prayer.name,
        completedAt: new Date().toISOString(),
      });
      
      localStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify(completedPrayers));
      
      // Update last active day
      localStorage.setItem(LAST_ACTIVE_DAY_KEY, today);
    }
  } catch (error) {
    console.error("Error marking prayer as completed:", error);
  }
};

// Unmark a prayer (remove it from completed prayers)
export const unmarkPrayerAsCompleted = (prayerName: string): void => {
  try {
    const completedPrayers = getCompletedPrayers();
    const today = getCurrentLocalDate();
    
    // Filter out the prayer for today
    const updatedPrayers = completedPrayers.filter(
      (p) => !(p.date === today && p.prayerName === prayerName)
    );
    
    localStorage.setItem(COMPLETED_PRAYERS_KEY, JSON.stringify(updatedPrayers));
  } catch (error) {
    console.error("Error unmarking prayer:", error);
  }
};

// Calculate statistics based on completed prayers
export const calculatePrayerStatistics = () => {
  const completedPrayers = getCompletedPrayers();
  const today = getCurrentLocalDate();
  
  // Get unique dates where at least one prayer was completed
  const uniqueDates = [...new Set(completedPrayers.map(p => p.date))];
  
  // Calculate current streak
  let currentStreak = 0;
  const sortedDates = [...uniqueDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  // Check if any prayer was completed today
  const prayedToday = sortedDates[0] === today;
  
  if (prayedToday) {
    currentStreak = 1; // Start with today
    let checkDate = new Date(today);
    
    // Check consecutive days backwards
    for (let i = 1; i < sortedDates.length; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      const prevDate = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      
      if (sortedDates.includes(prevDate)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
  
  // Calculate best streak
  let bestStreak = 0;
  let tempStreak = 0;
  
  if (sortedDates.length > 0) {
    // Sort dates in ascending order for streak calculation
    const chronologicalDates = sortedDates.sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );
    
    tempStreak = 1;
    for (let i = 1; i < chronologicalDates.length; i++) {
      const currentDate = new Date(chronologicalDates[i]);
      const prevDate = new Date(chronologicalDates[i-1]);
      
      // Set hours to 0 to compare just the dates
      currentDate.setHours(0, 0, 0, 0);
      prevDate.setHours(0, 0, 0, 0);
      
      const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
        tempStreak = 1;
      }
    }
    
    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
  }
  
  // Calculate completion rate (prayers completed / total possible prayers)
  const totalDays = uniqueDates.length;
  const totalPrayersCompleted = completedPrayers.length;
  const totalPossiblePrayers = totalDays * 5; // 5 prayers per day
  const completionRate = totalPossiblePrayers > 0 
    ? Math.round((totalPrayersCompleted / totalPossiblePrayers) * 100) 
    : 0;
  
  return {
    currentStreak,
    bestStreak,
    completionRate,
    totalPrayersCompleted,
    uniqueDays: uniqueDates.length
  };
};

// Check if a prayer is completed for today
export const isPrayerCompletedToday = (prayerName: string): boolean => {
  const completedPrayers = getCompletedPrayers();
  const today = getCurrentLocalDate();
  
  return completedPrayers.some(
    (p) => p.date === today && p.prayerName === prayerName
  );
};
