import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Navigation, Layers } from 'lucide-react';

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

interface Map3DProps {
  locations: Location[];
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  showControls?: boolean;
  height?: string;
  onLocationClick?: (location: Location) => void;
  selectedUserId?: string;
  selectedHistory?: { lat: number; lng: number }[];
}

const Map3D = ({
  locations,
  center = [0, 0],
  zoom = 2,
  pitch = 60,
  bearing = 0,
  showControls = true,
  height = '600px',
  onLocationClick,
  selectedUserId: selectedUserIdProp,
  selectedHistory = [],
}: Map3DProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [is3D, setIs3D] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [followEnabled, setFollowEnabled] = useState<boolean>(true);
  const [userDevicePos, setUserDevicePos] = useState<{ lat: number; lng: number } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Calculate center from locations if available
    const mapCenter = locations.length > 0
      ? [locations[0].longitude, locations[0].latitude]
      : center;

    const mapZoom = locations.length > 0 ? 12 : zoom;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: mapCenter as [number, number],
      zoom: mapZoom,
      pitch: pitch,
      bearing: bearing,
      antialias: true,
      attributionControl: true,
    });

    // Add navigation controls
    if (showControls) {
      map.current.addControl(new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      }), 'top-right');

      // Add geolocate control
      map.current.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
        }),
        'top-right'
      );

      // Add scale control
      map.current.addControl(
        new maplibregl.ScaleControl({
          maxWidth: 80,
          unit: 'metric',
        }),
        'bottom-left'
      );
    }

    // Add 3D terrain when map loads
    map.current.on('load', () => {
      if (!map.current) return;

      // Add 3D buildings layer
      map.current.addLayer({
        id: '3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'render_height'],
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'render_min_height'],
          ],
          'fill-extrusion-opacity': 0.6,
        },
      });
    });

    return () => {
      // Cleanup markers
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Sync selectedUserId from prop
  useEffect(() => {
    if (selectedUserIdProp) setSelectedUserId(selectedUserIdProp);
  }, [selectedUserIdProp]);

  // Watch device position for distance/bearing and navigation
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserDevicePos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!map.current) return;

    // Remove existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers
    locations.forEach((location) => {
      if (!map.current) return;

      // Create custom marker element with avatar and battery badge
      const el = document.createElement('div');
      el.className = 'employee-marker';
      el.style.position = 'relative';
      el.style.width = '42px';
      el.style.height = '42px';
      el.style.cursor = 'pointer';
      el.style.transition = 'transform 0.2s ease';
      el.style.filter = 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))';

      const img = document.createElement('img');
      img.src = (location.profiles as any)?.avatar_url || '/icons/design-asia.png';
      img.alt = location.profiles.full_name;
      img.style.width = '42px';
      img.style.height = '42px';
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      img.style.border = '2px solid white';

      const badge = document.createElement('div');
      badge.style.position = 'absolute';
      badge.style.right = '-4px';
      badge.style.bottom = '-4px';
      badge.style.minWidth = '20px';
      badge.style.height = '20px';
      badge.style.padding = '0 4px';
      badge.style.borderRadius = '10px';
      badge.style.fontSize = '11px';
      badge.style.lineHeight = '20px';
      badge.style.color = 'white';
      badge.style.textAlign = 'center';

      const batteryLevel = location.battery_level;
      let bgColor = '#10b981';
      if (batteryLevel < 20) bgColor = '#ef4444';
      else if (batteryLevel < 50) bgColor = '#f59e0b';
      badge.style.backgroundColor = bgColor;
      badge.textContent = `${batteryLevel}%`;

      el.appendChild(img);
      el.appendChild(badge);

      // Add hover effect
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.12)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      // Create popup
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px;">
          <h3 style="font-weight: bold; margin-bottom: 4px;">${location.profiles.full_name}</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${location.profiles.email}</p>
          <p style="font-size: 12px; margin-bottom: 2px;">Battery: ${location.battery_level}%</p>
          <p style="font-size: 12px; margin-bottom: 2px;">Accuracy: ${location.accuracy}m</p>
          <p style="font-size: 11px; color: #888;">${new Date(location.timestamp).toLocaleString()}</p>
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps?q=${location.latitude},${location.longitude}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: #2563eb;">Open Maps</a>
          </div>
        </div>
      `);

      // Create marker
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map.current);

      // Add click handler
      el.addEventListener('click', () => {
        if (map.current) {
          map.current.flyTo({
            center: [location.longitude, location.latitude],
            zoom: 16,
            pitch: 60,
            bearing: -20,
            duration: 800,
          });
        }
        setSelectedUserId(location.user_id);
        if (onLocationClick) onLocationClick(location);
      });

      markers.current.push(marker);
    });

    // Fit bounds to show all markers if none selected or follow disabled
    if ((!selectedUserId || !followEnabled) && locations.length > 0 && map.current) {
      const bounds = new maplibregl.LngLatBounds();
      locations.forEach((location) => bounds.extend([location.longitude, location.latitude]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 800 });
    }

    // If a user is selected, keep them centered on updates
    if (selectedUserId && followEnabled && map.current) {
      const loc = locations.find(l => l.user_id === selectedUserId);
      if (loc) {
        map.current.easeTo({ center: [loc.longitude, loc.latitude], zoom: 16, duration: 600 });
      }
    }
    // Update selected history line/points
    if (map.current) {
      const sourceId = 'selected-history';
      const pointsSourceId = 'selected-history-points';
      const hasHistory = selectedUserId && selectedHistory.length > 1;
      const lineGeo = {
        type: 'FeatureCollection',
        features: hasHistory ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: selectedHistory.map(p => [p.lng, p.lat]) } }] : [],
      } as any;
      const pointsGeo = {
        type: 'FeatureCollection',
        features: selectedHistory.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
      } as any;

      if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(lineGeo);
      } else if (hasHistory) {
        map.current.addSource(sourceId, { type: 'geojson', data: lineGeo });
        map.current.addLayer({ id: 'selected-history-line', type: 'line', source: sourceId, paint: { 'line-color': '#2563eb', 'line-width': 3 } });
      }

      if (map.current.getSource(pointsSourceId)) {
        (map.current.getSource(pointsSourceId) as maplibregl.GeoJSONSource).setData(pointsGeo);
      } else if (selectedHistory.length > 0) {
        map.current.addSource(pointsSourceId, { type: 'geojson', data: pointsGeo });
        map.current.addLayer({ id: 'selected-history-points', type: 'circle', source: pointsSourceId, paint: { 'circle-color': '#2563eb', 'circle-radius': 3, 'circle-opacity': 0.8 } });
      }
    }

  }, [locations, onLocationClick, selectedUserId, followEnabled, selectedHistory]);

  // Compute distance and bearing
  const computeDistanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  };

  const computeBearingDeg = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const brng = Math.atan2(y, x);
    return (toDeg(brng) + 360) % 360;
  };

  // Toggle 3D view
  const toggle3D = () => {
    if (!map.current) return;
    
    if (is3D) {
      map.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
    } else {
      map.current.easeTo({
        pitch: 60,
        bearing: -20,
        duration: 1000,
      });
    }
    setIs3D(!is3D);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!mapContainer.current) return;

    if (!isFullscreen) {
      if (mapContainer.current.requestFullscreen) {
        mapContainer.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Fly to user location
  const flyToLocation = () => {
    if (!map.current || locations.length === 0) return;

    const firstLocation = locations[0];
    map.current.flyTo({
      center: [firstLocation.longitude, firstLocation.latitude],
      zoom: 16,
      pitch: 60,
      bearing: -20,
      duration: 2000,
      essential: true,
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative" style={{ height: isFullscreen ? '100vh' : height }}>
        <div ref={mapContainer} className="w-full h-full" />
        
        {/* Custom controls */}
        {showControls && (
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            <Button
              variant="secondary"
              size="icon"
              onClick={toggle3D}
              title={is3D ? 'Switch to 2D' : 'Switch to 3D'}
              className="shadow-lg"
            >
              <Layers className="h-4 w-4" />
            </Button>
            
            <Button
              variant="secondary"
              size="icon"
              onClick={flyToLocation}
              title="Fly to location"
              className="shadow-lg"
              disabled={locations.length === 0}
            >
              <Navigation className="h-4 w-4" />
            </Button>
            
            <Button
              variant="secondary"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="shadow-lg"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Follow toggle */}
            <Button
              variant={followEnabled ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setFollowEnabled(!followEnabled)}
              title="Toggle Follow"
              className="shadow-lg"
              disabled={!selectedUserId}
            >
              {followEnabled ? 'Following' : 'Follow off'}
            </Button>
          </div>
        )}

        {/* Location counter */}
        {locations.length > 0 && (
          <div className="absolute bottom-4 left-4 z-10">
            <Card className="px-3 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">
                  {locations.length} Active {locations.length === 1 ? 'User' : 'Users'}
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* Distance/Bearing overlay */}
        {selectedUserId && userDevicePos && (
          (() => {
            const loc = locations.find(l => l.user_id === selectedUserId);
            if (!loc) return null;
            const emp = { lat: loc.latitude, lng: loc.longitude };
            const dist = computeDistanceMeters(userDevicePos, emp);
            const bearing = computeBearingDeg(userDevicePos, emp);
            const distLabel = dist >= 1000 ? `${(dist/1000).toFixed(2)} km` : `${Math.round(dist)} m`;
            const bearingLabel = `${Math.round(bearing)}°`;
            const navHref = `https://www.google.com/maps/dir/?api=1&destination=${emp.lat},${emp.lng}`;
            return (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                <Card className="px-4 py-2 shadow-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-sm">Distance: <b>{distLabel}</b></span>
                    <span className="text-sm">Bearing: <b>{bearingLabel}</b></span>
                    <a href={navHref} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="default">Navigate</Button>
                    </a>
                  </div>
                </Card>
              </div>
            );
          })()
        )}

        {/* Following status */}
        {selectedUserId && followEnabled && (
          <div className="absolute bottom-4 left-52 z-10">
            <Card className="px-3 py-2 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm">Following selected employee</span>
                <Button size="sm" variant="outline" onClick={() => setFollowEnabled(false)}>Stop</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Attribution */}
        <div className="absolute bottom-4 right-4 z-10">
          <Card className="px-2 py-1 shadow-lg">
            <a
              href="https://openfreemap.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              OpenFreeMap
            </a>
          </Card>
        </div>
      </div>
    </Card>
  );
};

export default Map3D;

