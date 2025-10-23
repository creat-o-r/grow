
import type { Plant, GardenLocation } from './types';

export const samplePlants: Plant[] = [
  {
    id: '1',
    species: 'Tomato (Solanum lycopersicum)',
    germinationNeeds: 'Start seeds indoors 6-8 weeks before last frost. Keep soil moist and warm (75-85°F).',
    optimalConditions: 'Full sun (6-8 hours/day). Well-drained, fertile soil with pH 6.0-6.8. Consistent watering.',
    status: 'Growing',
  },
  {
    id: '2',
    species: 'Basil (Ocimum basilicum)',
    germinationNeeds: 'Sow seeds directly after last frost or start indoors. Needs light to germinate. Keep soil at 70°F.',
    optimalConditions: 'Full sun (6-8 hours/day). Rich, moist, but well-drained soil. Likes heat.',
    status: 'Planting',
  },
   {
    id: '3',
    species: 'Carrot (Daucus carota)',
    germinationNeeds: 'Sow seeds directly in loose, sandy soil. Keep moist. Germination takes 14-21 days.',
    optimalConditions: 'Full sun to partial shade. Loose, well-drained soil. pH 6.0-7.0. Cooler temperatures preferred.',
    status: 'Planning',
  },
];

export const sampleLocations: GardenLocation[] = [
  {
    id: 'loc-1',
    name: 'Backyard Garden',
    location: 'New York, USA',
    temperatureUnit: 'F',
    conditions: {
      temperature: '70°F - 85°F',
      sunlight: '6-8 hours of full sun',
      soil: 'Well-drained, pH 6.0-7.0',
    },
  },
  {
    id: 'loc-2',
    name: 'Community Plot',
    location: 'London, UK',
    temperatureUnit: 'C',
    conditions: {
      temperature: '18°C - 26°C',
      sunlight: '8+ hours of full sun',
      soil: 'Clay-heavy, pH 7.2',
    },
  },
  {
    id: 'loc-3',
    name: 'Patio Containers',
    location: 'Sydney, AU',
    temperatureUnit: 'C',
    conditions: {
      temperature: '24°C - 32°C',
      sunlight: '4-6 hours of partial sun',
      soil: 'Potting mix, pH 6.5',
    },
  },
];
