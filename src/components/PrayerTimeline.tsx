
import { Check, Clock } from "lucide-react";
import { Prayer } from "@/types/Prayer";
import { cn } from "@/lib/utils";
import { markPrayerAsCompleted, isPrayerCompletedToday, unmarkPrayerAsCompleted } from "@/lib/storageService";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface PrayerTimelineProps {
  prayers: Prayer[];
  onPrayerCompleted?: () => void;
}

const PrayerTimeline = ({ prayers, onPrayerCompleted }: PrayerTimelineProps) => {
  const { toast } = useToast();
  const [completedPrayers, setCompletedPrayers] = useState<string[]>([]);
  
  // Initialize completed prayers from local storage
  useEffect(() => {
    const updatedPrayers = prayers.map(prayer => {
      const isCompleted = isPrayerCompletedToday(prayer.name);
      return {
        ...prayer,
        isCompleted
      };
    });
    
    setCompletedPrayers(updatedPrayers.filter(p => p.isCompleted).map(p => p.name));
  }, [prayers]);
  
  const handleMarkAsCompleted = (prayer: Prayer) => {
    // Mark prayer as completed in storage
    markPrayerAsCompleted(prayer);
    
    // Update local state
    setCompletedPrayers(prev => [...prev, prayer.name]);
    
    // Show toast notification
    toast({
      title: "Prayer Completed",
      description: `${prayer.name} prayer has been recorded. Keep it up!`,
      duration: 3000,
    });
    
    // Notify parent component if callback provided
    if (onPrayerCompleted) {
      onPrayerCompleted();
    }
  };

  const handleUnmarkPrayer = (prayer: Prayer) => {
    // Unmark prayer in storage
    unmarkPrayerAsCompleted(prayer.name);
    
    // Update local state
    setCompletedPrayers(prev => prev.filter(name => name !== prayer.name));
    
    // Show toast notification
    toast({
      title: "Prayer Unmarked",
      description: `${prayer.name} prayer has been unmarked.`,
      duration: 3000,
    });
    
    // Notify parent component if callback provided
    if (onPrayerCompleted) {
      onPrayerCompleted();
    }
  };
  
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-muted"></div>
      
      {prayers.map((prayer, index) => {
        const isCompletedToday = completedPrayers.includes(prayer.name);
        
        return (
          <div 
            key={prayer.name} 
            className={cn(
              "relative flex items-start mb-4 pl-12",
              prayer.isNext && !isCompletedToday && "animate-pulse"
            )}
          >
            {/* Timeline dot */}
            <div className={cn(
              "absolute left-2 top-1.5 w-5 h-5 rounded-full flex items-center justify-center",
              isCompletedToday ? "bg-primary" : 
              prayer.isNext ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"
            )}>
              {isCompletedToday && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>

            <div className={cn(
              "flex-1 rounded-lg border p-4",
              prayer.isNext && !isCompletedToday ? "bg-primary/5 border-primary" : "bg-card"
            )}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={cn(
                    "font-semibold",
                    prayer.isNext && !isCompletedToday && "text-primary"
                  )}>
                    {prayer.name}
                    {prayer.isNext && !isCompletedToday && 
                      <span className="ml-2 text-xs font-normal bg-primary/20 text-primary px-2 py-0.5 rounded-full">Next</span>
                    }
                  </h3>
                  <div className="mt-1">
                    <p className="text-sm text-muted-foreground mb-1">{prayer.rakats.total} Rakats Total</p>
                    <p className="text-xs text-muted-foreground bg-muted inline-block px-2 py-1 rounded">
                      {prayer.prayerOrder}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{prayer.time}</span>
                </div>
              </div>
              
              <div className="mt-3 flex justify-end">
                {isCompletedToday ? (
                  <button 
                    className="bg-red-500 text-white text-sm px-3 py-1 rounded-md hover:bg-red-600 transition-colors"
                    onClick={() => handleUnmarkPrayer(prayer)}
                  >
                    Unmark Prayer
                  </button>
                ) : (
                  <button 
                    className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded-md hover:bg-primary/90 transition-colors"
                    onClick={() => handleMarkAsCompleted(prayer)}
                  >
                    Mark as Prayed
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PrayerTimeline;
