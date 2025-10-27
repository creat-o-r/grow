

'use client';

import { useState, useEffect, useCallback, MouseEvent, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Plant, Planting, PlantingWithPlant, GardenLocation, Conditions, StatusHistory, AiLog, AiDataset } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { getEnvironmentalData } from '@/ai/flows/get-environmental-data';
import { loadDataset } from '@/lib/datasets';
import { analyzeViability, Viability, getSuitableSeasons } from '@/lib/viability';

import { LocationSwitcher } from '@/components/LocationSwitcher';
import { PlantCard } from '@/components/PlantCard';
import { PlantForm } from '@/components/PlantForm';
import { AiLogPanel } from '@/components/AiLogPanel';
import { SettingsSheet } from '@/components/SettingsSheet';
import { AiDataImportSheet } from '@/components/AiDataImportSheet';
import { DuplicateReviewSheet } from '@/components/DuplicateReviewSheet';
import { PlantingDashboard } from '@/components/PlantingDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PlusCircle, Upload, Locate, Loader2, X, Sparkles, NotebookText, Plus, Settings, Info, Rocket } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type PlantStatus = StatusHistory['status'];
type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

const REPO_URL = 'https://github.com/creat-o-r/grow';


export default function Home() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [plantingToEdit, setPlantingToEdit] = useState<PlantingWithPlant | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PlantStatus | 'All'>('All');
  const [isLocating, setIsLocating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<NominatimResult[]>([]);
  const debouncedSearchQuery = useDebounce(locationSearchQuery, 300);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(true);

  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<GardenLocation | null>(null);
  const [plantingToDelete, setPlantingToDelete] = useState<PlantingWithPlant | null>(null);


  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [isAiImportSheetOpen, setIsAiImportSheetOpen] = useState(false);
  const [isDuplicateReviewSheetOpen, setIsDuplicateReviewSheetOpen] = useState(false);

  const [duplicateSelectionMode, setDuplicateSelectionMode] = useState<PlantingWithPlant | null>(null);


  const { toast } = useToast();

  const plants = useLiveQuery(() => db.plants.toArray(), []);
  const plantings = useLiveQuery(() => db.plantings.toArray(), []);
  const locations = useLiveQuery(() => db.locations.toArray(), []);
  const aiLogs = useLiveQuery(() => db.aiLogs.orderBy('timestamp').reverse().limit(10).toArray(), []);
  
  const [apiKeys, setApiKeys] = useState({ gemini: '' });
  const [areApiKeysSet, setAreApiKeysSet] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    const initDb = async () => {
        const locationCount = await db.locations.count();
        if (locationCount > 0) {
             const savedActiveLocation = localStorage.getItem('grow_activeLocation');
             if (savedActiveLocation) {
                const doesLocationExist = await db.locations.get(savedActiveLocation);
                if (doesLocationExist) {
                    setActiveLocationId(savedActiveLocation);
                    return;
                }
             }
            const firstLocation = await db.locations.toCollection().first();
            if (firstLocation) {
                setActiveLocationId(firstLocation.id);
            }
        }
    }
    initDb();

    const storedKeys = localStorage.getItem('grow_apiKeys');
    if (storedKeys) {
      const parsedKeys = JSON.parse(storedKeys);
      setApiKeys(parsedKeys);
      if (parsedKeys.gemini) {
        setAreApiKeysSet(true);
      }
    }

  }, []);

  useEffect(() => {
    if (activeLocationId) {
        localStorage.setItem('grow_activeLocation', activeLocationId);
    } else {
        localStorage.removeItem('grow_activeLocation');
    }
  }, [activeLocationId]);
  
  const handleApiKeysChange = (newKeys: {gemini: string}) => {
    localStorage.setItem('grow_apiKeys', JSON.stringify(newKeys));
    setApiKeys(newKeys);
    if (newKeys.gemini) {
      setAreApiKeysSet(true);
      toast({
        title: 'API Key Saved',
        description: 'Your Gemini API key has been saved.',
      });
    } else {
      setAreApiKeysSet(false);
    }
  };

  const activeLocation = locations?.find(loc => loc.id === activeLocationId);
  const vercelDeployUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(REPO_URL)}`;

  // Effect for location search
  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery !== activeLocation?.location && showLocationSuggestions) {
      setIsSearchingLocation(true);
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${debouncedSearchQuery}`)
        .then(response => response.json())
        .then(data => {
          setLocationSuggestions(data);
          setIsSearchingLocation(false);
        })
        .catch(error => {
          console.error("Error fetching location suggestions:", error);
          setIsSearchingLocation(false);
          setLocationSuggestions([]);
        });
    } else if (!debouncedSearchQuery) {
        setLocationSuggestions([]);
    }
  }, [debouncedSearchQuery, activeLocation?.location, showLocationSuggestions]);


  useEffect(() => {
    if (activeLocation) {
      setLocationSearchQuery(activeLocation.location);
    } else if (locations && locations.length > 0) {
      setActiveLocationId(locations[0].id);
    }
  }, [activeLocation, locations]);

  const handleAddPlanting = async (plantingData: Omit<Planting, 'id'>, plantData: Omit<Plant, 'id'>) => {
    let plantId = (await db.plants.where('species').equalsIgnoreCase(plantData.species).first())?.id;

    if (!plantId) {
        const newPlant: Plant = { ...plantData, id: `plant-${Date.now()}` };
        plantId = await db.plants.add(newPlant);
    }

    const newPlanting: Planting = {
        ...plantingData,
        id: `planting-${Date.now()}`,
        plantId: plantId.toString(),
        gardenId: activeLocationId || '',
    };
    await db.plantings.add(newPlanting);

    setIsSheetOpen(false);
    toast({
      title: 'Planting Added',
      description: `${plantingData.name} has been added to your collection.`,
    });
};

