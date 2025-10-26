
import type { Plant, GardenLocation, AiDataset } from '../types';

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
        loader: async () => (await import('./herbs.json')).default as unknown as Dataset,
    },
    {
        key: 'vegetables',
        name: 'Vegetables',
        description: 'A selection of common vegetables for your plot.',
        loader: async () => (await import('./vegetables.json')).default as unknown as Dataset,
    },
    {
        key: 'fruit',
        name: 'Fruit',
        description: 'A variety of fruit-bearing plants and trees.',
        loader: async () => (await import('./fruit.json')).default as unknown as Dataset,
    },
    {
        key: 'fungi',
        name: 'Fungi',
        description: 'A collection of popular edible mushrooms.',
        loader: async () => (await import('./fungi.json')).default as unknown as Dataset,
    },
    {
        key: 'medicinal',
        name: 'Medicinal',
        description: 'Plants known for their medicinal properties.',
        loader: async () => (await import('./medicinal.json')).default as unknown as Dataset,
    }
];

export async function loadDataset(key: string): Promise<Dataset> {
    const datasetInfo = availableDatasets.find(d => d.key === key);
    if (!datasetInfo) {
        throw new Error(`Dataset with key "${key}" not found.`);
    }
    const data = await datasetInfo.loader();
    return {
        name: datasetInfo.name,
        description: datasetInfo.description,
        ...data
    };
}

    