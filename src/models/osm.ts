export type OsmType = { id?: string; name: string; key: string; value: string; icon?: string };

export const OsmTypes: OsmType[] = [
  { id: 'airport', name: 'Airport', key: 'aeroway', value: 'aerodrome', icon: 'flight' },
  { id: 'cafe', name: 'Cafe', key: 'amenity', value: 'bar', icon: 'local_cafe' },
  { id: 'church', name: 'Church', key: 'building', value: 'church', icon: 'church' },
  { id: 'mosque', name: 'Mosque', key: 'building', value: 'mosque', icon: 'mosque' },
  { id: 'synagogue', name: 'Synagogue', key: 'building', value: 'synagogue', icon: 'synagogue' },
  { id: 'temple', name: 'Temple', key: 'building', value: 'temple', icon: 'temple_buddhist' },
  { id: 'shrine', name: 'Shrine', key: 'building', value: 'shrine', icon: 'temple_hindu' },
  { id: 'city_square', name: 'City square', key: 'place', value: 'square', icon: 'square' },
  {
    id: 'flats',
    name: 'Flats',
    key: '"building:levels"',
    value: '"([6-9]|d{2,})"',
    icon: 'apartment',
  },
  { id: 'gas_station', name: 'Gas station', key: 'amenity', value: 'fuel', icon: 'local_gas_station' },
  { id: 'hospital', name: 'Hospital', key: 'amenity', value: 'hospital', icon: 'local_hospital' },
  { id: 'hotel', name: 'Hotel', key: 'tourism', value: 'hotel', icon: 'hotel' },
  { id: 'palace', name: 'Palace', key: 'castle_type', value: 'palace', icon: 'castle' },
  { id: 'parking', name: 'Parking', key: 'amenity', value: 'parking', icon: 'local_parking' },
  { id: 'restaurant', name: 'Restaurant', key: 'amenity', value: 'restaurant', icon: 'restaurant' },
  {
    id: 'shopping_street',
    name: 'Shopping street',
    key: 'highway',
    value: 'pedestrian',
    icon: 'shopping_bag',
  },
  { id: 'stadspoort', name: 'Stadspoort', key: 'historic', value: 'city_gate', icon: 'archway' },
  { id: 'statue', name: 'Statue', key: 'memorial', value: 'statue', icon: 'person' },
  { id: 'tower', name: 'Tower', key: 'man_made', value: 'tower', icon: 'location_city' },
  { id: 'windmill', name: 'Windmill', key: 'man_made', value: 'windmill', icon: 'wind_power' },
  { id: 'water_tower', name: 'Water tower', key: 'man_made', value: 'water_tower', icon: 'water_drop' },
  { id: 'communications_tower', name: 'Comms tower', key: 'man_made', value: 'communications_tower', icon: 'cell_tower' },
  { id: 'mast', name: 'Mast', key: 'man_made', value: 'mast', icon: 'cell_tower' },
  { id: 'power_plant', name: 'Power plant', key: 'power', value: 'plant', icon: 'factory' },
  { id: 'substation', name: 'Substation', key: 'power', value: 'substation', icon: 'electric_bolt' },
  { id: 'military', name: 'Military area', key: 'landuse', value: 'military', icon: 'military_tech' },
  { id: 'bunker', name: 'Bunker', key: 'military', value: 'bunker', icon: 'shield' },
  { id: 'barracks', name: 'Barracks', key: 'military', value: 'barracks', icon: 'house' },
  { id: 'police', name: 'Police', key: 'amenity', value: 'police', icon: 'local_police' },
  { id: 'fire_station', name: 'Fire station', key: 'amenity', value: 'fire_station', icon: 'local_fire_department' },
];

/** List of all the OSM types */
export const OsmTypeList = OsmTypes.map(({ id }) => id);
