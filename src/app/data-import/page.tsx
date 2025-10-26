'use client';

import { useState } from 'react';
import { useChat, type Message } from 'ai/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot, User, Plus, Check, ArrowUp, RefreshCcw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Plant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { useRouter } from 'next/navigation';

function PlantResultCard({ plant, onAdd, isAdded }: { plant: Plant; onAdd: (plant: Plant) => void; isAdded: boolean }) {
  return (
    <Card className="bg-muted/50">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-headline">{plant.species}</CardTitle>
          <Button size="sm" onClick={() => onAdd(plant)} disabled={isAdded}>
            {isAdded ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {isAdded ? 'Added' : 'Add to Dataset'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>
          <h4 className="font-semibold text-muted-foreground">Germination</h4>
          <p className="text-foreground/80">{plant.germinationNeeds}</p>
        </div>
        <div>
          <h4 className="font-semibold text-muted-foreground">Conditions</h4>
          <p className="text-foreground/80">{plant.optimalConditions}</p>
        </div>
      </CardContent>
    </Card>
  );
}


export default function DataImportPage() {
  const [dataset, setDataset] = useState<Plant[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const { messages, input, handleInputChange, handleSubmit, setMessages } = useChat({
    api: '/api/find-plants',
    experimental_onFunctionCall: async (chatMessages, functionCall) => {
        if (functionCall.name !== 'findPlantsTool') {
            return;
        }

        const newMessages: Message[] = [...chatMessages];
        const result = functionCall.arguments as { plants: Plant[] };

        const functionResponse: Message = {
            id: `function-response-${Date.now()}`,
            name: 'findPlantsTool',
            role: 'function',
            content: JSON.stringify(result),
        };
        newMessages.push(functionResponse);
        
        const assistantResponse: Message = {
            id: `assistant-response-${Date.now()}`,
            role: 'assistant',
            content: `I found ${result.plants.length} plant(s) matching your description.`
        };
        newMessages.push(assistantResponse);

        setMessages(newMessages);
    },
  });

  const handleAddToDataset = (plant: Plant) => {
    if (!dataset.find(p => p.species === plant.species)) {
      const plantWithHistory = {
        ...plant,
        id: `${plant.species}-${Date.now()}`,
        history: [{
          id: `hist-${Date.now()}`,
          status: 'Planning' as const,
          date: new Date().toISOString(),
          notes: 'Imported via AI chat.'
        }]
      };
      setDataset(prev => [...prev, plantWithHistory]);
       toast({
        title: "Plant Added",
        description: `${plant.species} has been added to your new dataset.`,
      });
    }
  };

  const handleImportDataset = async () => {
    if (dataset.length === 0) {
        toast({ title: 'Dataset is empty', description: 'Add some plants first.', variant: 'destructive' });
        return;
    }
    try {
      await db.plants.bulkAdd(dataset);
      toast({
        title: 'Dataset Imported!',
        description: `${dataset.length} plants have been added to your collection.`,
      });
      router.push('/');
    } catch (error) {
       toast({
        title: 'Import Failed',
        description: 'There was an error importing the dataset.',
        variant: 'destructive',
      });
      console.error(error);
    }
  }

  const startNewSearch = () => {
    setDataset([]);
    setMessages([]);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-4xl flex flex-col h-[90vh]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-headline">AI Plant Discovery</CardTitle>
              <CardDescription>
                Chat with the AI to find plants and build a new dataset for your garden.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={startNewSearch}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Start New Search
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-6">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-4 ${
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                    {m.role !== 'user' && (
                        <Avatar className="h-8 w-8 bg-secondary">
                            <AvatarFallback>
                                <Bot className="h-5 w-5 text-secondary-foreground" />
                            </AvatarFallback>
                        </Avatar>
                    )}
                  <div
                    className={`max-w-xl rounded-lg px-4 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : m.role === 'assistant' ? 'bg-card border' : 'hidden'
                    }`}
                  >
                    {m.content}
                     {m.role === 'function' && m.name === 'findPlantsTool' && (
                        <div className="mt-4 space-y-4">
                            {(JSON.parse(m.content) as { plants: Plant[] })?.plants.map(plant => (
                                <PlantResultCard 
                                    key={plant.species} 
                                    plant={plant} 
                                    onAdd={handleAddToDataset}
                                    isAdded={!!dataset.find(p => p.species === plant.species)}
                                />
                            ))}
                        </div>
                    )}
                  </div>
                   {m.role === 'user' && (
                        <Avatar className="h-8 w-8 bg-primary">
                            <AvatarFallback>
                                <User className="h-5 w-5 text-primary-foreground" />
                            </AvatarFallback>
                        </Avatar>
                    )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 pt-4 border-t">
          {dataset.length > 0 && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Your New Dataset ({dataset.length} plants)</h3>
              <ScrollArea className="h-24">
                <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-4">
                  {dataset.map(p => <li key={p.id}>{p.species}</li>)}
                </ul>
              </ScrollArea>
              <Button onClick={handleImportDataset} className="w-full mt-4">
                Import Dataset
              </Button>
            </div>
          )}
           <form
            onSubmit={handleSubmit}
            className="flex w-full items-center space-x-2"
          >
            <Input
              id="message"
              placeholder="e.g., 'Find drought-tolerant herbs'"
              className="flex-1"
              autoComplete="off"
              value={input}
              onChange={handleInputChange}
            />
            <Button type="submit" size="icon" disabled={!input}>
              <ArrowUp className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
