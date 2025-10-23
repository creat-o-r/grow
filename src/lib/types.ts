
export type Plant = {
  id: string;
  species: string;
  germinationNeeds: string;
  optimalConditions: string;
  status: 'Planning' | 'Planting' | 'Growing';
};

export type Conditions = {
  temperature: string;
  sunlight: string;
  soil: string;
};

export type GardenLocation = {
  id: string;
  name: string;
  location: string;
  temperatureUnit: 'C' | 'F';
  conditions: Conditions;
};
