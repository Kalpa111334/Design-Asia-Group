import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Battery } from 'lucide-react';
import Layout from '@/components/Layout';

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
  };
}

const Locations = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_locations')
        .select(`
          id,
          user_id,
          latitude,
          longitude,
          accuracy,
          battery_level,
          timestamp,
          profiles (full_name, email)
        `)
        .eq('is_active', true)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      
      const uniqueLocations = data?.reduce((acc: any[], curr: any) => {
        if (!acc.find((loc) => loc.user_id === curr.user_id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      setLocations(uniqueLocations || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p>Loading locations...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Employee Locations</h1>
          <p className="text-muted-foreground">Real-time location tracking</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active locations found</p>
              </CardContent>
            </Card>
          ) : (
            locations.map((location) => (
              <Card key={location.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {location.profiles?.full_name || 'Unknown User'}
                      </CardTitle>
                      <CardDescription>{location.profiles?.email}</CardDescription>
                    </div>
                    <Badge variant="default">
                      <Navigation className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Battery className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Battery: {location.battery_level}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Accuracy: ±{location.accuracy}m
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(location.timestamp).toLocaleString()}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-block"
                  >
                    View on Google Maps →
                  </a>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Locations;
