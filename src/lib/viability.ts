
import type { Plant, PlantingWithPlant, Conditions } from '@/lib/types';

export type Viability = 'High' | 'Medium' | 'Low';
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';


const getSunlightScore = (plantNeeds: string, gardenSunlight: string): number => {
    plantNeeds = plantNeeds.toLowerCase();
    gardenSunlight = gardenSunlight.toLowerCase();

    const plantFullSun = plantNeeds.includes('full sun');
    const plantPartialShade = plantNeeds.includes('partial shade') || plantNeeds.includes('part sun');
    const plantShade = plantNeeds.includes('shade') || plantNeeds.includes('indirect light');

    const gardenFullSun = gardenSunlight.includes('full sun') || gardenSunlight.includes('8+') || gardenSunlight.includes('6-8');
    const gardenPartialShade = gardenSunlight.includes('partial') || gardenSunlight.includes('4-6');
    const gardenShade = gardenSunlight.includes('shade') || gardenSunlight.includes('indirect');

    if (plantFullSun && gardenFullSun) return 2;
    if (plantFullSun && gardenPartialShade) return 1; // Tolerable but not ideal
    if (plantPartialShade && (gardenFullSun || gardenPartialShade)) return 2;
    if (plantShade && (gardenPartialShade || gardenShade)) return 2;
    if (plantShade && gardenFullSun) return 0; // Bad match

    return 0;
};

const getTemperatureScore = (plantNeeds: string, gardenTemp: string): number => {
    plantNeeds = plantNeeds.toLowerCase();
    gardenTemp = gardenTemp.toLowerCase();

    const tempValue = parseInt(gardenTemp.replace(/[^0-9-]/g, ''), 10);
    if (isNaN(tempValue)) return 1; // Neutral if no temp provided

    const isFahrenheit = gardenTemp.includes('f');
    const tempInC = isFahrenheit ? (tempValue - 32) * 5 / 9 : tempValue;

    const needsWarm = plantNeeds.includes('warm') || plantNeeds.includes('hot');
    const needsCool = plantNeeds.includes('cool') || plantNeeds.includes('frost');
    const isTolerant = plantNeeds.includes('tolerant') || plantNeeds.includes('adaptable');

    if (needsWarm && tempInC > 18) return 2; // > 65F
    if (needsWarm && tempInC > 13) return 1; // > 55F
    if (needsCool && tempInC < 21) return 2; // < 70F
    if (needsCool && tempInC < 27) return 1; // < 80F
    
    if (plantNeeds.includes('frost') && tempInC < 10) return 2;
    if (plantNeeds.includes('no frost') && tempInC < 5) return 0;

    if(isTolerant) return 2;

    return 1; // Default to medium if no strong signals
};


const getSoilScore = (plantNeeds: string, gardenSoil: string): number => {
    plantNeeds = plantNeeds.toLowerCase();
    gardenSoil = gardenSoil.toLowerCase();
    let score = 0;

    const goodKeywords = ['well-drained', 'loam', 'fertile', 'rich', 'compost', 'organic'];
    const typeKeywords = ['sandy', 'clay', 'alkaline', 'acidic'];

    goodKeywords.forEach(keyword => {
        if (plantNeeds.includes(keyword) && gardenSoil.includes(keyword)) {
            score++;
        }
    });
    
    typeKeywords.forEach(keyword => {
        if (plantNeeds.includes(keyword) && gardenSoil.includes(keyword)) {
            score += 2; // Stronger match for specific soil types
        }
    });

    if (plantNeeds.includes('well-drained') && gardenSoil.includes('well-drained')) score = 2; // very important

    return Math.min(score, 2); // Cap score at 2
};


// A more "analyst-like" local viability calculation.
export const analyzeViability = (plant: Plant, conditions: Conditions): Viability => {
  if (!conditions?.sunlight && !conditions?.temperature && !conditions?.soil) {
    return 'Low';
  }

  const plantInfo = `${plant.optimalConditions} ${plant.germinationNeeds}`.toLowerCase();
  
  const sunScore = getSunlightScore(plantInfo, conditions.sunlight || '');
  const tempScore = getTemperatureScore(plantInfo, conditions.temperature || '');
  const soilScore = getSoilScore(plantInfo, conditions.soil || '');
  
  const totalScore = sunScore + tempScore + soilScore;

  if (totalScore >= 5) return 'High';
  if (totalScore >= 3) return 'Medium';
  return 'Low';
};


export const getSuitableSeasons = (plant: Plant): string[] => {
    const text = `${plant.germinationNeeds} ${plant.optimalConditions}`.toLowerCase();
    const seasons: string[] = [];
    if (text.includes('spring')) seasons.push('Spring');
    if (text.includes('summer')) seasons.push('Summer');
    if (text.includes('autumn') || text.includes('fall')) seasons.push('Autumn');
    if (text.includes('winter')) seasons.push('Winter');
    return seasons;
};

    
