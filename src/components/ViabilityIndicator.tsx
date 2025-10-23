import { useMemo } from 'react';
import type { Plant, GardenConditions } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Viability = 'High' | 'Medium' | 'Low' | 'Unknown';

// A very simplified analysis function
const analyzeViability = (plant: Plant, conditions: GardenConditions): Viability => {
  let score = 0;
  const plantConditions = `${plant.optimalConditions} ${plant.germinationNeeds}`.toLowerCase();
  
  const gardenSunlight = conditions.sunlight.toLowerCase();
  const gardenTemp = conditions.temperature.toLowerCase();
  const gardenSoil = conditions.soil.toLowerCase();

  // Simple keyword matching
  if (plantConditions.includes('full sun') && (gardenSunlight.includes('full sun') || gardenSunlight.includes('6-8') || gardenSunlight.includes('8+'))) score++;
  if (plantConditions.includes('partial shade') && gardenSunlight.includes('partial')) score++;
  if (plantConditions.includes('warm') && (gardenTemp.includes('warm') || parseInt(gardenTemp) > 65)) score++;
  if (plantConditions.includes('cool') && (gardenTemp.includes('cool') || parseInt(gardenTemp) < 65)) score++;
  if (plantConditions.includes('well-drained') && gardenSoil.includes('well-drained')) score++;

  if (score >= 2) return 'High';
  if (score === 1) return 'Medium';
  return 'Low';
};


export function ViabilityIndicator({ plant, gardenConditions }: { plant: Plant; gardenConditions: GardenConditions }) {
  const viability = useMemo(() => analyzeViability(plant, gardenConditions), [plant, gardenConditions]);

  const viabilityConfig = {
    High: { text: 'High Viability', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800' },
    Medium: { text: 'Medium Viability', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800' },
    Low: { text: 'Low Viability', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800' },
    Unknown: { text: 'Unknown Viability', className: '' },
  };

  const config = viabilityConfig[viability];

  return (
    <Badge variant="outline" className={cn("font-normal", config.className)}>
      {config.text}
    </Badge>
  );
}
