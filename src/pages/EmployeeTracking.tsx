import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import Map3D from '@/components/Map3D';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/contexts/PermissionContext';
import NoAccess from '@/components/NoAccess';

interface LocationRow {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  battery_level: number | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string | null;
  } | null;
}

const EmployeeTracking = () => {
  const { hasAccess } = usePermissions();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<Array<{ lat: number; lng: number; ts: number }>>([]);
  const [filter, setFilter] = useState('');
  const isMounted = useRef(false);

  const filteredLocations = useMemo(() => {
    if (!filter) return locations;
    const f = filter.toLowerCase();
    return locations.filter(l => (l.profiles?.full_name || '').toLowerCase().includes(f) || (l.profiles?.email || '').toLowerCase().includes(f));
  }, [locations, filter]);

  useEffect(() => {
    if (!hasAccess('locations')) return; // reuse locations resource
    isMounted.current = true;
    fetchLatestLocations();
    const channel = supabase
      .channel('realtime-employee-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_locations' }, handleRealtime)
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [hasAccess]);

  // Load last N points for selected user
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedHistory([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('employee_locations')
        .select('latitude, longitude, created_at')
        .eq('user_id', selectedUserId)
        .order('created_at', { ascending: false })
        .limit(50);
      const history = (data || []).reverse().map(r => ({ lat: r.latitude as number, lng: r.longitude as number, ts: new Date(r.created_at as any).getTime() }));
      setSelectedHistory(history);
    })();
  }, [selectedUserId]);

  const handleRealtime = (payload: any) => {
    if (!isMounted.current) return;
    const row = payload.new as LocationRow;
    setLocations(prev => {
      const without = prev.filter(p => p.user_id !== row.user_id);
      return [
        {
          ...row,
          profiles: row.profiles || prev.find(p => p.user_id === row.user_id)?.profiles || null,
        },
        ...without,
      ];
    });
    if (selectedUserId && row.user_id === selectedUserId) {
      setSelectedHistory(h => [...h, { lat: row.latitude, lng: row.longitude, ts: new Date(row.created_at as any).getTime() }].slice(-100));
    }
  };

  const fetchLatestLocations = async () => {
    // Pull recent locations and reduce to latest per user
    const { data } = await supabase
      .from('employee_locations')
      .select('id, user_id, latitude, longitude, accuracy, battery_level, created_at, profiles(full_name, email, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(500);

    const latestByUser = new Map<string, LocationRow>();
    (data || []).forEach((r) => {
      if (!latestByUser.has(r.user_id)) latestByUser.set(r.user_id, r as any);
    });
    setLocations(Array.from(latestByUser.values()));
  };

  if (!hasAccess('locations')) {
    return <NoAccess resource="Employee Tracking" />;
  }

  return (
    <Layout>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Employee Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Input
                  placeholder="Filter by name or email"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <Button variant="outline" onClick={fetchLatestLocations} className="w-full">Refresh</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Employees ({filteredLocations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
                {filteredLocations.map((l) => {
                  const lastTs = new Date(l.created_at).getTime();
                  const isLive = Date.now() - lastTs < 20000; // last 20s
                  const lastSeen = new Date(l.created_at).toLocaleTimeString();

                  // compute speed if history available
                  let speedKmh: string | null = null;
                  if (selectedUserId === l.user_id && selectedHistory.length > 1) {
                    const a = selectedHistory[selectedHistory.length - 2];
                    const b = selectedHistory[selectedHistory.length - 1];
                    const d = haversine(a.lat, a.lng, b.lat, b.lng);
                    const dtH = Math.max((b.ts - a.ts) / 3600000, 1e-6);
                    speedKmh = (d / 1000 / dtH).toFixed(1);
                  }

                  return (
                    <button
                      key={l.user_id}
                      onClick={() => setSelectedUserId(l.user_id)}
                      className={`w-full text-left p-2 rounded-md border hover:bg-muted ${selectedUserId === l.user_id ? 'bg-muted' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{l.profiles?.full_name || l.user_id.slice(0,6)}</div>
                          <div className="text-xs text-muted-foreground">{l.profiles?.email}</div>
                        </div>
                        <div className={`text-xs ${isLive ? 'text-green-600' : 'text-amber-600'}`}>{isLive ? 'Live' : 'Idle'}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Last seen: {lastSeen}{speedKmh ? ` • ${speedKmh} km/h` : ''}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Map3D
            locations={filteredLocations as any}
            zoom={14}
            center={filteredLocations.length ? [filteredLocations[0].longitude, filteredLocations[0].latitude] : [79.8612, 6.9271]}
            height="80vh"
            onLocationClick={(loc: any) => setSelectedUserId(loc.user_id)}
            selectedUserId={selectedUserId || undefined}
            selectedHistory={selectedHistory}
          />
        </div>
      </div>
    </Layout>
  );
};

export default EmployeeTracking;

// Haversine distance in meters
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


