
'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, KeyRound, Download } from 'lucide-react';
import { availableDatasets } from '@/lib/datasets';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { ApiKeyName } from '@/lib/types';

type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaveApiKey: (keyName: ApiKeyName, key: string) => void;
  onImport: (datasetKey: string) => void;
  onPublish: () => void;
};

export function SettingsSheet({
  isOpen,
  onOpenChange,
  onSaveApiKey,
  onImport,
  onPublish,
}: SettingsSheetProps) {
  const { apiKeys, availableModels, selectedModel, setSelectedModel } = useStore();

  const [perplexityKey, setPerplexityKey] = useState(apiKeys.perplexity);
  const [openAIKey, setOpenAIKey] = useState(apiKeys.openai);
  const [geminiKey, setGeminiKey] = useState(apiKeys.gemini);
  const [openRouterKey, setOpenRouterKey] = useState(apiKeys.openrouter);
  const [datasetToImport, setDatasetToImport] = useState<string | null>(null);

  useEffect(() => {
    setPerplexityKey(apiKeys.perplexity);
    setOpenAIKey(apiKeys.openai);
    setGeminiKey(apiKeys.gemini);
    setOpenRouterKey(apiKeys.openrouter);
  }, [apiKeys]);

  const handleSaveClick = (keyName: ApiKeyName, key: string) => {
    onSaveApiKey(keyName, key);
  };

  const handleImportClick = (datasetKey: string) => {
    setDatasetToImport(datasetKey);
  }
  
  const handleConfirmImport = () => {
    if (datasetToImport) {
        onImport(datasetToImport);
        setDatasetToImport(null);
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">Settings</SheetTitle>
            <SheetDescription>
              Manage application settings, API keys, and data.
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">AI Model Settings</CardTitle>
                  <CardDescription>Manage API keys and select your preferred model for AI tasks.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {availableModels.length > 0 && (
                    <div className="space-y-2">
                      <Label>Preferred AI Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Gemini */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-semibold">Google Gemini</h4>
                    <Button 
                      onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')} 
                      variant="outline" 
                      className="w-full"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Get Gemini API Key
                    </Button>
                    <div className="space-y-2">
                      <Label htmlFor="gemini-key">API Key</Label>
                      <Input 
                        id="gemini-key" 
                        placeholder="Paste your key here"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => handleSaveClick('gemini', geminiKey)} className="w-full">Save Key</Button>
                  </div>

                  {/* OpenAI */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-semibold">OpenAI</h4>
                    <Button 
                      onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')} 
                      variant="outline" 
                      className="w-full"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Get OpenAI API Key
                    </Button>
                    <div className="space-y-2">
                      <Label htmlFor="openai-key">API Key</Label>
                      <Input 
                        id="openai-key" 
                        placeholder="Paste your key here"
                        value={openAIKey}
                        onChange={(e) => setOpenAIKey(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => handleSaveClick('openai', openAIKey)} className="w-full">Save Key</Button>
                  </div>
                  
                  {/* Perplexity */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-semibold">Perplexity AI</h4>
                    <Button 
                      onClick={() => window.open('https://www.perplexity.ai/pplx-api', '_blank')} 
                      variant="outline" 
                      className="w-full"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Get Perplexity API Key
                    </Button>
                    <div className="space-y-2">
                      <Label htmlFor="perplexity-key">API Key</Label>
                      <Input 
                        id="perplexity-key" 
                        placeholder="Paste your key here"
                        value={perplexityKey}
                        onChange={(e) => setPerplexityKey(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => handleSaveClick('perplexity', perplexityKey)} className="w-full">Save Key</Button>
                  </div>
                  {/* OpenRouter */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-semibold">OpenRouter</h4>
                    <Button
                      onClick={() => window.open('https://openrouter.ai/keys', '_blank')}
                      variant="outline"
                      className="w-full"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Get OpenRouter API Key
                    </Button>
                    <div className="space-y-2">
                      <Label htmlFor="openrouter-key">API Key</Label>
                      <Input
                        id="openrouter-key"
                        placeholder="Paste your key here"
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => handleSaveClick('openrouter', openRouterKey)} className="w-full">Save Key</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-lg">Data Management</CardTitle>
                  <CardDescription>Import a sample dataset or publish your current data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {availableDatasets.map((dataset) => (
                        <Card key={dataset.key} className="p-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-semibold">{dataset.name}</h4>
                                    <p className="text-sm text-muted-foreground">{dataset.description}</p>
                                </div>
                                <Button onClick={() => handleImportClick(dataset.key)} variant="secondary">
                                    <Download className="mr-2 h-4 w-4" />
                                    Import
                                </Button>
                            </div>
                        </Card>
                    ))}
                    <div className="border-t pt-4">
                      <Button onClick={onPublish} variant="outline" className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        Publish All Data to Clipboard
                      </Button>
                    </div>
                </CardContent>
              </Card>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!datasetToImport} onOpenChange={(open) => !open && setDatasetToImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Importing a new dataset will overwrite all your existing gardens and plants. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDatasetToImport(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
