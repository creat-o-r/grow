export type Plant = {
  id: string;
  species: string;
  germinationNeeds: string;
  optimalConditions: string;
};

export type Conditions = {
  temperature: string;
  sunlight: string;
  soil: string;
};

export type GardenLocation = {
  id: string;
  name: string;
  conditions: Conditions;
};
