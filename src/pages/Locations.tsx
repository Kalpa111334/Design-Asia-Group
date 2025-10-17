import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Battery, History, ExternalLink, Clock, TrendingUp, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import Map3D from '@/components/Map3D';

interface Location {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  battery_level: number;
  timestamp: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string | null;
  };
}

interface LocationHistory {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  battery_level: number;
  timestamp: string;
}

interface LocationStats {
  totalLocations: number;
  activeUsers: number;
  avgAccuracy: number;
  lastUpdate: string;
}

const Locations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('24h');
  const [stats, setStats] = useState<LocationStats>({
    totalLocations: 0,
    activeUsers: 0,
    avgAccuracy: 0,
    lastUpdate: '',
  });
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchLocations();
    const channel = supabase
      .channel('location-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_locations',
        },
        () => fetchLocations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [timeFilter]);

  const fetchLocations = async () => {
    try {
      let timeThreshold = new Date();
      switch (timeFilter) {
        case '1h':
          timeThreshold = new Date(Date.now() - 60 * 60 * 1000);
          break;
        case '24h':
          timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      // Get locations without relationships first
      const { data: locationsData, error: locationsError } = await supabase
        .from('employee_locations')
        .select(`
          id,
          user_id,
          latitude,
          longitude,
          accuracy,
          battery_level,
          timestamp
        `)
        .eq('is_active', true)
        .gte('timestamp', timeThreshold.toISOString())
        .order('timestamp', { ascending: false });

      if (locationsError) throw locationsError;

      // Get unique user IDs
      const userIds = [...new Set(locationsData?.map(loc => loc.user_id) || [])];

      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const locationsWithProfiles = locationsData?.map(location => ({
        ...location,
        profiles: profilesData?.find(p => p.id === location.user_id)
      })) || [];

      const uniqueLocations = locationsWithProfiles.reduce((acc: any[], curr: any) => {
        if (!acc.find((loc) => loc.user_id === curr.user_id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      setLocations(uniqueLocations);

      // Calculate stats
      if (locationsData && locationsData.length > 0) {
        const avgAcc = locationsData.reduce((sum, loc) => sum + (loc.accuracy || 0), 0) / locationsData.length;
        const uniqueUsers = new Set(locationsData.map(loc => loc.user_id));
        const latestTimestamp = locationsData[0]?.timestamp || '';

        setStats({
          totalLocations: locationsData.length,
          activeUsers: uniqueUsers.size,
          avgAccuracy: avgAcc,
          lastUpdate: latestTimestamp,
        });
      }
    } catch (error: any) {
      Alert.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_locations')
        .select('id, latitude, longitude, accuracy, battery_level, timestamp')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLocationHistory(data || []);
      setSelectedUserId(userId);
      setHistoryOpen(true);
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  const getTimeSince = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInMs = now.getTime() - then.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy < 10) return { variant: 'default' as const, label: 'Excellent' };
    if (accuracy < 50) return { variant: 'secondary' as const, label: 'Good' };
    if (accuracy < 100) return { variant: 'outline' as const, label: 'Fair' };
    return { variant: 'destructive' as const, label: 'Poor' };
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-success';
    if (level > 20) return 'text-warning';
    return 'text-destructive';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading locations...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Employee Locations</h1>
            <p className="text-muted-foreground">Real-time location tracking and history</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{stats.activeUsers}</div>
                <Users className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{stats.totalLocations}</div>
                <TrendingUp className="w-8 h-8 text-accent opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">±{stats.avgAccuracy.toFixed(0)}m</div>
                <Navigation className="w-8 h-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Update</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold">{stats.lastUpdate ? getTimeSince(stats.lastUpdate) : 'N/A'}</div>
                <Clock className="w-8 h-8 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map and List Tabs */}
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="map">Map View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>

          {/* Map View Tab */}
          <TabsContent value="map" className="mt-6">
            <Map3D
              locations={locations}
              height="700px"
              showControls={true}
              onLocationClick={(location) => {
                fetchLocationHistory(location.user_id);
              }}
              selectedUserId={selectedUserId || undefined}
              selectedHistory={locationHistory.map(h => ({ lat: h.latitude, lng: h.longitude }))}
            />
          </TabsContent>

          {/* List View Tab */}
          <TabsContent value="list" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active locations found in the selected time range</p>
              </CardContent>
            </Card>
          ) : (
            locations.map((location) => {
              const accuracyBadge = getAccuracyBadge(location.accuracy);
              const batteryColor = getBatteryColor(location.battery_level);

              return (
                <Card key={location.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                        {location.profiles?.full_name || 'Unknown User'}
                          <Badge variant="default" className="text-xs">
                            <Navigation className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                      </CardTitle>
                      <CardDescription>{location.profiles?.email}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground font-mono text-xs">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </span>
                  </div>

                      <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                          <Battery className={`w-4 h-4 ${batteryColor}`} />
                          <span className={`text-sm font-medium ${batteryColor}`}>
                            {location.battery_level}%
                    </span>
                  </div>
                        <Badge variant={accuracyBadge.variant} className="text-xs">
                          ±{location.accuracy}m • {accuracyBadge.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Updated {getTimeSince(location.timestamp)}</span>
                      </div>

                  <div className="text-xs text-muted-foreground">
                        {new Date(location.timestamp).toLocaleString()}
                  </div>
                  </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        asChild
                      >
                  <a
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3 mr-2" />
                          View Map
                        </a>
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => fetchLocationHistory(location.user_id)}
                        >
                          <History className="w-3 h-3 mr-2" />
                          History
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Location History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Location History</DialogTitle>
              <DialogDescription>
                Recent location updates for selected user (last 50 records)
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3">
                {locationHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No location history found</p>
                  </div>
                ) : (
                  locationHistory.map((loc, index) => {
                    const accuracyBadge = getAccuracyBadge(loc.accuracy);
                    const batteryColor = getBatteryColor(loc.battery_level);

                    return (
                      <Card key={loc.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  #{index + 1}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(loc.timestamp).toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({getTimeSince(loc.timestamp)})
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span className="font-mono text-xs">
                                  {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2"
                                  asChild
                                >
                                  <a
                                    href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </Button>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Battery className={`w-4 h-4 ${batteryColor}`} />
                                  <span className={`text-xs ${batteryColor}`}>
                                    {loc.battery_level}%
                                  </span>
                                </div>
                                <Badge variant={accuracyBadge.variant} className="text-xs">
                                  ±{loc.accuracy}m
                                </Badge>
                              </div>
                            </div>
                          </div>
                </CardContent>
              </Card>
                    );
                  })
          )}
        </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Locations;
