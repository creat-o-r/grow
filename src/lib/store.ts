
import { create } from 'zustand';
import { ApiKeyName } from '@/lib/types';

type AppState = {
  apiKeys: Record<ApiKeyName, string>;
  setApiKey: (keyName: ApiKeyName, key: string) => void;
  envKeys: Record<ApiKeyName, boolean>;
  setEnvKeys: (envKeys: Record<ApiKeyName, boolean>) => void;
  availableModels: string[];
  setAvailableModels: (models: string[]) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isSettingsSheetOpen: boolean;
  setIsSettingsSheetOpen: (isOpen: boolean) => void;
};

export const useStore = create<AppState>((set) => ({
  apiKeys: {
    gemini: '',
    openai: '',
    perplexity: '',
    openrouter: '',
    groq: '',
  },
  setApiKey: (keyName, key) =>
    set((state) => ({
      apiKeys: {
        ...state.apiKeys,
        [keyName]: key,
      },
    })),
  envKeys: {
    gemini: false,
    openai: false,
    perplexity: false,
    openrouter: false,
    groq: false,
  },
  setEnvKeys: (envKeys) => set({ envKeys }),
  availableModels: [],
  setAvailableModels: (models) => set({ availableModels: models }),
  selectedModel: '',
  setSelectedModel: (model) => set({ selectedModel: model }),
  isSettingsSheetOpen: false,
  setIsSettingsSheetOpen: (isOpen) => set({ isSettingsSheetOpen: isOpen }),
}));
