'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Plant } from '@/lib/types';

import { aiSearchPlantData } from '@/ai/flows/ai-search-plant-data';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  species: z.string().min(3, 'Species name is required.'),
  germinationNeeds: z.string().min(10, 'Germination needs are required.'),
  optimalConditions: z.string().min(10, 'Optimal conditions are required.'),
  status: z.enum(['Planning', 'Planting', 'Growing']),
});

type PlantFormValues = z.infer<typeof formSchema>;

type PlantFormProps = {
  plantToEdit?: Plant | null;
  onSubmit: (data: PlantFormValues | Plant) => void;
};

export function PlantForm({ plantToEdit, onSubmit }: PlantFormProps) {
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchTerm, setAiSearchTerm] = useState('');
  const { toast } = useToast();

  const form = useForm<PlantFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      species: '',
      germinationNeeds: '',
      optimalConditions: '',
      status: 'Planning',
    },
  });

  useEffect(() => {
    if (plantToEdit) {
      form.reset(plantToEdit);
    } else {
      form.reset({
        species: '',
        germinationNeeds: '',
        optimalConditions: '',
        status: 'Planning',
      });
    }
  }, [plantToEdit, form]);

  const handleAiSearch = async () => {
    if (!aiSearchTerm) return;
    setIsAiSearching(true);
    try {
      const result = await aiSearchPlantData({ searchTerm: aiSearchTerm });
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
        description: 'Could not retrieve plant data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleSubmit = (data: PlantFormValues) => {
    if (plantToEdit) {
      onSubmit({ ...plantToEdit, ...data });
    } else {
      onSubmit(data);
    }
    form.reset();
  };

  return (
    <div className="space-y-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-lg">AI-Powered Search</CardTitle>
          <CardDescription>Enter a plant name to automatically fill the form.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="e.g., 'Sunflower'"
              value={aiSearchTerm}
              onChange={(e) => setAiSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
            />
            <Button onClick={handleAiSearch} disabled={isAiSearching}>
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
            name="status"
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
                  </SelectContent>
                </Select>
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
          <Button type="submit" className="w-full">
            {plantToEdit ? 'Save Changes' : 'Add Plant'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
