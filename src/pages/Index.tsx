
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PrayerTimeline from "@/components/PrayerTimeline";
import AppInstallPrompt from "@/components/AppInstallPrompt";
import { Prayer } from "@/types/Prayer";
import { fetchPrayerTimes } from "@/lib/prayerServices";
import { calculatePrayerStatistics } from "@/lib/storageService";
import { Award, Calendar, Flame, CalendarCheck } from "lucide-react";

const Index = () => {
  const [location, setLocation] = useState({ latitude: 21.4225, longitude: 39.8262 }); // Default to Mecca
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [statistics, setStatistics] = useState({
    currentStreak: 0,
    bestStreak: 0,
    completionRate: 0,
    totalPrayersCompleted: 0,
    uniqueDays: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          console.log("Location obtained successfully:", position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.log("Geolocation error:", error.code, error.message);
          // Using default location (Mecca) that was set in initial state
          toast({
            title: "Using Default Location",
            description: "We're using Mecca for prayer times. Allow location access for local times.",
            duration: 5000,
          });
          // Continue with default location, no need to set it again
        },
        { 
          enableHighAccuracy: true, 
          timeout: 5000, 
          maximumAge: 0 
        }
      );
    } else {
      console.log("Geolocation not supported by this browser");
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support location. Using Mecca for prayer times.",
        duration: 5000,
      });
      // Continue with default location
    }
  }, [toast]);

  useEffect(() => {
    const loadPrayerTimes = async () => {
      try {
        setLoading(true);
        console.log("Fetching prayer times for location:", location.latitude, location.longitude);
        const prayerData = await fetchPrayerTimes(location.latitude, location.longitude);
        setPrayers(prayerData);
      } catch (error) {
        console.error("Error fetching prayer times:", error);
        toast({
          title: "Error",
          description: "Could not fetch prayer times. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPrayerTimes();
  }, [location, toast]);

  useEffect(() => {
    setStatistics(calculatePrayerStatistics());
  }, [prayers, activeTab]);
  
  const handlePrayerCompleted = () => {
    setStatistics(calculatePrayerStatistics());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">PrayerTracker</h1>
          <p className="text-muted-foreground">
            Build your spiritual journey, one prayer at a time
          </p>
        </header>

        <Tabs defaultValue="today" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="today" className="space-y-4">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-pulse text-center">
                  <p>Loading prayer times...</p>
                </div>
              </div>
            ) : (
              <PrayerTimeline prayers={prayers} onPrayerCompleted={handlePrayerCompleted} />
            )}
          </TabsContent>
          
          <TabsContent value="stats">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="text-xl font-medium">Your Prayer Journey</h3>
                    <p className="text-4xl font-bold">{statistics.currentStreak} days</p>
                    <p className="text-muted-foreground">Current streak</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center">
                      <Calendar className="h-5 w-5 mb-1 text-primary" />
                      <p className="text-2xl font-bold">{statistics.uniqueDays}</p>
                      <p className="text-sm text-muted-foreground">Total active days</p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center">
                      <CalendarCheck className="h-5 w-5 mb-1 text-primary" />
                      <p className="text-2xl font-bold">{statistics.totalPrayersCompleted}</p>
                      <p className="text-sm text-muted-foreground">Total prayers</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center">
                      <Flame className="h-5 w-5 mb-1 text-primary" />
                      <p className="text-2xl font-bold">{statistics.completionRate}%</p>
                      <p className="text-sm text-muted-foreground">Completion rate</p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg flex flex-col items-center">
                      <Award className="h-5 w-5 mb-1 text-primary" />
                      <p className="text-2xl font-bold">{statistics.bestStreak}</p>
                      <p className="text-sm text-muted-foreground">Best streak</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <AppInstallPrompt />
    </div>
  );
};

export default Index;
