
'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, KeyRound } from 'lucide-react';

type SettingsSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaveApiKey: (key: string) => void;
  currentApiKey: string;
  onImport: () => void;
  onPublish: () => void;
};

export function SettingsSheet({
  isOpen,
  onOpenChange,
  onSaveApiKey,
  currentApiKey,
  onImport,
  onPublish,
}: SettingsSheetProps) {
  const [apiKey, setApiKey] = useState(currentApiKey);

  useEffect(() => {
    setApiKey(currentApiKey);
  }, [currentApiKey]);

  const handleSaveClick = () => {
    onSaveApiKey(apiKey);
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
                  <CardTitle className="font-headline text-lg">Perplexity AI Integration</CardTitle>
                  <CardDescription>Generate a Perplexity API key to use their models.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={() => window.open('https://www.perplexity.ai/pplx-api', '_blank')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    Get Your Perplexity API Key
                  </Button>
                  <div className="space-y-2">
                    <Label htmlFor="perplexity-key">Perplexity API Key</Label>
                    <Input 
                      id="perplexity-key" 
                      placeholder="Paste your API key here"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                   <Button onClick={handleSaveClick} className="w-full">Save Key</Button>
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


    