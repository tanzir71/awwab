
import { useState } from "react";

interface MosqueProgressProps {
  streak: number;
}

const MosqueProgress = ({ streak }: MosqueProgressProps) => {
  const [showInfo, setShowInfo] = useState(false);
  
  // Define mosque building stages based on streak count
  const stages = [
    { threshold: 0, name: "Foundation" },
    { threshold: 5, name: "Walls" },
    { threshold: 10, name: "Dome" },
    { threshold: 15, name: "Minarets" },
    { threshold: 20, name: "Complete Mosque" },
  ];
  
  // Calculate current stage
  const currentStage = stages.reduce((prev, curr) => {
    return streak >= curr.threshold ? curr : prev;
  }, stages[0]);
  
  // Find next stage
  const nextStageIndex = stages.findIndex(stage => stage.name === currentStage.name) + 1;
  const nextStage = nextStageIndex < stages.length ? stages[nextStageIndex] : null;
  
  // Calculate progress to next stage
  const calculateProgress = () => {
    if (!nextStage) return 100;
    
    const currentThreshold = currentStage.threshold;
    const nextThreshold = nextStage.threshold;
    const progress = ((streak - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    
    return Math.min(progress, 100);
  };
  
  return (
    <div className="p-6 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pattern-dots pattern-bg-transparent pattern-size-2 pattern-white"></div>
      
      {/* Mosque visualization */}
      <div className="flex justify-center mb-6">
        <div className="relative w-64 h-48 flex items-end justify-center">
          {/* Base foundation - always visible */}
          <div className="absolute bottom-0 w-full h-1/6 bg-primary/20 rounded-sm"></div>
          
          {/* Walls - visible after 5 days */}
          {streak >= 5 && (
            <div className="absolute bottom-1/6 w-4/5 h-2/6 bg-primary/30 rounded-t-lg"></div>
          )}
          
          {/* Dome - visible after 10 days */}
          {streak >= 10 && (
            <div className="absolute bottom-3/6 left-1/2 -translate-x-1/2 w-3/5 h-2/6 bg-primary/40 rounded-full overflow-hidden">
              <div className="absolute bottom-0 w-full h-1/2"></div>
            </div>
          )}
          
          {/* Minarets - visible after 15 days */}
          {streak >= 15 && (
            <>
              <div className="absolute bottom-1/6 left-1/6 w-1/12 h-4/6 bg-primary/50 rounded-t-lg"></div>
              <div className="absolute bottom-1/6 right-1/6 w-1/12 h-4/6 bg-primary/50 rounded-t-lg"></div>
            </>
          )}
          
          {/* Complete Mosque - visible after 20 days */}
          {streak >= 20 && (
            <div className="absolute top-1/6 left-1/2 -translate-x-1/2 w-1/5 h-1/6 bg-primary/60 rounded-full"></div>
          )}
        </div>
      </div>
      
      {/* Progress information */}
      <div className="text-center">
        <h3 className="text-lg font-medium">{currentStage.name} Stage</h3>
        <p className="text-sm text-muted-foreground mb-2">
          {nextStage 
            ? `${streak} / ${nextStage.threshold} days to ${nextStage.name}`
            : "Mosque complete! Continue your streak to maintain it."}
        </p>
        
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2.5 mb-2">
          <div 
            className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${calculateProgress()}%` }}
          ></div>
        </div>
        
        {/* Info button */}
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showInfo ? "Hide info" : "How it works"}
        </button>
        
        {/* Info panel */}
        {showInfo && (
          <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm">
            <p>Complete your daily prayers to build your mosque. Each stage requires consistent prayer:</p>
            <ul className="mt-1 space-y-1 text-xs">
              {stages.map((stage, index) => (
                <li key={index} className="flex justify-between">
                  <span>{stage.name}:</span>
                  <span>{stage.threshold} days</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">Miss a day and you'll need to start rebuilding!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MosqueProgress;
