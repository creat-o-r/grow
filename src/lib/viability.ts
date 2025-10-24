
import type { Plant, Conditions } from '@/lib/types';

export type Viability = 'High' | 'Medium' | 'Low';

// A very simplified analysis function
export const analyzeViability = (plant: Plant, conditions: Conditions): Viability => {
  if (!conditions?.sunlight && !conditions?.temperature && !conditions?.soil) {
    return 'Low';
  }

  let score = 0;
  const plantConditions = `${plant.optimalConditions} ${plant.germinationNeeds}`.toLowerCase();
  
  const gardenSunlight = conditions.sunlight?.toLowerCase() || '';
  const gardenTemp = conditions.temperature?.toLowerCase() || '';
  const gardenSoil = conditions.soil?.toLowerCase() || '';

  // Simple keyword matching
  if (plantConditions.includes('full sun') && (gardenSunlight.includes('full sun') || gardenSunlight.includes('6-8') || gardenSunlight.includes('8+'))) score++;
  if (plantConditions.includes('partial shade') && gardenSunlight.includes('partial')) score++;
  if (plantConditions.includes('warm') && (gardenTemp.includes('warm') || parseInt(gardenTemp) > 65 || parseInt(gardenTemp) > 18)) score++;
  if (plantConditions.includes('cool') && (gardenTemp.includes('cool') || parseInt(gardenTemp) < 65 || parseInt(gardenTemp) < 18)) score++;
  if (plantConditions.includes('well-drained') && gardenSoil.includes('well-drained')) score++;

  if (score >= 2) return 'High';
  if (score === 1) return 'Medium';
  return 'Low';
};
