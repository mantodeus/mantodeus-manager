import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { MapPin, Search, X, Users } from "lucide-react";
import { MapView } from "@/components/Map";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { useLocation } from "wouter";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

type Location = {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  address: string | null;
  type: "job" | "contact" | "custom";
  jobId: number | null;
  contactId: number | null;
  createdBy: number;
  createdAt: Date;
};



export default function Maps() {
  const { user } = useAuth();
  const [location] = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const addressFocusMarkerRef = useRef<google.maps.Marker | null>(null);
  
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const focusJobId = urlParams.get('jobId') ? parseInt(urlParams.get('jobId')!) : null;
  const focusContactId = urlParams.get('contactId') ? parseInt(urlParams.get('contactId')!) : null;
  const focusAddress = urlParams.get('address');
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  type SearchResult = {
    id: string;
    name: string;
    address: string | null;
    type: "job" | "contact" | "location";
    latitude?: string;
    longitude?: string;
    originalId: number;
  };
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [locationType, setLocationType] = useState<"job" | "contact" | "custom">("custom");
  const [selectedJobId, setSelectedJobId] = useState<string>("none");
  const [selectedContactId, setSelectedContactId] = useState<string>("none");

  // Queries
  const { data: locations = [], refetch: refetchLocations } = trpc.locations.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();
  
  // Stabilize arrays for useEffect dependencies
  const locationsIds = useMemo(() => locations.map(l => l.id).join(','), [locations]);
  const projectsIds = useMemo(() => projects.map(p => p.id).join(','), [projects]);
  const contactsIds = useMemo(() => contacts.map(c => c.id).join(','), [contacts]);

  // Mutations
  const geocodeMutation = trpc.locations.geocode.useMutation();
  
  const createLocationMutation = trpc.locations.create.useMutation({
    onSuccess: () => {
      toast.success("Location added successfully");
      refetchLocations();
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to add location: ${error.message}`);
    },
  });

  const updateLocationMutation = trpc.locations.update.useMutation({
    onSuccess: () => {
      toast.success("Location updated successfully");
      refetchLocations();
      resetForm();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to update location: ${error.message}`);
    },
  });

  const deleteLocationMutation = trpc.locations.delete.useMutation({
    onSuccess: () => {
      toast.success("Location deleted successfully");
      refetchLocations();
    },
    onError: (error) => {
      toast.error(`Failed to delete location: ${error.message}`);
    },
  });

  const resetForm = () => {
    setName("");
    setAddress("");
    setLocationType("custom");
    setSelectedJobId("none");
    setSelectedContactId("none");
    setSelectedLocation(null);
    setEditingLocation(null);
  };

  // Search handler
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search projects (projects don't have locations, skip for now)
    // Projects are not location entities in this system

    // Search contacts
    contacts.forEach((contact) => {
      const matchesName = contact.name.toLowerCase().includes(query);
      const matchesAddress = contact.address?.toLowerCase().includes(query);
      if ((matchesName || matchesAddress) && contact.latitude && contact.longitude) {
        results.push({
          id: `contact-${contact.id}`,
          name: contact.name,
          address: contact.address || null,
          type: "contact",
          latitude: contact.latitude,
          longitude: contact.longitude,
          originalId: contact.id,
        });
      }
    });

    // Search custom locations
    locations.forEach((location) => {
      const matchesName = location.name.toLowerCase().includes(query);
      const matchesAddress = location.address?.toLowerCase().includes(query);
      if (matchesName || matchesAddress) {
        results.push({
          id: `location-${location.id}`,
          name: location.name,
          address: location.address,
          type: "location",
          latitude: location.latitude,
          longitude: location.longitude,
          originalId: location.id,
        });
      }
    });

    setSearchResults(results);
    setShowSearchResults(results.length > 0 || searchQuery.trim().length >= 3);
  }, [searchQuery, projectsIds, contactsIds, locationsIds, projects, contacts, locations]);

  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);

    let longPressTimer: NodeJS.Timeout | null = null;
    let longPressLatLng: google.maps.LatLng | null = null;

    // Add long-press listener to place markers (desktop: 500ms click hold, mobile: touch hold)
    map.addListener("mousedown", (e: google.maps.MapMouseEvent) => {
      if (e.latLng && !isMultiSelectMode) {
        longPressLatLng = e.latLng;
        longPressTimer = setTimeout(() => {
          if (longPressLatLng) {
            if (navigator.vibrate) navigator.vibrate(50);
            setSelectedLocation({
              lat: longPressLatLng.lat(),
              lng: longPressLatLng.lng(),
            });
            setIsAddDialogOpen(true);
          }
        }, 500);
      }
    });

    map.addListener("mouseup", () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      longPressLatLng = null;
    });

    map.addListener("mousemove", () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      longPressLatLng = null;
    });

    // Force marker creation immediately after map is ready
    setTimeout(() => {
      if (locations.length > 0) {
        createMarkers();
      }
    }, 100);
  };

  // Extract marker creation logic into separate function
  const createMarkers = () => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    markersRef.current.clear();

    // Add markers for each location
    locations.forEach((location) => {
      const lat = parseFloat(location.latitude);
      const lng = parseFloat(location.longitude);

      if (isNaN(lat) || isNaN(lng)) return;

      // Create marker icon based on location type with circular shadow background
      let iconUrl = '';
      
      if (location.type === 'job') {
        // Professional rope access carabiner icon with neon green
        iconUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Circular shadow background -->
            <circle cx="24" cy="24" r="20" fill="black" opacity="0.15"/>
            <circle cx="24" cy="24" r="18" fill="#00ff88"/>
            <!-- Smooth D-shaped carabiner body -->
            <path d="M18 12 C16 12 14 14 14 16 L14 32 C14 34 16 36 18 36 L30 36 C32 36 34 34 34 32 L34 16 C34 14 32 12 30 12 L24 12" stroke="black" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <!-- Gate with locking mechanism -->
            <path d="M24 12 L18 12" stroke="black" stroke-width="3" stroke-linecap="round"/>
            <rect x="17" y="10.5" width="2" height="3" rx="0.5" fill="black"/>
          </svg>
        `);
      } else if (location.type === 'contact') {
        // Person icon with blue - white outline matching menu
        iconUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Circular shadow background -->
            <circle cx="24" cy="24" r="20" fill="black" opacity="0.15"/>
            <circle cx="24" cy="24" r="18" fill="#2563eb"/>
            <!-- Person icon - white outline matching menu -->
            <circle cx="24" cy="19" r="4" stroke="white" stroke-width="2" fill="none"/>
            <path d="M16 31C16 27.6863 18.6863 25 22 25H26C29.3137 25 32 27.6863 32 31" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        `);
      } else {
        // Map pin icon with gray and circular shadow
        iconUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Circular shadow background -->
            <circle cx="24" cy="24" r="20" fill="black" opacity="0.15"/>
            <circle cx="24" cy="24" r="18" fill="#6b7280"/>
            <!-- Map pin icon -->
            <path d="M32 20C32 26 24 32 24 32C24 32 16 26 16 20C16 17.6131 16.9482 15.3239 18.636 13.636C20.3239 11.9482 22.6131 11 25 11C27.3869 11 29.6761 11.9482 31.364 13.636C33.0518 15.3239 34 17.6131 34 20Z" fill="black" opacity="0.8"/>
            <circle cx="24" cy="20" r="3" fill="white"/>
          </svg>
        `);
      }
      
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position: { lat, lng },
        title: location.name,
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        },
      });

      // Add click listener to show info
      marker.addListener("click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }
        infoWindowRef.current = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: Kanit, sans-serif;">
              <h3 style="font-weight: 600; margin-bottom: 4px; color: #0a0a0a;">${location.name}</h3>
              ${location.address ? `<p style="font-size: 12px; color: #666; margin-bottom: 4px;">${location.address}</p>` : ""}
              <p style="font-size: 11px; color: #00ff88; text-transform: uppercase;">${location.type}</p>
            </div>
          `,
        });
        infoWindowRef.current.open(mapRef.current, marker);
      });

      markersRef.current.set(location.id, marker);
    });

    // Clear existing clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    // Add clustering
    if (markersRef.current.size > 0) {
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers: Array.from(markersRef.current.values()),
        renderer: {
          render: ({ count, position }) => {
            const svg = `
              <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <circle cx="30" cy="30" r="26" fill="black" opacity="0.15"/>
                <circle cx="30" cy="30" r="24" fill="#00ff88"/>
                <text x="30" y="30" text-anchor="middle" dominant-baseline="central" font-family="Kanit, sans-serif" font-size="18" font-weight="700" fill="black">${count}</text>
              </svg>
            `;
            const iconUrl = 'data:image/svg+xml;base64,' + btoa(svg);
            return new google.maps.Marker({
              position,
              icon: {
                url: iconUrl,
                scaledSize: new google.maps.Size(60, 60),
                anchor: new google.maps.Point(30, 30),
              },
              zIndex: 1000,
            });
          },
        },
      });
    }
  }

  const handleSearchSelect = (result: typeof searchResults[0]) => {
    if (!mapRef.current || !result.latitude || !result.longitude) return;

    const lat = parseFloat(result.latitude);
    const lng = parseFloat(result.longitude);

    // Center and zoom to location
    mapRef.current.setCenter({ lat, lng });
    mapRef.current.setZoom(15);

    // Find and click the marker to open info window
    setTimeout(() => {
      const marker = markersRef.current.get(result.originalId);
      if (marker) {
        google.maps.event.trigger(marker, 'click');
      }
    }, 500);

    // Clear search
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleCreateLocation = () => {
    if (!name.trim()) {
      toast.error("Please enter a location name");
      return;
    }

    if (!selectedLocation) {
      toast.error("Please select a location on the map");
      return;
    }

    createLocationMutation.mutate({
      name: name.trim(),
      latitude: selectedLocation.lat.toString(),
      longitude: selectedLocation.lng.toString(),
      address: address.trim() || undefined,
      type: locationType,
      jobId: selectedJobId && selectedJobId !== "none" ? parseInt(selectedJobId) : undefined,
      contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
    });
  };

  const handleUpdateLocation = () => {
    if (!editingLocation) return;
    if (!name.trim()) {
      toast.error("Please enter a location name");
      return;
    }

    updateLocationMutation.mutate({
      id: editingLocation.id,
      name: name.trim(),
      address: address.trim() || undefined,
      type: locationType,
      jobId: selectedJobId && selectedJobId !== "none" ? parseInt(selectedJobId) : undefined,
      contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
    });
  };

  const handleDeleteLocation = (locationId: number) => {
    if (confirm("Are you sure you want to delete this location?")) {
      deleteLocationMutation.mutate({ id: locationId });
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Are you sure you want to delete ${count} location${count > 1 ? 's' : ''}?`)) {
      selectedIds.forEach((id) => {
        deleteLocationMutation.mutate({ id });
      });
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    }
  };

  const centerMapOnLocation = (location: Location) => {
    if (!mapRef.current) return;

    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    // Center and zoom to location
    mapRef.current.setCenter({ lat, lng });
    mapRef.current.setZoom(15);

    // Show info window
    const marker = markersRef.current.get(location.id);
    if (marker) {
      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow();
      }
      
      infoWindowRef.current.setContent(`
        <div style="padding: 8px; font-family: Kanit, sans-serif;">
          <h3 style="font-weight: 600; margin-bottom: 4px; color: #0a0a0a;">${location.name}</h3>
          ${location.address ? `<p style="font-size: 12px; color: #666; margin-bottom: 4px;">${location.address}</p>` : ""}
          <p style="font-size: 11px; color: #00ff88; text-transform: uppercase;">${location.type}</p>
        </div>
      `);
      infoWindowRef.current.open(mapRef.current, marker);
    }
  };

  const openEditDialog = (location: Location) => {
    setEditingLocation(location);
    setName(location.name);
    setAddress(location.address || "");
    setLocationType(location.type);
    setSelectedJobId(location.jobId?.toString() || "none");
    setSelectedContactId(location.contactId?.toString() || "none");
    setIsEditDialogOpen(true);
  };

  const handleItemAction = (action: ItemAction, locationId: number) => {
    const location = locations.find((l) => l.id === locationId);
    if (!location) return;

    switch (action) {
      case "edit":
        openEditDialog(location);
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "delete":
        handleDeleteLocation(locationId);
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([locationId]));
        break;
    }
  };

  const toggleSelection = (locationId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(locationId)) {
      newSelected.delete(locationId);
    } else {
      newSelected.add(locationId);
    }
    setSelectedIds(newSelected);
  };

  // Focus on specific marker when navigating from job/contact
  useEffect(() => {
    if (!mapRef.current || locations.length === 0) return;
    
    let targetLocation: Location | undefined;
    
    if (focusJobId) {
      targetLocation = locations.find(loc => loc.jobId === focusJobId);
    } else if (focusContactId) {
      targetLocation = locations.find(loc => loc.contactId === focusContactId);
    }
    
    if (targetLocation) {
      const lat = parseFloat(targetLocation.latitude);
      const lng = parseFloat(targetLocation.longitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        // Center and zoom to the target location
        mapRef.current.setCenter({ lat, lng });
        mapRef.current.setZoom(15);
        
        // Open info window for the marker
        const marker = markersRef.current.get(targetLocation.id);
        if (marker) {
          setTimeout(() => {
            if (infoWindowRef.current) {
              infoWindowRef.current.close();
            }
            infoWindowRef.current = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; font-family: Kanit, sans-serif;">
                  <h3 style="font-weight: 600; margin-bottom: 4px; color: #0a0a0a;">${targetLocation!.name}</h3>
                  ${targetLocation!.address ? `<p style="font-size: 12px; color: #666; margin-bottom: 4px;">${targetLocation!.address}</p>` : ""}
                  <p style="font-size: 11px; color: #00ff88; text-transform: uppercase;">${targetLocation!.type}</p>
                </div>
              `,
            });
            infoWindowRef.current.open(mapRef.current, marker);
          }, 500);
        }
      }
    }
  }, [locations, focusJobId, focusContactId]);

  useEffect(() => {
    if (!focusAddress || !mapReady || !mapRef.current) return;
    (async () => {
      try {
        const result = await geocodeMutation.mutateAsync({ address: focusAddress });
        if (!result?.latitude || !result.longitude) {
          toast.error("Unable to locate that address on the map");
          return;
        }
        const lat = parseFloat(result.latitude);
        const lng = parseFloat(result.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          toast.error("Invalid coordinates returned for that address");
          return;
        }
        mapRef.current?.setCenter({ lat, lng });
        mapRef.current?.setZoom(15);
        if (addressFocusMarkerRef.current) {
          addressFocusMarkerRef.current.setMap(null);
        }
        addressFocusMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position: { lat, lng },
          title: result.formattedAddress || focusAddress,
        });
        const url = new URL(window.location.href);
        url.searchParams.delete("address");
        const nextSearch = url.searchParams.toString();
        const nextHref = nextSearch ? `${url.pathname}?${nextSearch}${url.hash}` : `${url.pathname}${url.hash}`;
        window.history.replaceState(null, "", nextHref);
      } catch (error) {
        console.error(error);
        toast.error("Failed to locate that address");
      }
    })();
  }, [focusAddress, mapReady, geocodeMutation]);

  // Update markers when locations change
  useEffect(() => {
    createMarkers();

    // Fit bounds to show all markers
    if (mapRef.current && locations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach((location) => {
        const lat = parseFloat(location.latitude);
        const lng = parseFloat(location.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend({ lat, lng });
        }
      });
      mapRef.current.fitBounds(bounds);
    }
  }, [locations]);

  const getJobName = (jobId: number | null) => {
    if (!jobId) return null;
    const job = jobs.find((j) => j.id === jobId);
    return job?.title;
  };

  const getContactName = (contactId: number | null) => {
    if (!contactId) return null;
    const contact = contacts.find((c) => c.id === contactId);
    return contact?.name;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to view maps.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maps"
        subtitle="View and manage job locations on the map"
        searchSlot={
          <Dialog
            open={isSearchOpen}
            onOpenChange={(open) => {
              setIsSearchOpen(open);
              if (!open) {
                setShowSearchResults(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Search maps">
                <Search className="size-6" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Search maps</DialogTitle>
                <DialogDescription>
                  Search projects, contacts, or locations.
                </DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search projects, contacts, or locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showSearchResults && (
                <Card className="max-h-96 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="p-2">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSearchSelect(result)}
                          className="w-full text-left p-3 hover:bg-muted rounded-md transition-colors flex items-start gap-3"
                        >
                          <MapPin className="h-4 w-4 text-accent mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="truncate">
                                {result.name}
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    result.type === "job"
                                      ? "rgba(0, 255, 136, 0.1)"
                                      : result.type === "contact"
                                      ? "rgba(59, 130, 246, 0.1)"
                                      : "rgba(156, 163, 175, 0.1)",
                                  color:
                                    result.type === "job"
                                      ? "#00ff88"
                                      : result.type === "contact"
                                      ? "#3b82f6"
                                      : "#9ca3af",
                                }}
                              >
                                {result.type === "job"
                                  ? "Job"
                                  : result.type === "contact"
                                  ? "Contact"
                                  : "Location"}
                              </span>
                            </div>
                            {result.address && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {result.address}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.trim().length >= 3 ? (
                    <div className="p-2">
                      <div className="p-3 text-center text-muted-foreground mb-2">
                        <p className="text-sm">No locations found matching "{searchQuery}"</p>
                      </div>
                      <button
                        onClick={async () => {
                          // Geocode the search query using backend
                          try {
                            const result = await geocodeMutation.mutateAsync({ address: searchQuery });
                            if (result && result.latitude && result.longitude) {
                              setSelectedLocation({ lat: parseFloat(result.latitude), lng: parseFloat(result.longitude) });
                              setAddress(result.formattedAddress || searchQuery);
                              setName(result.formattedAddress || searchQuery);
                              setIsAddDialogOpen(true);
                              setSearchQuery("");
                              setShowSearchResults(false);
                              
                              // Center map on new location
                              if (mapRef.current) {
                                mapRef.current.setCenter({ lat: parseFloat(result.latitude), lng: parseFloat(result.longitude) });
                                mapRef.current.setZoom(15);
                              }
                            } else {
                              toast.error("Could not find this address");
                            }
                          } catch (error) {
                            toast.error("Failed to geocode address");
                            console.error(error);
                          }
                        }}
                        className="w-full text-left p-3 hover:bg-muted rounded-md transition-colors flex items-start gap-3 border border-dashed border-border"
                      >
                        <MapPin className="h-4 w-4 text-accent mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-accent">
                            Add "{searchQuery}" as new location
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            Geocode this address and add to map
                          </p>
                        </div>
                      </button>
                    </div>
                  ) : null}
                </Card>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsSearchOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Map and Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden">
            <div style={{ height: "600px" }}>
              <MapView
                initialCenter={{ lat: 46.8182, lng: 8.2275 }} // Switzerland center
                initialZoom={8}
                onMapReady={handleMapReady}
              />
            </div>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">
            Click anywhere on the map to add a new location marker
          </p>
        </div>

        {/* Locations List */}
        <div className="space-y-4">
          <h2 className="text-xl">
            Saved Locations ({locations.length})
          </h2>
          {locations.length === 0 ? (
            <Card className="p-6 text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No locations yet. Click on the map to add one.
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[550px] overflow-y-auto">
              {locations.map((location) => {
                return (
                  <Card
                    key={location.id}
                    className={`p-4 transition-all ${
                      selectedIds.has(location.id) ? "ring-2 ring-[#00ff88]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isMultiSelectMode && (
                        <Checkbox
                          checked={selectedIds.has(location.id)}
                          onCheckedChange={() => toggleSelection(location.id)}
                          className="mt-1"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <MapPin className="h-4 w-4 text-accent mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h3
                                className="text-sm cursor-pointer hover:text-accent transition-colors"
                                onClick={() => centerMapOnLocation(location)}
                              >
                                {location.name}
                              </h3>
                              {location.address && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {location.address}
                                </p>
                              )}
                            </div>
                          </div>
                          {!isMultiSelectMode && (
                            <ItemActionsMenu
                              onAction={(action) => handleItemAction(action, location.id)}
                              actions={["edit", "duplicate", "delete", "select"]}
                              triggerClassName="text-muted-foreground hover:text-foreground"
                              size="sm"
                            />
                          )}
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="text-accent uppercase">{location.type}</span>
                          {getJobName(location.jobId) && (
                            <span className="text-muted-foreground">Job: {getJobName(location.jobId)}</span>
                          )}
                          {getContactName(location.contactId) && (
                            <span className="text-muted-foreground">
                              Contact: {getContactName(location.contactId)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Select Bar */}
      <MultiSelectBar
        selectedCount={selectedIds.size}
        onPrimaryAction={handleBatchDelete}
        onCancel={() => {
          setIsMultiSelectMode(false);
          setSelectedIds(new Set());
        }}
      />

      {/* Add Location Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription>
              {selectedLocation
                ? `Add a marker at coordinates: ${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`
                : "Click on the map to select a location"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Construction Site A"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select value={locationType} onValueChange={(value: any) => setLocationType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Location</SelectItem>
                  <SelectItem value="job">Job Site</SelectItem>
                  <SelectItem value="contact">Contact Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {locationType === "job" && (
              <div className="grid gap-2">
                <Label htmlFor="job">Link to Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {locationType === "contact" && (
              <div className="grid gap-2">
                <Label htmlFor="contact">Link to Contact</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateLocation}
              disabled={createLocationMutation.isPending || !selectedLocation}
              className="bg-[#00ff88] text-black hover:bg-[#00dd77]"
            >
              {createLocationMutation.isPending ? "Adding..." : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>
              Update location details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Location Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Construction Site A"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select value={locationType} onValueChange={(value: any) => setLocationType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Location</SelectItem>
                  <SelectItem value="job">Job Site</SelectItem>
                  <SelectItem value="contact">Contact Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {locationType === "job" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-job">Link to Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {locationType === "contact" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-contact">Link to Contact</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setIsEditDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateLocation}
              disabled={updateLocationMutation.isPending}
              className="bg-[#00ff88] text-black hover:bg-[#00dd77]"
            >
              {updateLocationMutation.isPending ? "Updating..." : "Update Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
