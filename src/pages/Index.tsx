
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PrayerTimeline from "@/components/PrayerTimeline";
import MosqueProgress from "@/components/MosqueProgress";
import { Prayer } from "@/types/Prayer";
import { fetchPrayerTimes } from "@/lib/prayerServices";

const Index = () => {
  const [location, setLocation] = useState({ latitude: 0, longitude: 0 });
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const { toast } = useToast();

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "Location Error",
            description: "Could not get your location. Using default location.",
            variant: "destructive",
          });
          // Set default location (Mecca)
          setLocation({ latitude: 21.4225, longitude: 39.8262 });
        }
      );
    }
  }, [toast]);

  useEffect(() => {
    const loadPrayerTimes = async () => {
      if (location.latitude && location.longitude) {
        try {
          setLoading(true);
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
      }
    };

    loadPrayerTimes();
  }, [location, toast]);

  const streakCount = 15; // This would come from a real tracking system

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Prayer Tracker</h1>
          <p className="text-muted-foreground">
            Build your spiritual journey, one prayer at a time
          </p>
        </header>

        <Card className="mb-8 overflow-hidden">
          <CardContent className="p-0">
            <MosqueProgress streak={streakCount} />
          </CardContent>
        </Card>

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
              <PrayerTimeline prayers={prayers} />
            )}
          </TabsContent>
          
          <TabsContent value="stats">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="text-xl font-medium">Your Prayer Journey</h3>
                    <p className="text-4xl font-bold">{streakCount} days</p>
                    <p className="text-muted-foreground">Current streak</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-2xl font-bold">73%</p>
                      <p className="text-sm text-muted-foreground">Completion rate</p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-2xl font-bold">30</p>
                      <p className="text-sm text-muted-foreground">Days best streak</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
