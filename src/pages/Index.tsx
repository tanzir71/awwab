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

  const getLocationFromIP = async () => {
    try {
      console.log("Attempting to get location from IP address");
      const response = await fetch("https://ipapi.co/json/");
      if (!response.ok) {
        throw new Error("Failed to get location from IP");
      }
      
      const data = await response.json();
      if (data.latitude && data.longitude) {
        console.log("Location obtained from IP:", data.latitude, data.longitude);
        setLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error getting location from IP:", error);
      return false;
    }
  };

  useEffect(() => {
    const getLocation = async () => {
      if (navigator.geolocation) {
        try {
          const locationPromise = new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                setLocation({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                });
                console.log("Location obtained successfully:", position.coords.latitude, position.coords.longitude);
                resolve(true);
              },
              (error) => {
                console.log("Geolocation error:", error.code, error.message);
                reject(error);
              },
              { 
                enableHighAccuracy: true, 
                timeout: 5000, 
                maximumAge: 0 
              }
            );
          });
          
          await Promise.race([
            locationPromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Geolocation timeout")), 5000)
            )
          ]);
        } catch (error) {
          console.log("Browser geolocation failed, trying IP geolocation");
          
          const ipLocationSuccess = await getLocationFromIP();
          
          if (!ipLocationSuccess) {
            console.log("Using default location (Mecca)");
            toast({
              title: "Using Default Location",
              description: "We're using Mecca for prayer times. Allow location access for local times.",
              duration: 5000,
            });
          }
        }
      } else {
        console.log("Geolocation not supported by this browser, trying IP geolocation");
        
        const ipLocationSuccess = await getLocationFromIP();
        
        if (!ipLocationSuccess) {
          console.log("IP geolocation failed. Using default location (Mecca)");
          toast({
            title: "Location Not Supported",
            description: "Your browser doesn't support location. Using Mecca for prayer times.",
            duration: 5000,
          });
        }
      }
    };
    
    getLocation();
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted pb-12">
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