const handleUpdatePlanting = async (updatedPlanting: Planting, updatedPlant: Plant) => {
    await db.plantings.put(updatedPlanting);
    await db.plants.put(updatedPlant);

    setPlantingToEdit(null);
    setIsSheetOpen(false);
    toast({
        title: 'Planting Updated',
        description: `${updatedPlanting.name} has been updated.`,
    });
};

  const handleDeletePlanting = async () => {
    if (!plantingToDelete) return;
    await db.plantings.delete(plantingToDelete.id);
    toast({
      title: 'Planting Removed',
      description: `${plantingToDelete.name} has been removed.`,
      variant: 'destructive',
    });
    setPlantingToDelete(null);
    setIsDeleteAlertOpen(false);
  };
  
  const handleEditPlanting = (planting: PlantingWithPlant) => {
    setPlantingToEdit(planting);
    setIsSheetOpen(true);
  };

  const handleOpenAddSheet = () => {
    setPlantingToEdit(null);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setPlantingToEdit(null);
    }
  };

  const importData = async (data: AiDataset, name: string) => {
    await db.transaction('rw', db.plants, db.plantings, db.locations, async () => {
      await db.plants.clear();
      await db.plantings.clear();
      await db.locations.clear();
      if (data.plants) await db.plants.bulkAdd(data.plants);
      if (data.plantings) await db.plantings.bulkAdd(data.plantings);
      if (data.locations) await db.locations.bulkAdd(data.locations);
    });

    const firstLocation = data.locations?.[0];
    if (firstLocation) {
      setActiveLocationId(firstLocation.id);
    } else {
      setActiveLocationId(null);
    }
    toast({
        title: 'Data Imported',
        description: `The "${name}" dataset has been loaded.`,
    });
    setIsSettingsSheetOpen(false);
  }

  const handleImport = async (datasetKey: string) => {
    try {
        const dataset = await loadDataset(datasetKey);
        await importData(dataset, dataset.name);
    } catch (error) {
        console.error('Failed to import dataset:', error);
        toast({
            title: 'Import Failed',
            description: 'There was an error loading the dataset.',
            variant: 'destructive',
        });
    }
  };

  const handlePublish = async () => {
    const plantsData = await db.plants.toArray();
    const plantingsData = await db.plantings.toArray();
    const locationsData = await db.locations.toArray();
    const dataToPublish = {
      plants: plantsData,
      plantings: plantingsData,
      locations: locationsData,
      activeLocationId,
    };
    navigator.clipboard.writeText(JSON.stringify(dataToPublish, null, 2));
    toast({
      title: 'Data Published',
      description: 'Your entire dataset has been copied to the clipboard.',
    });
  };

  const handleConditionChange = async (field: keyof Conditions, value: string) => {
    if (!activeLocationId) return;
    await db.locations.update(activeLocationId, { conditions: { ...activeLocation?.conditions, [field]: value } });
  };
  
  const handleLocationFieldChange = useCallback(async (field: keyof Omit<GardenLocation, 'id' | 'conditions'>, value: string) => {
    if (!activeLocationId) return;
    await db.locations.update(activeLocationId, { [field]: value });
    // After changing the location, automatically re-analyze conditions
    if (field === 'location' && value.trim()) {
      handleAnalyzeConditions(value.trim());
    }
  }, [activeLocationId]);

  
  const handleAddLocation = async (name: string) => {
    const newLocation: GardenLocation = {
      id: Date.now().toString(),
      name,
      location: '',
      temperatureUnit: 'F',
      conditions: {
        temperature: '',
        sunlight: '',
        soil: '',
      }
    };
    const newId = await db.locations.add(newLocation);
    setActiveLocationId(newId.toString());
    setAccordionValue('item-1');
    setTimeout(() => {
      const locationInput = document.getElementById('location');
      if (locationInput) {
        locationInput.focus();
      }
    }, 100);
  };
  
  const promptDelete = (item: GardenLocation | PlantingWithPlant) => {
    if ('conditions' in item) { // It's a GardenLocation
        setLocationToDelete(item);
    } else { // It's a PlantingWithPlant
        setPlantingToDelete(item);
    }
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteLocation = async () => {
    if (!locationToDelete || !locations) return;

    const locationIdToDelete = locationToDelete.id;
    const locationName = locationToDelete.name;

    await db.locations.delete(locationIdToDelete);

    if (activeLocationId === locationIdToDelete) {
      const remainingLocations = locations.filter(loc => loc.id !== locationIdToDelete);
      if (remainingLocations.length > 0) {
        setActiveLocationId(remainingLocations[0].id);
      } else {
        setActiveLocationId(null);
      }
    }

    toast({
      title: 'Garden Deleted',
      description: `${locationName} has been deleted.`,
      variant: 'destructive',
    });

    setLocationToDelete(null);
    setIsDeleteAlertOpen(false);
  };


  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Using a free, open-source reverse geocoding API
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const locationName = data.display_name || 'Unknown Location';
          handleLocationFieldChange('location', locationName);
          setLocationSearchQuery(locationName); // Update search query as well
          toast({
            title: 'Location Found',
            description: `Set to ${locationName}`,
          });
        } catch (error) {
          console.error("Error fetching location name:", error);
          handleLocationFieldChange('location', 'Current Location');
          toast({
            title: 'Could Not Get Location Name',
            description: 'Location set to your current position.',
            variant: 'destructive',
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        toast({
          title: 'Geolocation Error',
          description: error.message,
          variant: 'destructive',
        });
        setIsLocating(false);
      }
    );
  };

  const handleLocationSuggestionSelect = (locationName: string) => {
    handleLocationFieldChange('location', locationName);
    setLocationSearchQuery(locationName);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
    // Briefly set focus away and back to prevent immediate re-opening of suggestions
    setTimeout(() => {
        const activeEl = document.activeElement as HTMLElement;
        if(activeEl) activeEl.blur();
    }, 0);
  };

  const handleClearLocationSearch = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setLocationSearchQuery('');
    setShowLocationSuggestions(true);
    document.getElementById('location')?.focus();
  }

  const handleAnalyzeConditions = async (locationOverride?: string) => {
    if (!areApiKeysSet) {
      toast({
        title: 'API Key Required',
        description: 'Please set your Gemini API key in the settings.',
        variant: 'destructive',
      });
      setIsSettingsSheetOpen(true);
      return;
    }

    const locationToAnalyze = locationOverride || activeLocation?.location;

    if (!locationToAnalyze || !locationToAnalyze.trim()) {
      toast({
        title: 'Location Required',
        description: 'Please enter a specific location before analyzing conditions.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const promptData = { location: locationToAnalyze, currentMonth };

    try {
      const result = await getEnvironmentalData({ ...promptData, apiKeys });
      
      if (activeLocationId) {
        await db.locations.update(activeLocationId, {
          conditions: {
              temperature: result.soilTemperature,
              sunlight: result.sunlightHours,
              soil: result.soilDescription,
              currentSeason: result.currentSeason,
          }
        });
      }
      
      const newLog: AiLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        flow: 'getEnvironmentalData',
        prompt: promptData,
        results: result,
      };
      
      await db.aiLogs.add(newLog);

      toast({
        title: 'AI Analysis Complete',
        description: `Conditions for ${locationToAnalyze} have been populated.`,
      });
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      toast({
        title: 'AI Analysis Failed',
        description: error.message || 'Could not retrieve environmental data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleMarkAsDuplicate = (planting: PlantingWithPlant) => {
    setDuplicateSelectionMode(planting);
  };

  const handleDuplicateSelection = async (plantingToModify: PlantingWithPlant) => {
    if (!duplicateSelectionMode) return;

    try {
      // Re-assign the planting to the same plantId as the source
      await db.plantings.update(plantingToModify.id, { plantId: duplicateSelectionMode.plantId });
      toast({
        title: 'Duplicate Marked',
        description: `"${plantingToModify.name}" is now marked as a duplicate of "${duplicateSelectionMode.name}".`,
      });
      setDuplicateSelectionMode(null);
      setIsDuplicateReviewSheetOpen(true);
    } catch (error) {
      console.error('Failed to mark as duplicate:', error);
      toast({
        title: 'Error',
        description: 'Could not mark planting as duplicate. See console for details.',
        variant: 'destructive',
      });
      setDuplicateSelectionMode(null);
    }
  };

  const plantingsWithPlants = useMemo((): PlantingWithPlant[] => {
    if (!plantings || !plants) return [];
    const plantMap = new Map(plants.map(p => [p.id, p]));
    return plantings
      .map(p => ({ ...p, plant: plantMap.get(p.plantId)! }))
      .filter(p => p.plant); // Filter out plantings with no matching plant
  }, [plantings, plants]);


  const sortedAndFilteredPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];

    const getStatus = (p: Planting) => p.history && p.history.length > 0 ? p.history[p.history.length - 1].status : null;

    const filtered = statusFilter === 'All'
        ? plantingsWithPlants 
        : plantingsWithPlants.filter(p => getStatus(p) === statusFilter);

    if (activeLocation?.conditions) {
        const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
        
        return filtered.slice().sort((a, b) => {
            const viabilityA = analyzeViability(a.plant, activeLocation.conditions);
            const viabilityB = analyzeViability(b.plant, activeLocation.conditions);
            return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
        });
    }
    
    return filtered;
  }, [plantingsWithPlants, statusFilter, activeLocation?.conditions]);
  
  const seasonallySortedWishlist = useMemo(() => {
    if (!plantingsWithPlants || !activeLocation?.conditions) return null;

    const getBestPlantSeason = (plant: Plant): string => {
        const seasons = getSuitableSeasons(plant);
        if (seasons.length === 0) return 'Any';

        const seasonOrder = ['Spring', 'Summer', 'Autumn', 'Winter'];
        const currentSeason = activeLocation.conditions.currentSeason;
        const currentSeasonIndex = currentSeason ? seasonOrder.indexOf(currentSeason) : -1;

        if (currentSeasonIndex === -1) return seasons[0]; // Default if current season isn't set

        // Find the next best season, starting from the current one
        for (let i = 0; i < seasonOrder.length; i++) {
            const seasonIndex = (currentSeasonIndex + i) % seasonOrder.length;
            const season = seasonOrder[seasonIndex];
            if (seasons.includes(season)) {
                return season;
            }
        }
        return 'Any'; // Fallback
    };

    const viabilityOrder: Record<Viability, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
    const seasonOrder = ['Spring', 'Summer', 'Autumn', 'Winter'];
    const currentSeason = activeLocation.conditions.currentSeason;
    const currentSeasonIndex = currentSeason ? seasonOrder.indexOf(currentSeason) : 0;

    const getSeasonScore = (season: string) => {
        if (season === 'Any') return 4;
        const seasonIndex = seasonOrder.indexOf(season);
        return (seasonIndex - currentSeasonIndex + 4) % 4;
    };
    
    const wishlistPlantings = plantingsWithPlants.filter(p => p.history?.slice(-1)[0]?.status === 'Wishlist');

    wishlistPlantings.sort((a, b) => {
        const seasonA = getBestPlantSeason(a.plant);
        const seasonB = getBestPlantSeason(b.plant);
        const seasonScoreA = getSeasonScore(seasonA);
        const seasonScoreB = getSeasonScore(seasonB);

        if (seasonScoreA !== seasonScoreB) {
            return seasonScoreA - seasonScoreB;
        }

        const viabilityA = analyzeViability(a.plant, activeLocation.conditions!);
        const viabilityB = analyzeViability(b.plant, activeLocation.conditions!);
        return viabilityOrder[viabilityA] - viabilityOrder[viabilityB];
    });
    
    const groupedBySeason: { [season: string]: PlantingWithPlant[] } = {};
    wishlistPlantings.forEach(p => {
        const bestSeason = getBestPlantSeason(p.plant);
        
        if (!groupedBySeason[bestSeason]) {
            groupedBySeason[bestSeason] = [];
        }
        groupedBySeason[bestSeason].push(p);
    });

    const orderedGroupNames = Object.keys(groupedBySeason).sort((a, b) => {
        return getSeasonScore(a) - getSeasonScore(b);
    });

    return orderedGroupNames.map(seasonName => ({
        season: seasonName,
        plantings: groupedBySeason[seasonName]
    }));

  }, [plantingsWithPlants, activeLocation?.conditions]);

  const plantingsInPlantingStatus = useMemo(() => {
      if (!plantingsWithPlants) return [];
      return plantingsWithPlants.filter(p => p.history && p.history.length > 0 && p.history[p.history.length-1].status === 'Planting');
  }, [plantingsWithPlants]);
  
  const plantingDashboardPlantings = useMemo(() => {
    if (!plantingsWithPlants) return [];
    return plantingsWithPlants.filter(p => p.history && p.history.length > 0 && ['Wishlist', 'Harvest'].includes(p.history[p.history.length-1].status));
  }, [plantingsWithPlants]);


  const statusCounts = useMemo(() => {
    const counts: { [key in PlantStatus | 'All']: number } = {
        All: 0, Wishlist: 0, Planting: 0, Growing: 0, Harvest: 0
    };
    if (!plantings) return counts;
    counts.All = plantings.length;
    plantings.forEach(p => {
        if (p.history && p.history.length > 0) {
            const lastStatus = p.history[p.history.length - 1].status;
            counts[lastStatus]++;
        }
    });
    return counts;
  }, [plantings]);

  const allFilters: (PlantStatus | 'All')[] = ['All', 'Wishlist', 'Planting', 'Growing', 'Harvest'];


  if (!isClient || !plantings || !plants || !locations || !aiLogs) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex-1">
        <div className="container mx-auto p-4 md:p-8">
            {duplicateSelectionMode && (
                 <Card className="mb-6 bg-blue-900/20 border-blue-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Info className="h-5 w-5 text-blue-400" />
                            <p className="text-sm font-medium">
                                Select a planting to mark as a duplicate of <span className="font-bold text-white">{duplicateSelectionMode.name}</span>.
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setDuplicateSelectionMode(null)}>
                            <X className="h-5 w-5" />
                        </Button>
                    </CardContent>
                </Card>
            )}
          <div>
            {!activeLocation ? (
              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                <CardHeader>
                  <CardTitle className="font-headline">Welcome to grow</CardTitle>
                  <CardDescription>
                    Create a garden to find more plants you can grow.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => handleAddLocation('My First Garden')}>
                    <Plus className="mr-2 h-4 w-4" /> Add Your First Garden
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Accordion type="single" collapsible className="w-full mb-6 bg-muted/50 rounded-lg" value={accordionValue} onValueChange={setAccordionValue}>
                  <AccordionItem value="item-1" className="border-0">
                      <div className="flex items-center justify-between w-full px-4 py-3">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                               <div onClick={(e) => e.stopPropagation()}>
                                  <LocationSwitcher 
                                    locations={locations}
                                    activeLocationId={activeLocationId}
                                    onLocationChange={setActiveLocationId}
                                    onAddLocation={handleAddLocation}
                                    onDeleteLocation={(loc) => promptDelete(loc)}
                                  />
                              </div>
                              <AccordionTrigger className="p-0 flex-1 hover:no-underline justify-start gap-2 min-w-0">
                                  <span className='text-sm text-muted-foreground font-normal truncate'>
                                      {activeLocation.conditions.temperature || 'Temp'}, {activeLocation.conditions.sunlight || 'Sunlight'}, {activeLocation.conditions.soil || 'Soil'}
                                  </span>
                              </AccordionTrigger>
                          </div>
                          
                          <div className="flex items-center gap-2 pl-4">
                             <Button onClick={handleOpenAddSheet}>
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add Planting
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => setIsSettingsSheetOpen(true)} className="h-10 w-10">
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                              </Button>
                          </div>
                      </div>

                      <AccordionContent className="p-6 pt-2">
                           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
                              <div className="sm:col-span-2 lg:col-span-1 relative">
                                  <Label htmlFor="location" className="text-xs font-semibold uppercase text-muted-foreground">Location</Label>
                                  <div className="flex items-center gap-2">
                                    <div className="relative w-full">
                                      <Input 
                                        id="location" 
                                        value={locationSearchQuery || ''} 
                                        onChange={(e) => {
                                            setLocationSearchQuery(e.target.value);
                                            setShowLocationSuggestions(true);
                                        }}
                                        onBlur={() => handleLocationFieldChange('location', locationSearchQuery)}
                                        onFocus={() => {
                                            setShowLocationSuggestions(true);
                                        }}
                                        autoComplete="off"
                                      />
                                      {locationSearchQuery && (
                                        <button onClick={handleClearLocationSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                          <X className="h-4 w-4"/>
                                        </button>
                                      )}
                                    </div>
                                  <Button size="icon" variant="outline" onClick={handleGetCurrentLocation} disabled={isLocating}>
                                      {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                                  </Button>
                                  </div>
                                  { showLocationSuggestions && (isSearchingLocation || locationSuggestions.length > 0) && (
                                      <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                                          <CardContent className="p-2">
                                              {isSearchingLocation && <div className="p-2 text-sm text-muted-foreground">Searching...</div>}
                                              {!isSearchingLocation && locationSuggestions.map((suggestion, index) => (
                                                  <button
                                                      key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                                                      className="block w-full text-left p-2 text-sm rounded-md hover:bg-accent"
                                                      onClick={() => handleLocationSuggestionSelect(suggestion.display_name)}
                                                  >
                                                      {suggestion.display_name}
                                                  </button>
                                              ))}
                                          </CardContent>
                                      </Card>
                                  )}
                              </div>
                               <div>
                                  <Label htmlFor="season" className="text-xs font-semibold uppercase text-muted-foreground">Current Season</Label>
                                  <Select value={activeLocation?.conditions.currentSeason || ''} onValueChange={(value) => handleConditionChange('currentSeason', value)}>
                                      <SelectTrigger id="season">
                                          <SelectValue placeholder="Select season" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="Spring">Spring</SelectItem>
                                          <SelectItem value="Summer">Summer</SelectItem>
                                          <SelectItem value="Autumn">Autumn</SelectItem>
                                          <SelectItem value="Winter">Winter</SelectItem>
                                      </SelectContent>
                                  </Select>
                               </div>
                              <div>
                              <Label htmlFor="temperature" className="text-xs font-semibold uppercase text-muted-foreground">Soil Temperature</Label>
                              <Input id="temperature" value={activeLocation?.conditions.temperature || ''} onChange={(e) => handleConditionChange('temperature', e.target.value)} />
                              </div>
                              <div>
                              <Label htmlFor="sunlight" className="text-xs font-semibold uppercase text-muted-foreground">Sunlight</Label>
                              <Input id="sunlight" value={activeLocation?.conditions.sunlight || ''} onChange={(e) => handleConditionChange('sunlight', e.target.value)} />
                              </div>
                              <div className="flex gap-2">
                                  <div className="flex-1">
                                      <Label htmlFor="soil" className="text-xs font-semibold uppercase text-muted-foreground">Soil</Label>
                                      <Input id="soil" value={activeLocation?.conditions.soil || ''} onChange={(e) => handleConditionChange('soil', e.target.value)} />
                                  </div>
                                  <Button size="icon" variant="outline" onClick={() => handleAnalyzeConditions()} disabled={isAnalyzing}>
                                      {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                  </Button>
                              </div>
                          </div>
                      </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                <div className="flex items-center gap-2 mb-6">
                    {allFilters.map(status => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(status)}
                            className="h-8"
                        >
                            {status}
                            <Badge variant="secondary" className={cn(
                                "ml-2 rounded-full px-1.5 py-0.5 text-xs font-mono"
                                )}>
                                {statusCounts[status]}
                            </Badge>
                        </Button>
                    ))}
                </div>
                
                {plantings && plantings.length > 0 ? (
                    <>
                      {statusFilter === 'Wishlist' ? (
                          seasonallySortedWishlist && seasonallySortedWishlist.length > 0 ? (
                              <div className="space-y-8">
                                  {seasonallySortedWishlist.map(group => (
                                      <section key={group.season}>
                                          <h2 className="text-2xl font-headline mb-4">
                                              {group.season === activeLocation.conditions.currentSeason ? `Current Season: ${group.season}` : group.season}
                                          </h2>
                                          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                              {group.plantings.map(p => (
                                                  <PlantCard
                                                      key={p.id}
                                                      planting={p}
                                                      gardenConditions={activeLocation?.conditions}
                                                      onEdit={() => handleEditPlanting(p)}
                                                      onDelete={() => promptDelete(p)}
                                                      onMarkAsDuplicate={() => handleMarkAsDuplicate(p)}
                                                      isDuplicateSource={duplicateSelectionMode?.id === p.id}
                                                      isSelectionMode={!!duplicateSelectionMode}
                                                      onSelectDuplicate={() => handleDuplicateSelection(p)}
                                                  />
                                              ))}
                                          </div>
                                      </section>
                                  ))}
                              </div>
                          ) : (
                              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                                  <CardHeader>
                                      <CardTitle className="font-headline">No Wishlist Items</CardTitle>
                                      <CardDescription>
                                          Add some plants to your wishlist to get started.
                                      </CardDescription>
                                  </CardHeader>
                              </Card>
                          )
                      ) : statusFilter === 'Planting' ? (
                          <div className="space-y-8">
                              {plantingsInPlantingStatus.length > 0 && (
                                <div>
                                    <h2 className="text-2xl font-headline mb-4">Currently Planting</h2>
                                    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {plantingsInPlantingStatus.map(p => (
                                            <PlantCard 
                                                key={p.id} 
                                                planting={p} 
                                                gardenConditions={activeLocation?.conditions}
                                                onEdit={() => handleEditPlanting(p)}
                                                onDelete={() => promptDelete(p)}
                                                onMarkAsDuplicate={() => handleMarkAsDuplicate(p)}
                                                isDuplicateSource={duplicateSelectionMode?.id === p.id}
                                                isSelectionMode={!!duplicateSelectionMode}
                                                onSelectDuplicate={() => handleDuplicateSelection(p)}
                                            />
                                        ))}
                                    </div>
                                </div>
                              )}
                              <PlantingDashboard
                                  plantings={plantingDashboardPlantings}
                                  gardenConditions={activeLocation.conditions}
                                  onOpenAddSheet={handleOpenAddSheet}
                                  onOpenSettings={() => setIsSettingsSheetOpen(true)}
                              />
                          </div>
                      ) : (
                          sortedAndFilteredPlantings.length > 0 ? (
                              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                  {sortedAndFilteredPlantings.map(p => (
                                      <PlantCard 
                                          key={p.id} 
                                          planting={p} 
                                          gardenConditions={activeLocation?.conditions}
                                          onEdit={() => handleEditPlanting(p)}
                                          onDelete={() => promptDelete(p)}
                                          onMarkAsDuplicate={() => handleMarkAsDuplicate(p)}
                                          isDuplicateSource={duplicateSelectionMode?.id === p.id}
                                          isSelectionMode={!!duplicateSelectionMode}
                                          onSelectDuplicate={() => handleDuplicateSelection(p)}
                                      />
                                  ))}
                              </div>
                          ) : (
                              <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                                  <CardHeader>
                                      <CardTitle className="font-headline">No Plantings Found</CardTitle>
                                      <CardDescription>
                                          No plantings with the status "{statusFilter}".
                                      </CardDescription>
                                  </CardHeader>
                              </Card>
                          )
                      )}
                    </>
                ) : (
                  <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
                    <CardHeader>
                      <CardTitle className="font-headline">Your Garden is Empty</CardTitle>
                      <CardDescription>
                        Add a plant or import a sample dataset to get started.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-4">
                       <Button onClick={handleOpenAddSheet}>
                         <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Planting
                      </Button>
                       <Button onClick={() => setIsSettingsSheetOpen(true)} variant="secondary">
                         <Upload className="mr-2 h-4 w-4" /> Import Datasets
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </main>

       <footer className="w-full py-6">
          <div className="container mx-auto text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Rocket className="h-4 w-4" />
            <a href={vercelDeployUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
              Host your own copy of this software for free
            </a>
          </div>
        </footer>

      {(aiLogs.length > 0 || areApiKeysSet) && (
        <div className="fixed bottom-4 right-4 z-20">
          <Button
            size="icon"
            onClick={() => setIsLogPanelOpen(true)}
            aria-label="Open AI Log"
          >
            <NotebookText />
          </Button>
        </div>
      )}
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            {locationToDelete && (
                <AlertDialogDescription>
                    This will permanently delete "{locationToDelete.name}" and all of its associated data. This action cannot be undone.
                </AlertDialogDescription>
            )}
            {plantingToDelete && (
                 <AlertDialogDescription>
                    This will permanently delete the planting "{plantingToDelete.name}". This action cannot be undone.
                </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setIsDeleteAlertOpen(false);
                setLocationToDelete(null);
                setPlantingToDelete(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={locationToDelete ? handleDeleteLocation : handleDeletePlanting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiLogPanel 
        logs={aiLogs}
        isOpen={isLogPanelOpen}
        onOpenChange={setIsLogPanelOpen}
        onOpenSettings={() => setIsSettingsSheetOpen(true)}
        areApiKeysSet={areApiKeysSet}
      />

      <SettingsSheet 
        isOpen={isSettingsSheetOpen}
        onOpenChange={setIsSettingsSheetOpen}
        onImport={handleImport}
        onAiImportOpen={() => {
            setIsSettingsSheetOpen(false);
            setIsAiImportSheetOpen(true);
        }}
        onPublish={handlePublish}
        onApiKeysChange={handleApiKeysChange}
        apiKeys={apiKeys}
        onDuplicateReviewOpen={() => {
            setIsSettingsSheetOpen(false);
            setIsDuplicateReviewSheetOpen(true);
        }}
      />

      <AiDataImportSheet
        isOpen={isAiImportSheetOpen}
        onOpenChange={setIsAiImportSheetOpen}
        apiKeys={apiKeys}
        areApiKeysSet={areApiKeysSet}
        onComplete={() => {
            // This could be more specific to refresh only what's needed
            window.location.reload();
        }}
        activeLocation={activeLocation}
      />

      <DuplicateReviewSheet
        isOpen={isDuplicateReviewSheetOpen}
        onOpenChange={setIsDuplicateReviewSheetOpen}
        plantings={plantingsWithPlants}
      />


      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="sm:max-w-lg w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-headline">{plantingToEdit ? 'Edit Planting' : 'Add a New Planting'}</SheetTitle>
          </SheetHeader>
          <PlantForm 
            plantingToEdit={plantingToEdit} 
            onSubmit={plantingToEdit ? handleUpdatePlanting : handleAddPlanting}
            onConfigureApiKey={() => {
              handleSheetOpenChange(false);
              setIsSettingsSheetOpen(true);
            }}
            areApiKeysSet={areApiKeysSet}
            apiKeys={apiKeys}
            plants={plants}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

    