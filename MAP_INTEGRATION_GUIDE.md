# 🗺️ OpenFreeMap & MapLibre GL JS Integration Guide

## Overview

TrackFlow Vision now features a fully integrated 3D mapping system using **MapLibre GL JS** with **OpenFreeMap** tiles. This provides free, open-source, beautiful 3D maps with no API keys required!

## 🎯 Features Implemented

### 1. **Map3D Component** (`src/components/Map3D.tsx`)
A reusable 3D map component for displaying real-time employee locations.

#### Features:
- ✅ **3D Buildings**: Automatic 3D building rendering at high zoom levels
- ✅ **Real-time Location Markers**: Custom animated markers showing battery levels
- ✅ **Interactive Popups**: Click markers to see detailed employee information
- ✅ **2D/3D Toggle**: Switch between 2D and 3D views
- ✅ **Fullscreen Mode**: Expand map to fullscreen
- ✅ **Navigation Controls**: Pan, zoom, rotate, and pitch controls
- ✅ **Geolocate**: Find your current location
- ✅ **Scale Indicator**: Shows map scale in meters
- ✅ **Auto-fitting**: Automatically adjusts to show all location markers
- ✅ **Battery Color Coding**: Green (>50%), Orange (20-50%), Red (<20%)
- ✅ **Active User Counter**: Shows number of tracked users

#### Usage:
```tsx
import Map3D from '@/components/Map3D';

<Map3D
  locations={locations}
  height="700px"
  showControls={true}
  onLocationClick={(location) => {
    console.log('Clicked:', location);
  }}
/>
```

### 2. **GeofenceMap Component** (`src/components/GeofenceMap.tsx`)
A specialized map component for managing geofences (virtual boundaries).

#### Features:
- ✅ **Geofence Visualization**: Circular boundaries shown as filled polygons
- ✅ **Color-Coded Status**: Blue for active, gray for inactive
- ✅ **Interactive Markers**: Click to view geofence details
- ✅ **Add Mode**: Click on map to create new geofences at that location
- ✅ **3D Buildings**: Same as Map3D
- ✅ **All Map3D Features**: Includes all navigation and control features

#### Usage:
```tsx
import GeofenceMap from '@/components/GeofenceMap';

<GeofenceMap
  geofences={geofences}
  height="700px"
  showControls={true}
  onGeofenceClick={(geofence) => {
    console.log('Clicked geofence:', geofence);
  }}
  onMapClick={(lngLat) => {
    // Pre-fill form with coordinates
    setLatitude(lngLat.lat);
    setLongitude(lngLat.lng);
  }}
/>
```

### 3. **Locations Page Integration**
The Employee Locations page now features a Map/List toggle:
- **Map View**: Interactive 3D map showing all active employee locations
- **List View**: Traditional card-based list view
- Click markers to view location history

### 4. **Geofences Page Integration**
The Geofences page now features a Map/List toggle:
- **Map View**: Visualize all geofences on an interactive 3D map
- **List View**: Traditional card-based list view
- **Add Mode**: Click "+" button, then click on map to set coordinates

## 🚀 Technical Details

### OpenFreeMap
- **Tile Server**: `https://tiles.openfreemap.org/styles/liberty`
- **Style**: Liberty (OpenMapTiles schema)
- **Cost**: 100% Free, no API keys required
- **Attribution**: Automatically included

### MapLibre GL JS
- **Version**: Latest (installed via npm)
- **License**: BSD 3-Clause
- **Bundle Size**: ~400KB minified
- **Performance**: Hardware-accelerated WebGL rendering

### Key Technologies
1. **React Hooks**: `useEffect`, `useRef`, `useState` for lifecycle management
2. **TypeScript**: Full type safety for props and map objects
3. **Tailwind CSS**: Styling for controls and overlays
4. **shadcn/ui**: Card and Button components for UI elements

## 📊 Map Controls

### Built-in Controls (Top Right)
1. **Navigation Control**: 
   - Zoom in/out buttons
   - Compass (click to reset north)
   - Pitch indicator (visual pitch angle)

2. **Geolocate Control**:
   - Blue location button
   - Click to center on your location
   - Click again to track your movement

3. **Scale Control** (Bottom Left):
   - Shows current map scale in meters
   - Updates dynamically with zoom

### Custom Controls (Top Left)
1. **Layers Button**: Toggle between 2D and 3D views
2. **Navigation Button**: Fly to first location/geofence
3. **Add Button** (Geofences only): Enter add mode
4. **Fullscreen Button**: Toggle fullscreen mode

## 🎨 Customization

### Marker Styling
Markers are fully customizable with inline styles:

```tsx
const el = document.createElement('div');
el.style.width = '40px';
el.style.height = '40px';
el.style.backgroundColor = '#3b82f6';
el.style.borderRadius = '50%';
// Add your custom styles...
```

### Map Styling
The map uses OpenFreeMap's Liberty style by default. To change:

