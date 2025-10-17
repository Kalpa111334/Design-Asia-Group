import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, MapPin, Circle, Navigation } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import GeofenceMap from '@/components/GeofenceMap';

interface Geofence {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
}

const Geofences = () => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    radius_meters: '100',
  });

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGeofences(data || []);
    } catch (error: any) {
      Alert.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      Alert.error('Error', 'Geolocation is not supported by this browser.');
      return;
    }

    setGettingLocation(true);
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      
      setFormData(prev => ({
        ...prev,
        latitude: latitude.toString(),
        longitude: longitude.toString()
      }));

      Alert.success('Location Found', `Current location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    } catch (error: any) {
      let errorMessage = 'Failed to get current location.';
      
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please allow location access and try again.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your connection and try again.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      }
      
      Alert.error('Location Error', errorMessage);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleCreateGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('geofences').insert([
        {
          ...formData,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          radius_meters: parseInt(formData.radius_meters),
          created_by: user?.id,
          is_active: true,
        },
      ]);

      if (error) throw error;

      Alert.success('Geofence created successfully');

      setOpen(false);
      setFormData({ name: '', description: '', latitude: '', longitude: '', radius_meters: '100' });
      fetchGeofences();
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  const toggleGeofence = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('geofences')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      Alert.success('Geofence status updated');

      fetchGeofences();
    } catch (error: any) {
      Alert.error('Error', error.message);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p>Loading geofences...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Geofences</h1>
            <p className="text-muted-foreground">Manage location boundaries</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Geofence
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Geofence</DialogTitle>
                <DialogDescription>
                  Define a new geofence boundary
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateGeofence} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                    className="flex items-center gap-2"
                  >
                    <Navigation className={`w-4 h-4 ${gettingLocation ? 'animate-spin' : ''}`} />
                    {gettingLocation ? 'Getting Location...' : 'Use Current Location'}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius">Radius (meters)</Label>
                  <Input
                    id="radius"
                    type="number"
                    value={formData.radius_meters}
                    onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Create Geofence</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Map and List Tabs */}
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="map">Map View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>

          {/* Map View Tab */}
          <TabsContent value="map" className="mt-6">
            <GeofenceMap
              geofences={geofences}
              height="700px"
              showControls={true}
              onGeofenceClick={(geofence) => {
                // Could open details dialog here
                console.log('Clicked geofence:', geofence);
              }}
              onMapClick={(lngLat) => {
                // Pre-fill form with clicked location
                setFormData({
                  ...formData,
                  latitude: lngLat.lat.toFixed(6),
                  longitude: lngLat.lng.toFixed(6),
                });
                setOpen(true);
              }}
            />
          </TabsContent>

          {/* List View Tab */}
          <TabsContent value="list" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {geofences.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No geofences found</p>
              </CardContent>
            </Card>
          ) : (
            geofences.map((geofence) => (
              <Card key={geofence.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{geofence.name}</CardTitle>
                      <CardDescription>{geofence.description}</CardDescription>
                    </div>
                    <Badge variant={geofence.is_active ? 'default' : 'secondary'}>
                      {geofence.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {geofence.latitude.toFixed(6)}, {geofence.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Circle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Radius: {geofence.radius_meters}m
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleGeofence(geofence.id, geofence.is_active)}
                    >
                      {geofence.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <a
                      href={`https://www.google.com/maps?q=${geofence.latitude},${geofence.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="ghost">
                        View on Map
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Geofences;
