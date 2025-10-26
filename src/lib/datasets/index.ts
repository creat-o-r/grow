
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
        key: 'default-us',
        name: 'Default US Starter Kit',
        description: 'A collection of common plants for North American gardens.',
        loader: async () => (await import('./default-us.json')).default as unknown as Dataset,
    },
    {
        key: 'new-zealand',
        name: 'New Zealand Edibles',
        description: 'Native and common edible plants found in New Zealand.',
        loader: async () => (await import('./new-zealand.json')).default as unknown as Dataset,
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
