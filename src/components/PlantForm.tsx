
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
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, Plus, Trash2, CalendarIcon, AlertTriangle, Upload, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const statusHistorySchema = z.object({
  id: z.string(),
  status: z.enum(['Wishlist', 'Planting', 'Growing', 'Harvest']),
  date: z.string(),
  notes: z.string().optional(),
});

const formSchema = z.object({
  species: z.string().min(3, 'Species name is required.'),
  germinationNeeds: z.string().min(10, 'Germination needs are required.'),
  optimalConditions: z.string().min(10, 'Optimal conditions are required.'),
  history: z.array(statusHistorySchema),
  seedsOnHand: z.coerce.number().optional(),
  plannedQty: z.coerce.number().optional(),
});

type PlantFormValues = z.infer<typeof formSchema>;

type PlantFormProps = {
  plantToEdit?: Plant | null;
  onSubmit: (data: PlantFormValues | Plant) => void;
  onConfigureApiKey: () => void;
  areApiKeysSet: boolean;
  apiKeys: { gemini: string };
};

export function PlantForm({ plantToEdit, onSubmit, onConfigureApiKey, areApiKeysSet, apiKeys }: PlantFormProps) {
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
      seedsOnHand: 0,
      plannedQty: 0,
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "history",
  });
  
  const speciesValue = form.watch('species');
  const historyValue = form.watch('history');
  const lastStatus = historyValue?.slice(-1)[0]?.status;


  useEffect(() => {
    if (plantToEdit) {
      form.reset({
        ...plantToEdit,
        seedsOnHand: plantToEdit.seedsOnHand || 0,
        plannedQty: plantToEdit.plannedQty || 0,
      });
    } else {
      form.reset({
        species: '',
        germinationNeeds: '',
        optimalConditions: '',
        history: [{ id: 'new-1', status: 'Wishlist', date: new Date().toISOString(), notes: '' }],
        seedsOnHand: 0,
        plannedQty: 0,
      });
    }
  }, [plantToEdit, form]);

  const handleAiSearch = async () => {
    if (!areApiKeysSet) {
      toast({
        title: 'API Key Required',
        description: 'Please configure your Gemini API key in the settings to use this feature.',
        variant: 'destructive',
      });
      onConfigureApiKey();
      return;
    }
    if (!aiSearchTerm) return;
    setIsAiSearching(true);
    try {
      const result = await aiSearchPlantData({ searchTerm: aiSearchTerm, apiKeys });
      form.setValue('species', result.species, { shouldValidate: true });
      form.setValue('germinationNeeds', result.germinationNeeds, { shouldValidate: true });
      form.setValue('optimalConditions', result.optimalConditions, { shouldValidate: true });
      toast({
        title: 'AI Search Successful',
        description: `Data for ${result.species} has been populated.`,
      });
    } catch (error: any) {
      console.error('AI search failed:', error);
      toast({
        title: 'AI Search Failed',
        description: error.message || 'Could not retrieve plant data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleSubmit = (data: PlantFormValues) => {
     const sortedHistory = [...data.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (plantToEdit) {
      onSubmit({ ...plantToEdit, ...data, history: sortedHistory });
    } else {
      onSubmit({...data, history: sortedHistory});
    }
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
          {!areApiKeysSet && (
             <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>API Key Not Set</AlertTitle>
              <AlertDescription>
                <Button variant="link" className="p-0 h-auto" onClick={onConfigureApiKey}>Configure your Gemini API key</Button> to enable AI search.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex space-x-2">
            <Input
              placeholder="e.g., 'Sunflower'"
              value={aiSearchTerm}
              onChange={(e) => setAiSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
            />
            <Button type="button" onClick={handleAiSearch} disabled={isAiSearching || !areApiKeysSet}>
              {isAiSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="sr-only">Search</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>


      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="species"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Species</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input placeholder="e.g., Solanum lycopersicum" {...field} />
                     {speciesValue && (
                       <a href={`https://www.google.com/search?q=${encodeURIComponent(speciesValue)}`} target="_blank" rel="noopener noreferrer" className="absolute right-2 top-1/2 -translate-y-1/2">
                          <Button variant="ghost" size="icon" type="button" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-4 w-4" />
                          </Button>
                      </a>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           {(lastStatus === 'Planting' || lastStatus === 'Growing' || plantToEdit?.seedsOnHand) && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="seedsOnHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seeds on Hand</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 25" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="plannedQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned Qty</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
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
                                <SelectItem value="Wishlist">Wishlist</SelectItem>
                                <SelectItem value="Planting">Planting</SelectItem>
                                <SelectItem value="Growing">Growing</SelectItem>
                                <SelectItem value="Harvest">Harvest</SelectItem>
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
      
       <div className="relative">
        <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>
      
      <Button type="button" variant="secondary" className="w-full" onClick={onConfigureApiKey}>
          <Upload className="mr-2 h-4 w-4"/> Import a Dataset
      </Button>

    </div>
  );
}
