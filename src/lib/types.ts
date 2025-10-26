
export type StatusHistory = {
  id: string;
  status: 'Wishlist' | 'Planting' | 'Growing' | 'Harvest';
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

export type AiDataset = {
  plants: Plant[];
  locations: GardenLocation[];
}
