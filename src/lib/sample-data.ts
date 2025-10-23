
import type { Plant, GardenLocation } from './types';

export const samplePlants: Plant[] = [
  {
    id: '1',
    species: 'Tomato (Solanum lycopersicum)',
    germinationNeeds: 'Start seeds indoors 6-8 weeks before last frost. Keep soil moist and warm (75-85°F).',
    optimalConditions: 'Full sun (6-8 hours/day). Well-drained, fertile soil with pH 6.0-6.8. Consistent watering.',
    history: [
      { id: 'h1', status: 'Planning', date: new Date(new Date().setDate(new Date().getDate()-20)).toISOString() },
      { id: 'h2', status: 'Planting', date: new Date(new Date().setDate(new Date().getDate()-10)).toISOString(), notes: "Used indoor seed starter kit." },
      { id: 'h3', status: 'Growing', date: new Date().toISOString(), notes: "First sprouts appeared." },
    ]
  },
  {
    id: '2',
    species: 'Basil (Ocimum basilicum)',
    germinationNeeds: 'Sow seeds directly after last frost or start indoors. Needs light to germinate. Keep soil at 70°F.',
    optimalConditions: 'Full sun (6-8 hours/day). Rich, moist, but well-drained soil. Likes heat.',
    history: [
      { id: 'h4', status: 'Planning', date: new Date(new Date().setDate(new Date().getDate()-5)).toISOString() },
      { id: 'h5', status: 'Planting', date: new Date().toISOString(), notes: "Planted in patio container." },
    ]
  },
   {
    id: '3',
    species: 'Carrot (Daucus carota)',
    germinationNeeds: 'Sow seeds directly in loose, sandy soil. Keep moist. Germination takes 14-21 days.',
    optimalConditions: 'Full sun to partial shade. Loose, well-drained soil. pH 6.0-7.0. Cooler temperatures preferred.',
    history: [
      { id: 'h6', status: 'Planning', date: new Date().toISOString(), notes: "Preparing soil bed next week." }
    ]
  },
];

export const sampleLocations: GardenLocation[] = [];

    