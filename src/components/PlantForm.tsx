
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Plant, StatusHistory } from '@/lib/types';
import { format, parseISO } from 'date-fns';

import { aiSearchPlantData } from '@/ai/flows/ai-search-plant-data';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, Plus, Trash2, CalendarIcon, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

const statusHistorySchema = z.object({
  id: z.string(),
  status: z.enum(['Planning', 'Planting', 'Growing', 'Harvested', 'Dormant']),
  date: z.string(),
  notes: z.string().optional(),
});

const formSchema = z.object({
  species: z.string().min(3, 'Species name is required.'),
  germinationNeeds: z.string().min(10, 'Germination needs are required.'),
  optimalConditions: z.string().min(10, 'Optimal conditions are required.'),
  history: z.array(statusHistorySchema),
});

export type PlantFormValues = z.infer<typeof formSchema>;

import { ApiKeys } from '@/ai/genkit';

type PlantFormProps = {
  plantToEdit?: Plant | null;
  onSubmit: (data: PlantFormValues) => void;
  isApiKeySet: boolean;
  onConfigureApiKey: () => void;
  apiKeys: ApiKeys;
  availableModels: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
};

export function PlantForm({ plantToEdit, onSubmit, isApiKeySet, onConfigureApiKey, apiKeys, availableModels, selectedModel, onModelChange }: PlantFormProps) {
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchTerm, setAiSearchTerm] = useState('');
  const { toast } = useToast();

  const form = useForm<PlantFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      species: '',
      germinationNeeds: '',
      optimalConditions: '',
      history: [],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "history",
  });

  useEffect(() => {
    if (plantToEdit) {
      form.reset(plantToEdit);
    } else {
      form.reset({
        species: '',
        germinationNeeds: '',
        optimalConditions: '',
        history: [{ id: 'new-1', status: 'Planning', date: new Date().toISOString(), notes: '' }],
      });
    }
  }, [plantToEdit, form]);

  const handleAiSearch = async () => {
    if (!aiSearchTerm) return;
    setIsAiSearching(true);
    try {
      const result = await aiSearchPlantData({ searchTerm: aiSearchTerm, apiKeys, model: selectedModel });
      form.setValue('species', result.species, { shouldValidate: true });
      form.setValue('germinationNeeds', result.germinationNeeds, { shouldValidate: true });
      form.setValue('optimalConditions', result.optimalConditions, { shouldValidate: true });
      toast({
        title: 'AI Search Successful',
        description: `Data for ${result.species} has been populated.`,
      });
    } catch (error) {
      console.error('AI search failed:', error);
      toast({
        title: 'AI Search Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleSubmit = (data: PlantFormValues) => {
    const sortedHistory = [...data.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    onSubmit({ ...data, history: sortedHistory });
    form.reset();
  };

  const addNewStatus = () => {
    append({
        id: `new-${Date.now()}`,
        status: 'Growing',
        date: new Date().toISOString(),
        notes: '',
    });
  };

  return (
    <div className="space-y-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">AI-Powered Search</CardTitle>
          <CardDescription>Enter a plant name to automatically fill the form.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., 'Sunflower'"
                value={aiSearchTerm}
                onChange={(e) => setAiSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
              />
              {!isApiKeySet && (
                <Button type="button" size="icon" variant="outline" onClick={onConfigureApiKey}>
                  <KeyRound className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" onClick={handleAiSearch} disabled={isAiSearching || !isApiKeySet}>
                {isAiSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="sr-only">Search</span>
              </Button>
            </div>
            {isApiKeySet && availableModels.length > 0 && (
              <div className="space-y-2">
                <Label>Select a model</Label>
                <Select value={selectedModel} onValueChange={onModelChange}>
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
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="species"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Species</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Solanum lycopersicum" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="germinationNeeds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Germination Needs</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe germination requirements..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="optimalConditions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Optimal Conditions</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe optimal growing conditions..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4 rounded-lg border p-4">
            <div className='flex justify-between items-center'>
                 <h3 className="font-medium">Plant History</h3>
                 <Button type="button" size="sm" variant="outline" onClick={addNewStatus}>
                    <Plus className="mr-2 h-4 w-4"/> Add Status
                </Button>
            </div>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4 space-y-3">
                   <div className="grid grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name={`history.${index}.status`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select a status" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Planning">Planning</SelectItem>
                                <SelectItem value="Planting">Planting</SelectItem>
                                <SelectItem value="Growing">Growing</SelectItem>
                                <SelectItem value="Harvested">Harvested</SelectItem>
                                <SelectItem value="Dormant">Dormant</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                      control={form.control}
                      name={`history.${index}.date`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value ? (
                                        format(parseISO(field.value), "PPP")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value ? parseISO(field.value) : undefined}
                                    onSelect={(date) => field.onChange(date?.toISOString())}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                   </div>
                   <FormField
                        control={form.control}
                        name={`history.${index}.notes`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                            <Textarea placeholder="Add any notes for this status..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)} className="w-full">
                        <Trash2 className="mr-2 h-4 w-4"/> Remove Status
                    </Button>
                </Card>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full">
            {plantToEdit ? 'Save Changes' : 'Add Plant'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
