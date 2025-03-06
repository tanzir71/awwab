
import { Check, Clock } from "lucide-react";
import { Prayer } from "@/types/Prayer";
import { cn } from "@/lib/utils";

interface PrayerTimelineProps {
  prayers: Prayer[];
}

const PrayerTimeline = ({ prayers }: PrayerTimelineProps) => {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-muted"></div>
      
      {prayers.map((prayer, index) => (
        <div 
          key={prayer.name} 
          className={cn(
            "relative flex items-start mb-4 pl-12",
            prayer.isNext && "animate-pulse"
          )}
        >
          {/* Timeline dot */}
          <div className={cn(
            "absolute left-2 top-1.5 w-5 h-5 rounded-full flex items-center justify-center",
            prayer.isCompleted ? "bg-primary" : 
            prayer.isNext ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"
          )}>
            {prayer.isCompleted && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>

          <div className={cn(
            "flex-1 rounded-lg border p-4",
            prayer.isNext ? "bg-primary/5 border-primary" : "bg-card"
          )}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className={cn(
                  "font-semibold",
                  prayer.isNext && "text-primary"
                )}>
                  {prayer.name}
                  {prayer.isNext && <span className="ml-2 text-xs font-normal bg-primary/20 text-primary px-2 py-0.5 rounded-full">Next</span>}
                </h3>
                <p className="text-sm text-muted-foreground">{prayer.rakats} Rakats</p>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{prayer.time}</span>
              </div>
            </div>
            
            {prayer.isNext && (
              <div className="mt-3 flex justify-end">
                <button 
                  className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded-md"
                  onClick={() => console.log("Mark as completed:", prayer.name)}
                >
                  Mark as Prayed
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PrayerTimeline;
