

export type PlantStatus = 'Wishlist' | 'Planting' | 'Growing' | 'Harvest';

export type StatusHistory = {
  id: string;
  status: PlantStatus;
  date: string; // ISO String
  notes?: string;
};

export type ForkProvenance = {
  instanceUrl?: string;
  author?: string;
  datasetKey?: string;
  timestamp: string;
  parentUid?: string;
};

export type ContributorMeta = {
  name: string;
  githubOrNostr?: string;
  url?: string;
};

export type CommunityViabilitySignal = {
  id: string;
  speciesUid: string;
  species: string;
  region: string;
  season?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  soil?: string;
  verdict: 'spot-on' | 'way-off' | 'harvest-verified';
  viability?: 'High' | 'Medium' | 'Low';
  notes?: string;
  authorPubkey?: string;
  authorName?: string;
  timestamp: string;
};

export type FreeLlmConfig = {
  gemini: string;
  groq?: string;
  openrouter?: string;
  ollamaUrl?: string;
  preferLocalAi?: boolean;
  communityMcpUrls?: string[];
};

// Represents the core, unchanging information about a plant species
export type Plant = {
  id:string;
  uid?: string; // Deterministic content-addressed slug for P2P & fork merging
  species: string;
  germinationNeeds: string;
  optimalConditions: string;
  imageUrl?: string;
  isExistingVariation?: boolean;
  variationReason?: string;
  relatedExistingPlant?: string;
  forkedFrom?: ForkProvenance;
  contributor?: ContributorMeta;
  verifiedGrowerCount?: number;
};

export type ViabilityLevel = 'High' | 'Medium' | 'Low';
export type SeasonName = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export type PropagationMethod = 
  | 'seed' 
  | 'transplant' 
  | 'cutting' 
  | 'air-layering' 
  | 'division' 
  | 'runner' 
  | 'bulb-clove';

export type SeasonalViability = {
  season: SeasonName;
  viability: ViabilityLevel;
  score?: number;
  reasoning: string;
};

export type WishViabilityData = {
  stage?: 'Wishlist';
  overallViability: ViabilityLevel;
  seasons: SeasonalViability[];
  activeSeasonMatch?: boolean;
  bestSeason?: SeasonName;
  reasoning?: string;
};

export type PrepViabilityData = {
  stage?: 'Planting';
  prepViability: ViabilityLevel;
  growViability: ViabilityLevel;
  harvestViability: ViabilityLevel;
  overallViability: ViabilityLevel;
  prepReasoning?: string;
  growReasoning?: string;
  harvestReasoning?: string;
  summary?: string;
};

export type GrowViabilityData = {
  stage?: 'Growing';
  vigorViability: ViabilityLevel;
  stressFactor?: 'None' | 'Heat Stress' | 'Frost Risk' | 'Drought Risk' | 'Light Deficit';
  tendingAdvice: string;
  reasoning: string;
};

export type HarvestViabilityData = {
  stage?: 'Harvest';
  ripenessViability: ViabilityLevel;
  harvestWindow: 'Peak Window' | 'Approaching End' | 'Overdue / Bolt Risk';
  successionAdvice: string;
  reasoning: string;
};

export type StageViability =
  | WishViabilityData
  | PrepViabilityData
  | GrowViabilityData
  | HarvestViabilityData;

export type PrepForecast = PrepViabilityData;
export type GrowAssessment = GrowViabilityData;
export type HarvestAssessment = HarvestViabilityData;

// Represents a specific instance or "lot" of a plant being grown
export type Planting = {
  id: string;
  uid?: string;
  plantId: string;
  gardenId: string;
  name: string; // e.g., "Spring Carrots 2024"
  createdAt: string; // ISO String
  history: StatusHistory[];
  seedsOnHand?: number;
  plannedQty?: number;
  propagationMethod?: PropagationMethod;
  swapAvailable?: boolean;
  viability?: ViabilityLevel;
  viabilityReasoning?: string;
  viabilityAssessedAt?: string;
  upcomingViability?: 'High' | 'Medium';
  upcomingTiming?: string;
  upcomingReasoning?: string;
  stageViability?: StageViability;
  seasonalViabilities?: SeasonalViability[];
  prepForecast?: PrepViabilityData;
  growAssessment?: GrowAssessment;
  harvestAssessment?: HarvestAssessment;
  forkedFrom?: ForkProvenance;
}

export type Conditions = {
  temperature: string;
  sunlight: string;
  soil: string;
  currentSeason?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
};

export type GardenSyncTopology = 'mirror' | 'coop' | 'none';

export type GardenLocation = {
  id: string;
  uid?: string;
  name: string;
  location: string;
  temperatureUnit: 'C' | 'F';
  conditions: Conditions;
  growingSystems?: string;
  growingMethods?: string;
  p2pRoomId?: string;
  syncTopology?: GardenSyncTopology;
  trustedGrowers?: string[];
  autoSyncInward?: boolean;
  autoSyncOutward?: boolean;
  lastSyncedAt?: string;
  forkedFrom?: ForkProvenance;
};

export type AiLog = {
    id: string;
    timestamp: string; // ISO String
    flow: string;
    prompt: any;
    results?: any;
    status?: 'success' | 'error';
    error?: string;
    feedback?: 'way-off' | 'bad' | 'ok' | 'spot-on';
    viabilityType?: ViabilityAnalysisMode;
    model?: string;
    sharedSignalId?: string;
}

export type AiDataset = {
  plants: Plant[];
  plantings: Planting[];
  locations: GardenLocation[];
  forkedFrom?: ForkProvenance;
  contributor?: ContributorMeta;
}

// A helper type for combining Plant and Planting data for display
export interface PlantingWithPlant extends Planting {
  plant: Plant;
  garden?: GardenLocation;
}

export type ViabilityAnalysisMode = 'local' | 'ai';
export type GardenViewMode = 'one' | 'selected' | 'all';


    
