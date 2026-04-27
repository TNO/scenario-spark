import m, { FactoryComponent } from 'mithril';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ContextualItem, OsmTypes } from '../../models';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import osmtogeojson from 'osmtogeojson';

// Fix Leaflet's default icon path issues in webpack/rspack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface MapViewAttrs {
  items: ContextualItem[];
  mapConfig?: {
    lat: number;
    lon: number;
    zoom: number;
  };
  mapUnits?: 'metric' | 'imperial';
  osmAmenities?: string[];
  onMapClick?: (lat: number, lon: number) => void;
  height?: string | number;
  onHeightChange?: (height: number) => void;
  autoFit?: boolean;
}

const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'magenta'];


export const MapView: FactoryComponent<MapViewAttrs> = () => {
  let map: L.Map;
  let layerGroup: L.LayerGroup;
  let osmLayerGroup: L.LayerGroup;
  let resizeObserver: ResizeObserver;
  let resizeMouseMove: ((e: MouseEvent) => void) | null = null;
  let resizeMouseUp: (() => void) | null = null;

  const fetchOsmData = async (bounds: L.LatLngBounds, osmAmenities: string[] = []) => {
      if (!osmAmenities || osmAmenities.length === 0) return;
      
      const url = 'https://overpass-api.de/api/interpreter';
      const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
      let queryParts = '';
      
      osmAmenities.forEach(id => {
          const type = OsmTypes.find((t: any) => t.id === id);
          if (type) {
             queryParts += `node["${type.key}"="${type.value}"](${bbox});\n`;
             queryParts += `way["${type.key}"="${type.value}"](${bbox});\n`;
             queryParts += `relation["${type.key}"="${type.value}"](${bbox});\n`;
          }
      });

      if (!queryParts) return;

      const query = `[out:json][timeout:25];
      (
        ${queryParts}
      );
      out body;
      >;
      out skel qt;`;

      try {
          const response = await fetch(url, {
              method: 'POST',
              body: `data=${encodeURIComponent(query)}`
          });
          if (!response.ok) {
              console.error('OSM fetch failed:', response.statusText);
              return null;
          }
          const text = await response.text();
          if (text.startsWith('<?xml')) {
              console.error('OSM returned XML instead of JSON:', text.substring(0, 100));
              return null;
          }
          const data = JSON.parse(text);
          return osmtogeojson(data);
      } catch (e) {
          console.error('Error fetching OSM data:', e);
          return null;
      }
  };

  const updateMap = async (attrs: MapViewAttrs) => {
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();

    const { items, autoFit } = attrs;
    const layers: L.Layer[] = [];

    for (const item of items) {
        if (item.context !== 'location' && item.context !== 'locationType') continue; 
        
        // Handle coordinate-based items
        const lat = item.lat;
        const lon = item.lon;
        
        if (lat !== undefined && lon !== undefined) {
             const color = colors[items.indexOf(item) % colors.length];
             
             // Marker for the center
             const marker = L.marker([lat, lon])
             .bindPopup(`<b>${item.label}</b><br>${item.desc || ''}`);
             
             marker.addTo(layerGroup);
             layers.push(marker);

             // Radii
             if (item.radii) {
                 const radii = item.radii.split(',').map(r => parseFloat(r.trim())).filter(r => !isNaN(r));
                 radii.forEach(r => {
                     const circle = L.circle([lat, lon], {
                         radius: r,
                         color,
                         weight: 1,
                         dashArray: '5, 5',
                         fillOpacity: 0.05
                     });
                     circle.addTo(layerGroup);
                     layers.push(circle);
                 });
             }
        }
    }

    if (autoFit && layers.length > 0) {
        const group = L.featureGroup(layers);
        map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
    }
  }

  let lastRelevantData = '';

  return {
    oncreate: ({ dom, attrs }) => {
        const { mapConfig } = attrs;
        const lat = mapConfig?.lat || 52.0;
        const lon = mapConfig?.lon || 5.0;
        const zoom = mapConfig?.zoom || 10;
        const mapUnits = attrs.mapUnits || 'metric';
        const imperial = mapUnits === 'imperial';
        
        map = L.map(dom as HTMLElement).setView([lat, lon], zoom);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add Scale
        L.control.scale({ imperial }).addTo(map);

        layerGroup = L.layerGroup().addTo(map);
        osmLayerGroup = L.layerGroup().addTo(map); // Separate group for OSM results

        // Add custom Refresh button control
        const RefreshControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            onAdd: function() {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.style.backgroundColor = 'white';
                container.style.width = '30px';
                container.style.height = '30px';
                container.style.cursor = 'pointer';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.title = 'Refresh OSM Amenities';
                
                const icon = L.DomUtil.create('span', 'material-icons', container);
                icon.innerText = 'refresh';
                icon.style.fontSize = '20px';
                icon.style.color = 'black'; // Ensure icon is visible

                container.onclick = async (e: Event) => {
                    L.DomEvent.stopPropagation(e as any);
                    if (attrs.osmAmenities && attrs.osmAmenities.length > 0) {
                         icon.innerText = 'hourglass_empty'; // Loading state
                         osmLayerGroup.clearLayers();
                         const bounds = map.getBounds();
                         const geoJson = await fetchOsmData(bounds, attrs.osmAmenities);
                         
                         if (geoJson && geoJson.features) {
                             // Filter out features that are "unknown" (no name and no matching type)
                             const features = geoJson.features.filter((f: any) => {
                                 const p = f.properties;
                                 const type = OsmTypes.find((t: any) => p[t.key] === t.value);
                                 return p.name || type;
                             });

                             L.geoJSON(features as any, {
                                 pointToLayer: (feature, latlng) => {
                                     // Find the type based on tags
                                     let iconName = 'location_on';
                                     let color = 'black';
                                     
                                     if (feature.properties) {
                                        const tags = feature.properties;
                                        // Try to find matching OsmType
                                        const type = OsmTypes.find((t: any) => 
                                          (tags[t.key] === t.value) || 
                                          (t.value.startsWith('"') && tags[t.key])
                                        );
                                        if (type && type.icon) {
                                            iconName = type.icon;
                                            color = '#1565c0'; // Blue 800
                                        }
                                     }
                                     
                                     return L.marker(latlng, {
                                         icon: L.divIcon({
                                             className: 'material-icons-marker',
                                             html: `<i class="material-icons" style="color: ${color}; font-size: 24px; text-shadow: 1px 1px 2px white;">${iconName}</i>`,
                                             iconSize: [24, 24],
                                             iconAnchor: [12, 12]
                                         })
                                     });
                                 },
                                 onEachFeature: (feature, layer) => {
                                     if (feature.properties) {
                                         const p = feature.properties;
                                         const type = OsmTypes.find((t: any) => p[t.key] === t.value);
                                         const title = (p.name || (type ? type.name : 'Unknown'));
                                         
                                         // Filter properties to show
                                         const content = Object.entries(p)
                                            .filter(([k]) => ['name', 'amenity', 'building', 'operator', 'website', 'phone'].includes(k) || !['id', 'timestamp', 'version', 'changeset', 'user', 'uid'].includes(k)) 
                                            .map(([k,v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`)
                                            .join('');
                                         
                                         const popupContent = `
                                            <div class="map-popup-card">
                                                <div class="card-content">
                                                    <span class="card-title">${title}</span>
                                                    <table class="striped condensed-table">
                                                        <tbody>
                                                            ${content}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                         `;
                                         layer.bindPopup(popupContent);
                                     }
                                 }
                             }).addTo(osmLayerGroup);
                         }
                         icon.innerText = 'refresh';
                    } else {
                        console.warn('No OSM amenities selected in settings.');
                    }
                };

                return container;
            }
        });
        map.addControl(new RefreshControl());

        updateMap(attrs);

        resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(dom);
    },
    onupdate: ({ attrs }) => {
        const { items, autoFit, mapConfig } = attrs;
        const relevantData = JSON.stringify({
            items: items.map(i => ({
                id: i.id,
                lat: i.lat,
                lon: i.lon,
                locationType: i.locationType,
                radii: i.radii,
                // radius: i.radius, // Deprecated
            })),
            autoFit,
            mapConfig
        });
        
        if (relevantData !== lastRelevantData) {
            lastRelevantData = relevantData;
            updateMap(attrs);
        }
    },
    onremove: () => {
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
        if (resizeMouseMove && resizeMouseUp) {
            window.removeEventListener('mousemove', resizeMouseMove);
            window.removeEventListener('mouseup', resizeMouseUp);
            resizeMouseMove = null;
            resizeMouseUp = null;
        }
        if (map) {
            map.remove();
        }
    },
    view: ({ attrs }) => {
        const height = typeof attrs.height === 'number' ? `${attrs.height}px` : (attrs.height || '400px');
        return m('div.map-container', [
            m('div.map-view', {
                id: 'map-view',
                style: { height, width: '100%', zIndex: 0, position: 'relative' }
            }),
            m('div.map-resize-handle', {
                onmousedown: (e: MouseEvent) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const startHeight = parseInt(height);

                    const moveHandler = (moveEvent: MouseEvent) => {
                        const newHeight = Math.max(100, startHeight + (moveEvent.clientY - startY));
                        if (attrs.onHeightChange) {
                            attrs.onHeightChange(newHeight);
                            m.redraw();
                        }
                    };

                    const upHandler = () => {
                        window.removeEventListener('mousemove', moveHandler);
                        window.removeEventListener('mouseup', upHandler);
                        resizeMouseMove = null;
                        resizeMouseUp = null;
                    };

                    resizeMouseMove = moveHandler;
                    resizeMouseUp = upHandler;
                    window.addEventListener('mousemove', moveHandler);
                    window.addEventListener('mouseup', upHandler);
                }
            })
        ]);
    }
  };
};