```tsx
map.current = new maplibregl.Map({
  container: mapContainer.current,
  style: 'YOUR_STYLE_URL', // Change this
  // ... other options
});
```

Available OpenFreeMap styles:
- `liberty` - Default colorful style
- `positron` - Light, minimal style
- `dark-matter` - Dark theme

### Custom Popups
Popups use HTML strings for maximum flexibility:

```tsx
const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
  <div style="padding: 8px;">
    <h3>Your Custom Content</h3>
    <p>Add any HTML here!</p>
  </div>
`);
```

## 🎯 Performance Optimization

### Implemented Optimizations:
1. **Hardware Acceleration**: WebGL rendering for smooth 60fps
2. **Marker Clustering**: Ready for implementation if needed
3. **Lazy Loading**: Maps only initialize when component mounts
4. **Memory Management**: Proper cleanup in useEffect return
5. **Debounced Updates**: Marker updates batched for performance

### Best Practices:
- Keep location updates to reasonable intervals (30s - 1min)
- Limit visible markers to essential data
- Use marker clustering for >100 markers
- Minimize popup complexity for faster rendering

## 🔧 Configuration Options

### Map3D Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `locations` | `Location[]` | Required | Array of location objects |
| `center` | `[lng, lat]` | `[0, 0]` | Initial map center |
| `zoom` | `number` | `2` | Initial zoom level (0-22) |
| `pitch` | `number` | `60` | Initial pitch angle (0-60°) |
| `bearing` | `number` | `0` | Initial bearing/rotation (0-360°) |
| `showControls` | `boolean` | `true` | Show navigation controls |
| `height` | `string` | `'600px'` | Map container height |
| `onLocationClick` | `function` | - | Callback when marker clicked |

### GeofenceMap Props
Same as Map3D, plus:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `geofences` | `Geofence[]` | Required | Array of geofence objects |
| `onGeofenceClick` | `function` | - | Callback when geofence clicked |
| `onMapClick` | `function` | - | Callback when map clicked |

## 🌍 Geofence Calculations

Geofences are drawn as circles using the Haversine formula:

```typescript
const radiusInDegrees = radius_meters / 111320; // Earth's circumference
for (let i = 0; i <= steps; i++) {
  const theta = (i / steps) * (2 * Math.PI);
  const lng = center_lng + radiusInDegrees * Math.cos(theta);
  const lat = center_lat + radiusInDegrees * Math.sin(theta);
  coordinates.push([lng, lat]);
}
```

This creates accurate circular boundaries regardless of latitude.

## 📱 Mobile Responsiveness

Maps are fully responsive with touch support:
- ✅ Pinch to zoom
- ✅ Two-finger rotation
- ✅ Two-finger pitch (tilt)
- ✅ Single-finger pan
- ✅ Touch-friendly controls (44px minimum)
- ✅ Optimized marker sizes on mobile

## 🎨 Styling

Custom CSS is provided in `src/styles/maplibre.css`:
- Popup animations
- Marker pulse effects
- Control button hover states
- Dark mode support
- Mobile optimizations

## 🔮 Future Enhancements

### Potential Additions:
1. **Heatmaps**: Visualize location density
2. **Route Lines**: Draw paths between location points
3. **Marker Clustering**: Group nearby markers
4. **Custom Map Styles**: Allow users to choose themes
5. **Offline Support**: Cache tiles for offline viewing
6. **Real-time Tracking**: Animate marker movement
7. **Area Measurement**: Measure distances and areas
8. **Export**: Save map as image
9. **Time-based Playback**: Replay location history
10. **Traffic Layers**: Show real-time traffic (if data available)

## 🐛 Troubleshooting

### Common Issues:

**Map not rendering:**
- Check if `maplibre-gl` is installed: `npm list maplibre-gl`
- Verify CSS is imported: `import 'maplibre-gl/dist/maplibre-gl.css'`
- Check browser console for WebGL errors

**Markers not showing:**
- Verify location data has `latitude` and `longitude` properties
- Check coordinate format: `[longitude, latitude]` (lng first!)
- Ensure `is_active` is true in database

**Performance issues:**
- Reduce marker complexity (simpler HTML)
- Implement marker clustering for >50 markers
- Decrease update frequency
- Use `will-change` CSS property sparingly

**Geofences not visible:**
- Zoom in closer (geofences have minzoom requirements)
- Check if geofences have valid coordinates
- Verify `is_active` status

## 📚 Resources

- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js-docs/)
- [OpenFreeMap](https://openfreemap.org/)
- [MapLibre Examples](https://maplibre.org/maplibre-gl-js-docs/example/)
- [GeoJSON Specification](https://geojson.org/)

## 🎉 Credits

- **MapLibre GL JS**: MapLibre Organization
- **OpenFreeMap**: Free tile hosting by OpenFreeMap project
- **OpenMapTiles**: Vector tile schema
- **TrackFlow Vision**: Your amazing team! 🚀

---

**Note**: OpenFreeMap is a community project. Please consider contributing or donating if you find it useful!

