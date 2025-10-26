

export type StatusHistory = {
  id: string;
  status: 'Planning' | 'Planting' | 'Growing' | 'Harvested' | 'Dormant';
  date: string; // ISO String
  notes?: string;
};

export type Plant = {
  id:string;
  species: string;
  germinationNeeds: string;
  optimalConditions: string;
  history: StatusHistory[];
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

export type AiLog = {
    id: string;
    timestamp: string; // ISO String
    flow: string;
    prompt: any;
    results: any;
}

export type ApiKeys = {
  gemini: string;
};

export interface Dataset {
    plants: Plant[];
    locations: GardenLocation[];
}
    
