
'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, KeyRound } from 'lucide-react';

type ApiKeyName = 'perplexity' | 'openai' | 'groq';

type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaveApiKey: (keyName: ApiKeyName, key: string) => void;
  apiKeys: Record<ApiKeyName, string>;
  onImport: () => void;
  onPublish: () => void;
};

export function SettingsSheet({
  isOpen,
  onOpenChange,
  onSaveApiKey,
  apiKeys,
  onImport,
  onPublish,
}: SettingsSheetProps) {
  const [perplexityKey, setPerplexityKey] = useState(apiKeys.perplexity);
  const [openAIKey, setOpenAIKey] = useState(apiKeys.openai);

  useEffect(() => {
    setPerplexityKey(apiKeys.perplexity);
    setOpenAIKey(apiKeys.openai);
  }, [apiKeys]);

  const handleSaveClick = (keyName: ApiKeyName, key: string) => {
    onSaveApiKey(keyName, key);
  };

  return (
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
                <CardTitle className="font-headline text-lg">API Keys</CardTitle>
                <CardDescription>Manage API keys for third-party AI model providers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-lg">Data Management</CardTitle>
                <CardDescription>Import or publish your entire plant dataset.</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button onClick={onImport} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Import Sample Data
                </Button>
                <Button onClick={onPublish} variant="outline" className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  Publish Data
                </Button>
              </CardContent>
            </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
