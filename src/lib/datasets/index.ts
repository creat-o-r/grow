
import type { Plant, Planting, GardenLocation, AiDataset } from '../types';

export interface Dataset extends AiDataset {
    name: string;
    description: string;
}

export interface DatasetInfo {
    key: string;
    name: string;
    description: string;
    loader: () => Promise<Dataset>;
}

export const availableDatasets: DatasetInfo[] = [
    {
        key: 'herbs',
        name: 'Herbs',
        description: 'A starter kit for a culinary herb garden.',
        loader: async () => {
            const data = await import('./herbs.json');
            return {
                name: 'Herbs',
                description: 'A starter kit for a culinary herb garden.',
                locations: data.locations,
                plants: data.plants,
                plantings: data.plantings
            };
        },
    },
    {
        key: 'vegetables',
        name: 'Vegetables',
        description: 'A selection of common vegetables for your plot.',
        loader: async () => {
            const data = await import('./vegetables.json');
             return {
                name: 'Vegetables',
                description: 'A selection of common vegetables for your plot.',
                locations: data.locations,
                plants: data.plants,
                plantings: data.plantings
            };
        },
    },
    {
        key: 'fruit',
        name: 'Fruit',
        description: 'A variety of fruit-bearing plants and trees.',
        loader: async () => {
            const data = await import('./fruit.json');
             return {
                name: 'Fruit',
                description: 'A variety of fruit-bearing plants and trees.',
                locations: data.locations,
                plants: data.plants,
                plantings: data.plantings
            };
        },
    },
    {
        key: 'fungi',
        name: 'Fungi',
        description: 'A collection of popular edible mushrooms.',
        loader: async () => {
            const data = await import('./fungi.json');
             return {
                name: 'Fungi',
                description: 'A collection of popular edible mushrooms.',
                locations: data.locations,
                plants: data.plants,
                plantings: data.plantings
            };
        },
    },
    {
        key: 'medicinal',
        name: 'Medicinal',
        description: 'Plants known for their medicinal properties.',
        loader: async () => {
            const data = await import('./medicinal.json');
             return {
                name: 'Medicinal',
                description: 'Plants known for their medicinal properties.',
                locations: data.locations,
                plants: data.plants,
                plantings: data.plantings
            };
        },
    }
];

export async function loadDataset(key: string): Promise<Dataset> {
    const datasetInfo = availableDatasets.find(d => d.key === key);
    if (!datasetInfo) {
        throw new Error(`Dataset with key "${key}" not found.`);
    }
    const data = await datasetInfo.loader();
    return data;
}
