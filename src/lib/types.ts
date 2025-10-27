

export type StatusHistory = {
  id: string;
  status: 'Wishlist' | 'Planting' | 'Growing' | 'Harvest';
  date: string; // ISO String
  notes?: string;
};

// Represents the core, unchanging information about a plant species
export type Plant = {
  id:string;
  species: string;
  germinationNeeds: string;
  optimalConditions: string;
};

// Represents a specific instance or "lot" of a plant being grown
export type Planting = {
  id: string;
  plantId: string;
  gardenId: string;
  name: string; // e.g., "Spring Carrots 2024"
  createdAt: string; // ISO String
  history: StatusHistory[];
  seedsOnHand?: number;
  plannedQty?: number;
}

export type Conditions = {
  temperature: string;
  sunlight: string;
  soil: string;
  currentSeason?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
};

export type GardenLocation = {
  id: string;
  name: string;
  location: string;
  temperatureUnit: 'C' | 'F';
  conditions: Conditions;
  growingSystems?: string;
  growingMethods?: string;
};

export type AiLog = {
    id: string;
    timestamp: string; // ISO String
    flow: string;
    prompt: any;
    results: any;
    feedback?: 'way-off' | 'bad' | 'ok' | 'spot-on';
    viabilityType?: ViabilityAnalysisMode;
}

export type AiDataset = {
  plants: Plant[];
  plantings: Planting[];
  locations: GardenLocation[];
}

// A helper type for combining Plant and Planting data for display
export type PlantingWithPlant extends Planting {
  plant: Plant;
  garden?: GardenLocation;
}

export type ViabilityAnalysisMode = 'local' | 'ai';
export type GardenViewMode = 'one' | 'selected' | 'all';

    
