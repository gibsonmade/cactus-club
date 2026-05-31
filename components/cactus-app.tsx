"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Lottie from "lottie-react";
import { SafeImage } from "@/components/safe-image";
import {
  ArrowRight,
  Bike,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CloudRain,
  CloudSun,
  Compass,
  Copy,
  Droplets,
  Dumbbell,
  Flame,
  Heart,
  ListPlus,
  Laugh,
  LocateFixed,
  MapPin,
  Martini,
  Moon,
  Music,
  Navigation,
  PartyPopper,
  RefreshCcw,
  Search,
  Share2,
  Sparkles,
  Star,
  Thermometer,
  Trees,
  Utensils,
  Users,
  Wind,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventDetailDrawer } from "@/components/event-detail-drawer";
import { chooseForMove } from "@/lib/enrichment";
import { distanceMiles, enrichDistances, formatDistance, type UserLocation } from "@/lib/location";
import { dayLabel, formatEventTime, isNextWeek, isThisWeekend, isToday, isTomorrow, isTonight, isUpcoming, isWithinDateRange, sortSoonest } from "@/lib/time";
import type { Area, EventItem, EvergreenEventItem, MoveCompany, MoveEnergy, MoveIntent, MoveVibe, VenueItem, VibeTag } from "@/lib/types";
import { publicPath } from "@/lib/public-path";
import { cn, uniq } from "@/lib/utils";
import { buildOutingRecommendations, buildUnifiedPlaces, tagToVibeTags, type AtxArticle, type AtxEatPlace, type OutingRecommendation, type UnifiedPlace } from "@/lib/unified";
import type { AppData } from "@/lib/app-data";

type Tab = "Today" | "Explore" | "Plan" | "Places";

const tabs: Array<{ id: Tab; icon: typeof Sparkles; href: string }> = [
  { id: "Today", icon: Sparkles, href: "/today" },
  { id: "Explore", icon: Compass, href: "/explore" },
  { id: "Places", icon: MapPin, href: "/places" },
  { id: "Plan", icon: Heart, href: "/plan" }
];

const categoryLinks: Array<{ label: string; vibe?: VibeTag; area?: Area; icon: typeof Music; copy: string }> = [
  { label: "Live Music", vibe: "Live Music", icon: Music, copy: "Bands, rooms, and noise worth leaving for." },
  { label: "Comedy", vibe: "Comedy", icon: Laugh, copy: "Laugh-first plans without the spreadsheet." },
  { label: "Date Night", vibe: "Date Night", icon: Heart, copy: "Low-pressure chemistry." },
  { label: "Dance", vibe: "Dancing", icon: PartyPopper, copy: "Move your body, text the group." },
  { label: "Outdoors", vibe: "Outdoors", icon: Trees, copy: "Touch grass, but make it social." },
  { label: "Wellness", vibe: "Wellness", icon: Dumbbell, copy: "Reset energy." },
  { label: "Weird Austin", vibe: "Weird Austin", icon: Sparkles, copy: "Odd, specific, worth it." },
  { label: "East Side", area: "East Side", icon: Flame, copy: "East Side gravity." }
];

const categoryAnimationThemes: Record<string, { primary: string; secondary: string; speed: number }> = {
  "Live Music": { primary: "#d6ff4f", secondary: "#d76632", speed: 1 },
  Comedy: { primary: "#f8f0df", secondary: "#d6ff4f", speed: 1.15 },
  "Date Night": { primary: "#ff6f91", secondary: "#f8f0df", speed: 0.9 },
  Dance: { primary: "#6e42ff", secondary: "#d6ff4f", speed: 1.25 },
  Outdoors: { primary: "#d6ff4f", secondary: "#7dd3fc", speed: 0.82 },
  Wellness: { primary: "#7dd3fc", secondary: "#f8f0df", speed: 0.76 },
  "Weird Austin": { primary: "#6e42ff", secondary: "#ff6f91", speed: 1.2 },
  "East Side": { primary: "#d76632", secondary: "#d6ff4f", speed: 1.05 }
};

const tabAnimationLabels: Record<Tab, string> = {
  Today: "Weird Austin",
  Explore: "Outdoors",
  Places: "East Side",
  Plan: "Date Night"
};

const moveVibes: MoveVibe[] = [
  "Main Character Night",
  "Touch Grass",
  "Cheap Thrills",
  "Date Without Trying Too Hard",
  "East Side Energy",
  "Avoid Staying Home",
  "One Drink Turns Into Four",
  "Soft Night",
  "Weird Austin",
  "Actually Worth It"
];

const vibeFilters: VibeTag[] = ["Date Night", "Free", "Weird Austin", "Low-Key", "Popular", "Social", "Outdoors", "Late Night", "Wellness", "Live Music", "Comedy", "Dancing"];
const areaFilters: Area[] = ["East Side", "Downtown", "Central", "Barton/Zilker", "South Austin", "North Austin", "Burbs"];

const fallbackImage = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop";
const austinLocation = { latitude: 30.2672, longitude: -97.7431 };
const defaultCustomPlaceLists = {
  "Need to Try": [],
  "Date Night": [],
  "Friends": []
};

function areaLabel(area: Area | "All") {
  return area === "Burbs" ? "Suburbs" : area;
}

const neighborhoodOptions: Array<{ label: string; value: string; location?: UserLocation; area?: Area }> = [
  { label: "Use my location", value: "current" },
  { label: "Downtown", value: "downtown", area: "Downtown", location: { latitude: 30.2672, longitude: -97.7431 } },
  { label: "East Side", value: "east-side", area: "East Side", location: { latitude: 30.2636, longitude: -97.7128 } },
  { label: "South Austin", value: "south-austin", area: "South Austin", location: { latitude: 30.227, longitude: -97.769 } },
  { label: "Barton/Zilker", value: "barton-zilker", area: "Barton/Zilker", location: { latitude: 30.265, longitude: -97.773 } },
  { label: "North Austin", value: "north-austin", area: "North Austin", location: { latitude: 30.337, longitude: -97.72 } },
  { label: "Suburbs", value: "suburbs", area: "Burbs", location: { latitude: 30.5083, longitude: -97.6789 } },
  { label: "Mueller", value: "mueller", area: "Central", location: { latitude: 30.2976, longitude: -97.7046 } }
];

type WeatherState = {
  temperature: number;
  code: number;
  precipitation: number;
  precipitationChance: number;
  windSpeed: number;
  label: string;
};

type FriendTasteProfile = {
  id: string;
  name: string;
  saved: string[];
  visited?: string[];
  tasteTags: string[];
  location?: { lat: number; lng: number; label?: string };
  exportedAt?: string;
};

let appDataCache: AppData | undefined;
let appDataPromise: Promise<AppData> | undefined;

function loadAppData({ forceFull = false }: { forceFull?: boolean } = {}) {
  if (appDataCache && (!forceFull || !appDataCache.isPartial)) return Promise.resolve(appDataCache);
  if (!appDataPromise) {
    appDataPromise = Promise.all([
      fetch(publicPath("/data/events.json")).then((response) => response.json() as Promise<EventItem[]>),
      fetch(publicPath("/data/venues.json")).then((response) => response.json() as Promise<VenueItem[]>),
      fetch(publicPath("/data/evergreen-events.json"))
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []) as Promise<EvergreenEventItem[]>,
      fetch(publicPath("/data/atx-eats/places.json"))
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []) as Promise<AtxEatPlace[]>,
      fetch(publicPath("/data/atx-eats/articles.json"))
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []) as Promise<AtxArticle[]>
    ]).then(([events, venues, evergreenEvents, restaurants, articles]) => {
      appDataCache = { events, venues, evergreenEvents, restaurants, articles, isPartial: false };
      return appDataCache;
    });
  }
  return appDataPromise;
}

function readStoredLocation() {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.localStorage.getItem("userLocation");
    return stored ? (JSON.parse(stored) as UserLocation) : undefined;
  } catch {
    return undefined;
  }
}

function readStoredLocationLabel() {
  if (typeof window === "undefined") return "Nearby";
  return window.localStorage.getItem("userLocationLabel") ?? "Nearby";
}

export function CactusApp({ initialTab = "Today", initialData }: { initialTab?: Tab; initialData?: AppData }) {
  const router = useRouter();
  const pathname = usePathname();
  const cachedData = initialData ?? appDataCache;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [initialEvents, setInitialEvents] = useState<EventItem[]>(() => cachedData?.events ?? []);
  const [initialVenues, setInitialVenues] = useState<VenueItem[]>(() => cachedData?.venues ?? []);
  const [initialEvergreenEvents, setInitialEvergreenEvents] = useState<EvergreenEventItem[]>(() => cachedData?.evergreenEvents ?? []);
  const [initialRestaurants, setInitialRestaurants] = useState<AtxEatPlace[]>(() => cachedData?.restaurants ?? []);
  const [initialArticles, setInitialArticles] = useState<AtxArticle[]>(() => cachedData?.articles ?? []);
  const [dataReady, setDataReady] = useState(() => Boolean(cachedData));
  const [savedEvents, setSavedEvents] = useStoredIds("savedEvents");
  const [savedVenues, setSavedVenues] = useStoredIds("savedVenues");
  const [savedPlaces, setSavedPlaces] = useStoredIds("savedPlaces");
  const [visitedPlaces, setVisitedPlaces] = useStoredIds("visitedPlaces");
  const [friendProfiles, setFriendProfiles] = useStoredJson<FriendTasteProfile[]>("friendProfiles", []);
  const [customLists, setCustomLists] = useStoredJson<Record<string, string[]>>("customPlaceLists", defaultCustomPlaceLists);
  const [hiddenEvents] = useStoredIds("hiddenEvents");
  const [preferredVibes, setPreferredVibes] = useStoredArray<VibeTag>("preferredVibes");
  const [preferredAreas, setPreferredAreas] = useStoredArray<Area>("preferredAreas");
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>(undefined);
  const [locationLabel, setLocationLabel] = useState("Nearby");
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [detailPlace, setDetailPlace] = useState<UnifiedPlace | null>(null);
  const savedPlanCount = savedEvents.length + savedVenues.length + savedPlaces.length;
  const previousSavedPlanCount = useRef<number | null>(null);
  const [planPulse, setPlanPulse] = useState(0);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setUserLocation(readStoredLocation());
    setLocationLabel(readStoredLocationLabel());
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function applyData({ events, venues, evergreenEvents, restaurants, articles }: AppData) {
      if (!active) return;
      setInitialEvents(events);
      setInitialVenues(venues);
      setInitialEvergreenEvents(evergreenEvents);
      setInitialRestaurants(restaurants);
      setInitialArticles(articles);
      setDataReady(true);
    }

    if (initialData) {
      if (!appDataCache || !initialData.isPartial) appDataCache = initialData;
      applyData(initialData);
      if (!initialData.isPartial) {
        return () => {
          active = false;
        };
      }

      const hydrateFullData = () => {
        loadAppData({ forceFull: true })
          .then(applyData)
          .catch(() => {
            if (active) setDataReady(true);
          });
      };

      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(hydrateFullData, { timeout: 2200 });
      } else {
        timeoutId = setTimeout(hydrateFullData, 900);
      }

      return () => {
        active = false;
        if (idleId !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    loadAppData()
      .then(({ events, venues, evergreenEvents, restaurants, articles }) => {
        applyData({ events, venues, evergreenEvents, restaurants, articles });
      })
      .catch(() => {
        if (active) setDataReady(true);
      });
    return () => {
      active = false;
    };
  }, [initialData]);

  useEffect(() => {
    const location = userLocation ?? austinLocation;
    let active = true;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", "temperature_2m,weather_code,precipitation,wind_speed_10m");
    url.searchParams.set("hourly", "precipitation_probability");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("timezone", "auto");
    fetch(url.toString())
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const temperature = Math.round(payload?.current?.temperature_2m ?? 0);
        const code = Number(payload?.current?.weather_code ?? 0);
        const precipitation = Number(payload?.current?.precipitation ?? 0);
        const windSpeed = Number(payload?.current?.wind_speed_10m ?? 0);
        const precipitationChance = Number(payload?.hourly?.precipitation_probability?.[0] ?? 0);
        setWeather({ temperature, code, precipitation, precipitationChance, windSpeed, label: weatherLabel(code) });
      })
      .catch(() => {
        if (active) setWeather(null);
      });
    return () => {
      active = false;
    };
  }, [userLocation]);

  const distanceData = useMemo(
    () => enrichDistances(initialEvents, initialVenues, userLocation),
    [initialEvents, initialVenues, userLocation]
  );
  const upcomingEvents = useMemo(() => distanceData.events.filter((event) => isUpcoming(event)).sort(sortSoonest), [distanceData.events]);
  const visibleEvents = useMemo(() => upcomingEvents.filter((event) => !hiddenEvents.includes(event.id)), [hiddenEvents, upcomingEvents]);
  const venues = useMemo(() => distanceData.venues.filter((venue) => venue.upcomingCount > 0 || (venue.evergreenCount ?? 0) > 0), [distanceData.venues]);
  const unifiedPlaces = useMemo(
    () => buildUnifiedPlaces({ restaurants: initialRestaurants, venues, events: upcomingEvents, userLocation }),
    [initialRestaurants, upcomingEvents, userLocation, venues]
  );
  const savedUnifiedPlaces = useMemo(
    () => unifiedPlaces.filter((place) => savedPlaces.includes(place.id) || savedVenues.includes(place.sourceId)),
    [savedPlaces, savedVenues, unifiedPlaces]
  );
  const outingRecommendations = useMemo(
    () => buildOutingRecommendations(visibleEvents, unifiedPlaces),
    [unifiedPlaces, visibleEvents]
  );

  useEffect(() => {
    migrateAtxEatsState(setSavedPlaces, setVisitedPlaces, setCustomLists, setFriendProfiles, setPreferredVibes);
  }, [setCustomLists, setFriendProfiles, setPreferredVibes, setSavedPlaces, setVisitedPlaces]);

  useEffect(() => {
    if (!dataReady || !initialEvents.length) return;
    const valid = new Set(upcomingEvents.map((event) => event.id));
    const pruned = savedEvents.filter((id) => valid.has(id));
    if (pruned.length !== savedEvents.length) setSavedEvents(pruned);
  }, [dataReady, initialEvents.length, savedEvents, setSavedEvents, upcomingEvents]);

  useEffect(() => {
    if (previousSavedPlanCount.current === null) {
      previousSavedPlanCount.current = savedPlanCount;
      return;
    }
    if (savedPlanCount > previousSavedPlanCount.current) {
      setPlanPulse((pulse) => pulse + 1);
    }
    previousSavedPlanCount.current = savedPlanCount;
  }, [savedPlanCount]);

  function toggleSavedEvent(id: string) {
    setSavedEvents((current) => (current.includes(id) ? current.filter((eventId) => eventId !== id) : [...current, id]));
  }

  function toggleSavedVenue(id: string) {
    setSavedVenues((current) => (current.includes(id) ? current.filter((venueId) => venueId !== id) : [...current, id]));
  }

  function toggleSavedPlace(id: string) {
    setSavedPlaces((current) => (current.includes(id) ? current.filter((placeId) => placeId !== id) : [...current, id]));
  }

  function toggleVisitedPlace(id: string) {
    setVisitedPlaces((current) => (current.includes(id) ? current.filter((placeId) => placeId !== id) : [...current, id]));
  }

  function addMoseyToPlan(eventId: string, placeIds: string[]) {
    setSavedEvents((current) => uniq([eventId, ...current]));
    setSavedPlaces((current) => uniq([...placeIds, ...current]));
  }

  function addPlaceToList(listName: string, placeId: string) {
    setCustomLists((current) => ({
      ...current,
      [listName]: uniq([...(current[listName] ?? []), placeId])
    }));
    setSavedPlaces((current) => uniq([placeId, ...current]));
  }

  function removePlaceFromList(listName: string, placeId: string) {
    setCustomLists((current) => ({
      ...current,
      [listName]: (current[listName] ?? []).filter((id) => id !== placeId)
    }));
  }

  function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        window.localStorage.setItem(
          "userLocation",
          JSON.stringify(nextLocation)
        );
        window.localStorage.setItem("userLocationLabel", "Current location");
        setUserLocation(nextLocation);
        setLocationLabel("Current location");
        if (activeTab !== "Places") router.push("/explore?date=Nearby");
      },
      () => setUserLocation(undefined),
      { enableHighAccuracy: false, timeout: 6000 }
    );
  }

  function selectNeighborhood(option: (typeof neighborhoodOptions)[number]) {
    if (option.value === "current") {
      requestLocation();
      return;
    }
    if (!option.location) return;
    window.localStorage.setItem("userLocation", JSON.stringify(option.location));
    window.localStorage.setItem("userLocationLabel", option.label);
    setUserLocation(option.location);
    setLocationLabel(option.label);
    if (activeTab !== "Places") router.push(option.area ? `/explore?area=${encodeURIComponent(option.area)}` : "/explore");
  }

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-[1120px] px-4 pb-24 pt-4 text-bone sm:px-6 md:pb-10">
      <AmbientChrome activeTab={activeTab} locationLabel={locationLabel} locationEnabled={Boolean(userLocation)} savedPlanCount={savedPlanCount} planPulse={planPulse} onNeighborhood={selectNeighborhood} />
      <section className="w-full">
        <AnimatePresence mode="wait">
          {!dataReady ? (
            <AppLoadingSkeleton />
          ) : null}
          {dataReady && activeTab === "Today" ? (
            <UpcomingView
              key="upcoming"
              events={visibleEvents}
              preferredVibes={preferredVibes}
              preferredAreas={preferredAreas}
              weather={weather}
              places={unifiedPlaces}
              articles={initialArticles}
              savedEvents={savedEvents}
              savedVenues={savedVenues}
              savedPlaces={savedPlaces}
              onSave={toggleSavedEvent}
              onSavePlace={toggleSavedPlace}
              onOpenPlace={setDetailPlace}
              onOpenDetails={setDetailEvent}
            />
          ) : null}
          {dataReady && activeTab === "Explore" ? (
            <ExploreView
              key="explore"
              events={visibleEvents}
              places={unifiedPlaces}
              articles={initialArticles}
              locationEnabled={Boolean(userLocation)}
              savedEvents={savedEvents}
              savedPlaces={savedPlaces}
              visitedPlaces={visitedPlaces}
              onSave={toggleSavedEvent}
              onSavePlace={toggleSavedPlace}
              onAddMoseyToPlan={addMoseyToPlan}
              onVisitPlace={toggleVisitedPlace}
              onOpenPlace={setDetailPlace}
              onOpenDetails={setDetailEvent}
              onPreferredArea={setPreferredAreas}
              onPreferredVibe={setPreferredVibes}
              preferredAreas={preferredAreas}
              preferredVibes={preferredVibes}
            />
          ) : null}
          {dataReady && activeTab === "Plan" ? (
            <PlanView
              key="plan"
              events={upcomingEvents}
              venues={venues}
              places={unifiedPlaces}
              savedPlaces={savedPlaces}
              visitedPlaces={visitedPlaces}
              customLists={customLists}
              friendProfiles={friendProfiles}
              savedEvents={savedEvents}
              savedVenues={savedVenues}
              onSaveEvent={toggleSavedEvent}
              onSaveVenue={toggleSavedVenue}
              onSavePlace={toggleSavedPlace}
              onVisitPlace={toggleVisitedPlace}
              onOpenPlace={setDetailPlace}
              onAddPlaceToList={addPlaceToList}
              onRemovePlaceFromList={removePlaceFromList}
              onFriendProfiles={setFriendProfiles}
              onOpenDetails={setDetailEvent}
            />
          ) : null}
          {dataReady && activeTab === "Places" ? (
            <VenuesView
              key="venues"
              events={visibleEvents}
              venues={venues}
              places={unifiedPlaces}
              locationEnabled={Boolean(userLocation)}
              savedVenues={savedVenues}
              savedPlaces={savedPlaces}
              onSaveVenue={toggleSavedVenue}
              onSavePlace={toggleSavedPlace}
              onOpenPlace={setDetailPlace}
            />
          ) : null}
        </AnimatePresence>
      </section>
      {activeTab !== "Today" ? <AppFooter /> : null}
      <EventDetailDrawer
        event={detailEvent}
        nearbyPlaces={detailEvent ? unifiedPlaces.filter((place) => place.kind === "restaurant" && place.area === detailEvent.area).slice(0, 3) : []}
        onClose={() => setDetailEvent(null)}
        onOpenPlace={setDetailPlace}
      />
      <PlaceDetailDrawer
        place={detailPlace}
        events={detailPlace ? upcomingEvents.filter((event) => detailPlace.upcomingEventIds.includes(event.id)).slice(0, 5) : []}
        listNames={Object.keys(customLists)}
        saved={detailPlace ? savedPlaces.includes(detailPlace.id) || savedVenues.includes(detailPlace.sourceId) : false}
        visited={detailPlace ? visitedPlaces.includes(detailPlace.id) : false}
        onClose={() => setDetailPlace(null)}
        onSave={toggleSavedPlace}
        onVisit={toggleVisitedPlace}
        onAddToList={addPlaceToList}
        onOpenDetails={setDetailEvent}
      />
      <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pt-2 md:hidden">
        <div className="glass-panel mx-auto grid max-w-md grid-cols-4 gap-1 rounded-[1.65rem] p-1.5">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const isPlan = tab.id === "Plan";
            return (
              <Link
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 rounded-[1.15rem] text-[11px] font-bold transition",
                  active ? "bg-white/70 text-ink shadow-[0_10px_30px_rgba(48,209,88,0.18)]" : "text-emerald-950 hover:bg-white/56"
                )}
                href={tab.href}
                key={tab.id}
              >
                <motion.span
                  animate={isPlan && planPulse ? { scale: [1, 1.26, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }}
                  transition={{ duration: 0.34 }}
                >
                  <TabLottieIcon tab={tab.id} icon={tab.icon} active={active} />
                </motion.span>
                {tab.id}
                {isPlan ? <PlanCountBadge count={savedPlanCount} pulse={planPulse} active={active} compact /> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function useStoredArray<T extends string>(key: string) {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    setItems(readStoredJsonValue<T[]>(key, []));
  }, [key]);
  const update = useCallback((next: T[] | ((current: T[]) => T[])) => {
    setItems((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  }, [key]);
  return [items, update] as const;
}

function useStoredIds(key: string) {
  return useStoredArray<string>(key);
}

function useStoredJson<T>(key: string, fallback: T) {
  const [item, setItem] = useState<T>(fallback);
  useEffect(() => {
    setItem(readStoredJsonValue<T>(key, fallback));
  }, [key]);
  const update = useCallback((next: T | ((current: T) => T)) => {
    setItem((current) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  }, [key]);
  return [item, update] as const;
}

function readStoredJsonValue<T>(key: string, fallback: T) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function migrateAtxEatsState(
  setSavedPlaces: (next: string[] | ((current: string[]) => string[])) => void,
  setVisitedPlaces: (next: string[] | ((current: string[]) => string[])) => void,
  setCustomLists: (next: Record<string, string[]> | ((current: Record<string, string[]>) => Record<string, string[]>)) => void,
  setFriendProfiles: (next: FriendTasteProfile[] | ((current: FriendTasteProfile[]) => FriendTasteProfile[])) => void,
  setPreferredVibes: (next: VibeTag[] | ((current: VibeTag[]) => VibeTag[])) => void
) {
  try {
    if (window.localStorage.getItem("atx-eats-migrated-to-cactus-v1")) return;
    const raw = window.localStorage.getItem("atx-eats-state-v1");
    if (!raw) {
      window.localStorage.setItem("atx-eats-migrated-to-cactus-v1", "1");
      return;
    }
    const parsed = JSON.parse(raw) as {
      saved?: string[];
      visited?: string[];
      lists?: Record<string, string[]>;
      friendProfiles?: FriendTasteProfile[];
      tasteTags?: string[];
    };
    const saved = (parsed.saved ?? []).map((id) => `food:${id}`);
    const visited = (parsed.visited ?? []).map((id) => `food:${id}`);
    setSavedPlaces((current) => uniq([...saved, ...current]));
    setVisitedPlaces((current) => uniq([...visited, ...current]));
    if (parsed.lists) {
      setCustomLists((current) => {
        const next = { ...current };
        for (const [name, ids] of Object.entries(parsed.lists ?? {})) {
          next[name] = uniq([...(next[name] ?? []), ...ids.map((id) => `food:${id}`)]);
        }
        return next;
      });
    }
    if (parsed.friendProfiles?.length) {
      setFriendProfiles((current) => uniqBy([...current, ...parsed.friendProfiles!], (profile) => profile.id));
    }
    const migratedVibes = tagToVibeTags(parsed.tasteTags ?? []);
    if (migratedVibes.length) setPreferredVibes((current) => uniq([...migratedVibes, ...current]).slice(0, 8));
    window.localStorage.setItem("atx-eats-migrated-to-cactus-v1", "1");
  } catch {
    window.localStorage.setItem("atx-eats-migrated-to-cactus-v1", "1");
  }
}

function uniqBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function AppFooter() {
  return (
    <footer className="mt-12 w-full pb-28 md:pb-4">
      <div className="glass-panel rounded-[1.5rem] p-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neon">Cactus Club</p>
        <p className="mt-2 text-sm font-bold text-bone/58">End of the list. Go make the plan.</p>
      </div>
    </footer>
  );
}

function AppLoadingSkeleton() {
  return (
    <motion.section {...viewMotion} className="min-h-[calc(100vh-9rem)] space-y-8 pt-6 md:pt-10">
      <section className="glass-panel overflow-hidden rounded-[1.75rem] p-4">
        <div className="grid gap-4 md:grid-cols-[340px_1fr]">
          <div className="soft-shimmer h-[360px] rounded-[1.25rem] bg-white/10" />
          <div className="space-y-4">
            <div className="soft-shimmer h-8 w-44 rounded-full bg-white/10" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div className="soft-shimmer h-40 rounded-[1.25rem] bg-white/8" key={item} />
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((item) => (
          <div className="soft-shimmer h-32 w-40 shrink-0 rounded-[1.25rem] bg-white/8" key={item} />
        ))}
      </div>
    </motion.section>
  );
}

function TabLottieIcon({ tab, icon: Icon, active }: { tab: Tab; icon: typeof Sparkles; active: boolean }) {
  const animationData = useMemo(() => makeCategoryLottie(categoryAnimationThemes[tabAnimationLabels[tab]] ?? categoryAnimationThemes["Live Music"]), [tab]);
  return (
    <span className="relative grid h-5 w-5 place-items-center overflow-visible">
      <Lottie
        animationData={animationData}
        autoplay={active}
        loop
        className={cn("absolute inset-[-11px] h-11 w-11 transition", active ? "opacity-95" : "opacity-38")}
        aria-hidden
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      />
      <Icon className={cn("relative z-10 h-4 w-4", active ? "text-ink md:text-ink" : "text-bone/72")} />
    </span>
  );
}

function PlanCountBadge({ count, pulse, active, compact = false }: { count: number; pulse: number; active: boolean; compact?: boolean }) {
  if (!count) return null;
  return (
    <motion.span
      key={pulse}
      initial={{ scale: pulse ? 0.62 : 1, y: pulse ? -8 : 0 }}
      animate={{ scale: [1, 1.28, 1], y: [0, -3, 0] }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className={cn(
        "grid place-items-center rounded-full text-[10px] font-black shadow-[0_8px_24px_rgba(48,209,88,0.28)]",
        compact ? "absolute right-2 top-1 h-5 min-w-5 px-1" : "h-5 min-w-5 px-1.5",
        active ? "bg-neon text-emerald-950" : "bg-neon text-emerald-950"
      )}
      aria-label={`${count} saved plan items`}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

function AmbientChrome({
  activeTab,
  locationLabel,
  locationEnabled,
  savedPlanCount,
  planPulse,
  onNeighborhood
}: {
  activeTab: Tab;
  locationLabel: string;
  locationEnabled: boolean;
  savedPlanCount: number;
  planPulse: number;
  onNeighborhood: (option: (typeof neighborhoodOptions)[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="glass-panel sticky top-3 z-50 mx-auto mb-4 flex min-h-[58px] w-full max-w-[calc(100vw-2rem)] items-center gap-2 rounded-[1.45rem] px-3 py-2 sm:max-w-full md:top-4 md:mb-6 md:min-h-[62px] md:px-4">
        <Link className="flex min-h-10 shrink-0 items-center gap-2 rounded-full px-2.5 text-neon transition hover:bg-white/10 active:scale-[0.96]" href="/today">
          <Utensils className="h-5 w-5" />
          <p className="hidden text-base font-black sm:block">Cactus Club</p>
        </Link>

        <nav className="hidden flex-1 items-center justify-end gap-1.5 overflow-x-auto md:flex">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const isPlan = tab.id === "Plan";
            return (
              <Link
                className={cn(
                  "relative inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-black transition-transform transition-colors active:scale-[0.96]",
                  active ? "bg-white/54 text-ink shadow-[0_8px_22px_rgba(6,47,34,0.10)]" : "text-emerald-950/78 hover:bg-white/36 hover:text-emerald-950"
                )}
                href={tab.href}
                key={tab.id}
              >
                <motion.span
                  animate={isPlan && planPulse ? { scale: [1, 1.24, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
                  transition={{ duration: 0.36 }}
                >
                  <TabLottieIcon tab={tab.id} icon={tab.icon} active={active} />
                </motion.span>
                {tab.id}
                {isPlan ? <PlanCountBadge count={savedPlanCount} pulse={planPulse} active={active} /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="relative ml-auto shrink-0 md:ml-1">
          <button
            className="inline-flex min-h-10 max-w-[46vw] items-center gap-2 rounded-full border border-white/48 bg-white/48 px-3 py-2 text-xs font-black text-emerald-950/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] backdrop-blur-xl transition-transform transition-colors hover:bg-white/68 active:scale-[0.96] md:max-w-none"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            <LocateFixed className="h-4 w-4 shrink-0 text-emerald-100" />
            <span className="hidden truncate sm:inline">{locationEnabled ? locationLabel : "Nearby"}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition", open && "rotate-180")} />
          </button>
          <AnimatePresence>
            {open ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-12 z-[90] w-60 overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/90 p-2 text-ink shadow-[0_24px_80px_rgba(0,0,0,0.24)] ring-1 ring-white/50 backdrop-blur-2xl"
              >
                {neighborhoodOptions.map((option) => (
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold text-ink/76 transition hover:bg-emerald-50 hover:text-ink focus:outline-none focus:ring-2 focus:ring-neon/40"
                    key={option.value}
                    onClick={() => {
                      onNeighborhood(option);
                      setOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {option.label === locationLabel ? <span className="h-2 w-2 rounded-full bg-neon" /> : null}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
    </header>
  );
}

function UpcomingView({
  events,
  preferredAreas,
  preferredVibes,
  weather,
  places,
  articles,
  savedEvents,
  savedVenues,
  savedPlaces,
  onSave,
  onSavePlace,
  onOpenPlace,
  onOpenDetails
}: {
  events: EventItem[];
  preferredAreas: Area[];
  preferredVibes: VibeTag[];
  weather: WeatherState | null;
  places: UnifiedPlace[];
  articles: AtxArticle[];
  savedEvents: string[];
  savedVenues: string[];
  savedPlaces: string[];
  onSave: (id: string) => void;
  onSavePlace: (id: string) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
  onOpenDetails: (event: EventItem) => void;
}) {
  const upcomingWindow = useMemo(() => {
    const focused = events.filter((event) => isToday(event) || isTomorrow(event) || isThisWeekend(event) || isNextWeek(event));
    return focused.length ? focused : events.slice(0, 60);
  }, [events]);
  const ranked = useMemo(
    () => [...upcomingWindow].sort((a, b) => personalizedScore(b, preferredVibes, preferredAreas) - personalizedScore(a, preferredVibes, preferredAreas)),
    [preferredAreas, preferredVibes, upcomingWindow]
  );
  const rightNowEvents = useMemo(() => {
    const immediate = events.filter((event) => isTonight(event) || isToday(event));
    const source = immediate.length >= 6 ? immediate : [...immediate, ...ranked.filter((event) => !immediate.some((item) => item.id === event.id))];
    return dedupeHomepageEvents([...source]
      .sort((a, b) => {
        const aUrgency = isTonight(a) ? 40 : isToday(a) ? 24 : 0;
        const bUrgency = isTonight(b) ? 40 : isToday(b) ? 24 : 0;
        return (
          personalizedScore(b, preferredVibes, preferredAreas) + b.popularityScore + b.attendeeCount / 18 + bUrgency -
          (personalizedScore(a, preferredVibes, preferredAreas) + a.popularityScore + a.attendeeCount / 18 + aUrgency)
        );
      }))
      .slice(0, 12);
  }, [events, preferredAreas, preferredVibes, ranked]);
  const fallbackUpcomingEvents = useMemo(() => dedupeHomepageEvents(ranked.filter((event) => !rightNowEvents.some((item) => item.id === event.id))).slice(0, 8), [ranked, rightNowEvents]);
  const spotlightEvents = rightNowEvents.length ? rightNowEvents : fallbackUpcomingEvents;
  const hero = spotlightEvents[0];
  const todayEventCount = useMemo(() => events.filter((event) => isToday(event)).length, [events]);
  const planAroundPlaces = useMemo(() => selectPlanAroundPlaces(hero, places), [hero, places]);
  const restaurants = useMemo(() => places.filter((place) => place.kind === "restaurant"), [places]);
  const nearbyContextPlaces = useMemo(
    () =>
      [...places]
        .filter((place) => place.kind === "restaurant" || place.kind === "bar" || place.kind === "venue" || place.kind === "park")
        .sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99) || b.popularityScore - a.popularityScore)
        .slice(0, 10),
    [places]
  );
  const balancedPopularPlaces = useMemo(
    () =>
      [...places]
        .sort((a, b) => b.upcomingCount * 8 + b.popularityScore - (a.upcomingCount * 8 + a.popularityScore))
        .slice(0, 8),
    [places]
  );
  const beforeAfterPlaces = useMemo(
    () =>
      restaurants
        .filter((place) => place.price === "$" || /happy hour|lunch|breakfast|brunch|cheap|taco|burger|sandwich/i.test(`${place.openFor} ${place.notes} ${place.vibe}`))
        .slice(0, 4),
    [restaurants]
  );
  const articleCards = useMemo(() => articles.slice(0, 3), [articles]);

  return (
    <motion.section {...viewMotion} className="landing-page space-y-14 md:space-y-20">
      <RightNowHero
        events={spotlightEvents}
        todayEventCount={todayEventCount}
        weather={weather}
        savedEvents={savedEvents}
        onSaveEvent={onSave}
        onOpenDetails={onOpenDetails}
      />
      <TonightEventStrip events={spotlightEvents} savedEvents={savedEvents} onSaveEvent={onSave} onOpenDetails={onOpenDetails} />
      <PlanAroundThis event={hero} places={planAroundPlaces} savedPlaces={savedPlaces} onSavePlace={onSavePlace} onOpenPlace={onOpenPlace} onOpenDetails={onOpenDetails} />
      <CategoryCarousel events={events} places={places} />
      <PopularGrid places={balancedPopularPlaces} events={spotlightEvents} savedPlaces={savedPlaces} savedEvents={savedEvents} onSavePlace={onSavePlace} onSaveEvent={onSave} onOpenPlace={onOpenPlace} onOpenDetails={onOpenDetails} />
      <NearbyContextStrip places={nearbyContextPlaces} savedPlaces={savedPlaces} onSavePlace={onSavePlace} onOpenPlace={onOpenPlace} />
      <BeforeAfterSection places={beforeAfterPlaces} savedPlaces={savedPlaces} onSavePlace={onSavePlace} onOpenPlace={onOpenPlace} />
      <GradientCtaBanner />
      <FeaturePanel places={planAroundPlaces} event={hero} onOpenPlace={onOpenPlace} onOpenDetails={onOpenDetails} />
      <EditorialCards articles={articleCards} places={balancedPopularPlaces} />
      <LandingFooter />
    </motion.section>
  );
}

function NarrativeChapter({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <section className="pt-2">
      <div className="inline-flex rounded-full border border-white/28 bg-white/28 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-bone/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-xl">
        {eyebrow}
      </div>
      <h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-[0.9] tracking-[-0.04em] text-balance md:text-7xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-bone/72 md:text-lg">{copy}</p>
    </section>
  );
}

function forecastLine(weather: WeatherState | null, now = new Date()) {
  if (!weather) return "Forecast loading.";
  const hour = now.getHours();
  const timeOfDay = hour < 11 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const condition = weather.label === "clear" ? "sunny" : weather.label;
  const intro = `Today's forecast is ${weather.temperature}° and ${condition}.`;
  const rainy = weather.precipitationChance >= 65 || (weather.code >= 61 && weather.code <= 67) || (weather.code >= 80 && weather.code <= 82);
  const lightRain = weather.precipitationChance >= 35 || (weather.code >= 51 && weather.code <= 57);
  const stormy = weather.code >= 95;
  const windy = weather.windSpeed >= 18;
  const cloudy = [2, 3, 45, 48].includes(weather.code);

  if (stormy) return `${intro} Probably an indoor day.`;
  if (rainy) return `${intro} Alamo Draft House kind of day.`;
  if (lightRain) return `${intro} Maybe rain, maybe not.`;
  if (windy) return `${intro} Patio or Barton?`;
  if (cloudy) return `${intro} Chill day, enjoy.`;
  if (weather.temperature >= 90 && timeOfDay === "afternoon") return `${intro} Perfect for Barton Springs.`;
  if (weather.temperature >= 90 && timeOfDay === "evening") return `${intro} Patios weather.`;
  if (weather.temperature < 58 && timeOfDay === "morning") return `${intro} Coffee sounds nice.`;
  if (weather.temperature < 58 && timeOfDay === "evening") return `${intro} Indoor concerts?`;
  if (weather.temperature >= 58 && weather.temperature <= 82 && timeOfDay === "morning") return `${intro} Coffee, walk, chill.`;
  if (weather.temperature >= 58 && weather.temperature <= 88) return `${intro} Zilker or patio?`;
  return `${intro} Pick another a spot, keep it chill.`;
}

function selectPlanAroundPlaces(event: EventItem | undefined, places: UnifiedPlace[]) {
  const candidates = places.filter((place) => place.kind === "restaurant" || place.kind === "bar");
  if (!event) return candidates.sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 10);

  const eventPlace = places.find((place) => place.source === "cactus" && place.sourceId === event.venueId) ?? places.find((place) => place.upcomingEventIds.includes(event.id));
  const origin = eventPlace?.latitude && eventPlace.longitude ? { latitude: eventPlace.latitude, longitude: eventPlace.longitude } : undefined;
  const scored = candidates.map((place) => {
    const sameArea = place.area === event.area;
    const maybeOpen = isOpenLikely(place);
    const distanceFromEvent =
      origin && place.latitude && place.longitude ? distanceMiles(origin, { latitude: place.latitude, longitude: place.longitude }) : undefined;
    const score =
      (maybeOpen ? 1000 : 0) +
      (sameArea ? 320 : 0) +
      (typeof distanceFromEvent === "number" ? Math.max(0, 260 - distanceFromEvent * 80) : 0) +
      place.popularityScore;
    return { place, distanceFromEvent, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || (a.distanceFromEvent ?? 99) - (b.distanceFromEvent ?? 99))
    .map((item) => item.place)
    .slice(0, 10);
}

function isOpenLikely(place: UnifiedPlace) {
  const text = `${place.hours ?? ""} ${place.openFor ?? ""}`.toLowerCase();
  if (/temporarily closed|permanently closed|closed now/.test(text)) return false;
  if (/late|night|dinner|happy hour|lunch|brunch|breakfast|coffee|open/.test(text)) return true;
  return Boolean(place.hours || place.openFor);
}

function RightNowHero({
  events,
  todayEventCount,
  weather,
  savedEvents,
  onSaveEvent,
  onOpenDetails,
}: {
  events: EventItem[];
  todayEventCount: number;
  weather: WeatherState | null;
  savedEvents: string[];
  onSaveEvent: (id: string) => void;
  onOpenDetails: (event: EventItem) => void;
}) {
  const event = events[0];
  const secondaryEvent = events[1];
  const chips = [
    { label: "Tonight", href: "/explore?date=Today" },
    { label: "Live music", href: "/explore?vibe=Live+Music" },
    { label: "Free", href: "/explore?vibe=Free" },
    { label: "Date night", href: "/explore?vibe=Date+Night" }
  ];
  return (
    <section className="landing-hero relative mx-auto w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.45rem] p-4 sm:max-w-full md:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-70 [background-image:radial-gradient(circle_at_14%_18%,rgba(255,255,255,0.60),transparent_15rem),radial-gradient(circle_at_82%_20%,rgba(48,209,88,0.22),transparent_17rem),linear-gradient(135deg,rgba(255,255,255,0.22),rgba(255,255,255,0.04))]" />
      <div className="relative z-10 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(420px,0.9fr)] lg:items-center">
        <div className="min-w-0 py-1 md:py-4 lg:py-5">
          <div className="mb-4 flex w-full max-w-full items-start gap-2 rounded-[1.15rem] border border-emerald-950/12 bg-[#f7fff3]/95 px-3 py-2 text-[11px] font-black leading-4 text-[#062f22] shadow-[0_10px_28px_rgba(9,32,20,0.10),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl sm:max-w-xl sm:text-sm sm:leading-6">
            <CloudSun className="mt-0.5 h-4 w-4 shrink-0 text-[#1f7a4d]" />
            <p className="min-w-0 whitespace-normal text-pretty">{forecastLine(weather)}</p>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cactus">Your ultimate ATX guide</p>
          <h1 className="mt-3 max-w-full text-balance font-display text-[2.75rem] font-black leading-[0.94] text-emerald-950 sm:max-w-[12ch] sm:text-[4.2rem] md:text-[5rem] lg:text-[5.15rem]">
            Go explore Austin today.
          </h1>
          <LandingSearchBox />
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link className="inline-flex min-h-9 items-center rounded-full border border-emerald-950/10 bg-white/74 px-3 text-xs font-black text-[#062f22] shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] transition-transform transition-colors hover:-translate-y-0.5 hover:bg-white active:scale-[0.96]" href={chip.href} key={chip.label}>
                {chip.label}
              </Link>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-950 px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(6,47,34,0.24)] transition-transform hover:-translate-y-0.5 active:scale-[0.96]" href="/explore?date=Today">
              See what&apos;s on tonight <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-full border border-emerald-950/10 bg-white/38 px-5 text-sm font-black text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] transition-transform transition-colors hover:-translate-y-0.5 hover:bg-white/64 active:scale-[0.96]" href="/plan">
              Build a plan
            </Link>
          </div>
        </div>
        <div className="relative grid min-w-0 gap-4 lg:min-h-[440px] lg:content-center">
          <div className="inline-flex w-fit items-center gap-2 justify-self-start rounded-full bg-white/76 px-3 py-2 text-xs font-black text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
            <span className="text-emerald-950/72">Events today</span>
            <span className="shrink-0 tabular-nums text-emerald-950">{todayEventCount.toLocaleString("en-US")}</span>
          </div>
          {event ? (
            <article className="glass-card glass-card-hover relative w-full max-w-full rounded-[1.6rem] p-3 text-ink lg:w-[86%]">
              <div className="relative h-56 overflow-hidden rounded-[1.2rem] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.10)] sm:h-64">
                <SafeImage className="object-cover" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="420px" />
                <FavoriteButton active={savedEvents.includes(event.id)} onClick={() => onSaveEvent(event.id)} className="absolute right-3 top-3" />
              </div>
              <button className="w-full p-3 text-left" onClick={() => onOpenDetails(event)}>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cactus">{isTonight(event) ? "Tonight" : dayLabel(event)}</p>
                <h3 className="mt-1 line-clamp-2 text-2xl font-black leading-tight">{event.title}</h3>
                <p className="mt-3 flex items-center gap-2 text-xs font-bold text-ink/66">
                  <CalendarDays className="h-4 w-4 text-cactus" /> {formatEventTime(event)} · {event.venueName}
                </p>
              </button>
            </article>
          ) : null}
          {secondaryEvent ? (
            <article className="glass-card glass-card-hover relative w-full max-w-full rounded-[1.35rem] p-3 text-left text-ink sm:grid sm:grid-cols-[150px_1fr] sm:items-center sm:gap-3 xl:absolute xl:bottom-4 xl:right-0 xl:w-[58%] xl:grid-cols-1 xl:gap-0">
              <div className="relative h-32 overflow-hidden rounded-[1rem] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.10)] sm:h-28 lg:h-32">
                <button className="absolute inset-0 z-10" onClick={() => onOpenDetails(secondaryEvent)} aria-label={`Open ${secondaryEvent.title}`} />
                <SafeImage className="object-cover" src={secondaryEvent.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="260px" />
                <FavoriteButton active={savedEvents.includes(secondaryEvent.id)} onClick={() => onSaveEvent(secondaryEvent.id)} className="absolute right-2 top-2 z-20" />
              </div>
              <button className="w-full text-left" onClick={() => onOpenDetails(secondaryEvent)}>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 sm:mt-0 xl:mt-3">{isTonight(secondaryEvent) ? "Also tonight" : dayLabel(secondaryEvent)}</p>
                <h3 className="mt-1 line-clamp-2 text-lg font-black leading-tight">{secondaryEvent.title}</h3>
              </button>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LandingSearchBox() {
  return (
    <form className="mt-5 flex w-full max-w-full items-center gap-2 rounded-full border border-emerald-950/8 bg-white/72 p-2 shadow-[0_14px_38px_rgba(9,17,13,0.10)] backdrop-blur-xl sm:max-w-2xl" action="/explore">
      <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-cactus transition-transform active:scale-[0.96]" type="submit" aria-label="Search">
        <Search className="h-5 w-5" />
      </button>
      <input className="min-w-0 flex-1 bg-transparent text-sm font-bold text-emerald-950 outline-none placeholder:text-emerald-950/38" name="q" placeholder="Search live music, comedy, food, patios..." />
      <button className="hidden min-h-10 shrink-0 rounded-full bg-neon px-5 text-sm font-black text-emerald-950 shadow-[0_10px_24px_rgba(48,209,88,0.26)] transition-transform hover:-translate-y-0.5 active:scale-[0.96] sm:block" type="submit">
        Search
      </button>
    </form>
  );
}

function LandingPillButton({ href, icon: Icon, children }: { href: string; icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <Link className="inline-flex items-center gap-2 rounded-full bg-white/58 px-3 py-2 text-xs font-black text-ink shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white" href={href}>
      <Icon className="h-4 w-4 text-neon" />
      {children}
    </Link>
  );
}

function TonightEventStrip({ events, savedEvents, onSaveEvent, onOpenDetails }: { events: EventItem[]; savedEvents: string[]; onSaveEvent: (id: string) => void; onOpenDetails: (event: EventItem) => void }) {
  if (!events.length) return null;
  return (
    <section>
      <LandingSectionHeader eyebrow="Popular today" title="Here's what's happening today." />
      <div>
        <FullBleedRail snap={false}>
          {events.map((event) => (
            <div className="w-[78vw] shrink-0 sm:w-[340px]" key={event.id}>
              <EventPromoCard event={event} saved={savedEvents.includes(event.id)} onFavorite={onSaveEvent} onOpen={onOpenDetails} />
            </div>
          ))}
        </FullBleedRail>
      </div>
    </section>
  );
}

function PlanAroundThis({ event, places, savedPlaces, onSavePlace, onOpenPlace, onOpenDetails }: { event?: EventItem; places: UnifiedPlace[]; savedPlaces: string[]; onSavePlace: (id: string) => void; onOpenPlace: (place: UnifiedPlace) => void; onOpenDetails: (event: EventItem) => void }) {
  if (!event && !places.length) return null;
  return (
    <section className="landing-card glass-card grid gap-5 rounded-[2rem] p-5 text-ink lg:grid-cols-[0.9fr_1.1fr] lg:p-6">
      <div className="flex flex-col justify-between gap-5 rounded-[1.55rem] bg-emerald-950 p-5 text-white shadow-[0_18px_48px_rgba(9,17,13,0.22)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">Plan around this</p>
          <h2 className="mt-3 text-3xl font-black leading-[0.98] tracking-[-0.04em] md:text-5xl">{event ? event.title : "Start with the thing worth leaving for."}</h2>
          <p className="mt-4 text-sm font-bold leading-6 text-white/74">{event ? `${formatEventTime(event)} at ${event.venueName}. Add an easy stop nearby so the night does not feel like logistics.` : "Pick the anchor first, then let food and drinks become the easy supporting cast."}</p>
        </div>
        {event ? (
          <button className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-emerald-950 transition hover:-translate-y-0.5" onClick={() => onOpenDetails(event)}>
            Open event <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {places.slice(0, 3).map((place, index) => (
          <MarketplaceCard key={place.id} place={place} saved={savedPlaces.includes(place.id)} rank={index + 1} onFavorite={onSavePlace} onOpen={onOpenPlace} compact />
        ))}
      </div>
    </section>
  );
}

function NearbyContextStrip({ places, savedPlaces, onSavePlace, onOpenPlace }: { places: UnifiedPlace[]; savedPlaces: string[]; onSavePlace: (id: string) => void; onOpenPlace: (place: UnifiedPlace) => void }) {
  if (!places.length) return null;
  return (
    <section>
      <LandingSectionHeader eyebrow="Before, after, or nearby" title="Food, bars, rooms, and easy stops." />
      <div>
        <FullBleedRail>
          {places.map((place, index) => (
            <div className="w-[74vw] shrink-0 snap-start sm:w-[280px]" key={place.id}>
              <MarketplaceCard place={place} saved={savedPlaces.includes(place.id)} rank={index + 1} onFavorite={onSavePlace} onOpen={onOpenPlace} />
            </div>
          ))}
        </FullBleedRail>
      </div>
    </section>
  );
}

function BrandPillRail({ restaurantCount, eventCount, articleCount }: { restaurantCount: number; eventCount: number; articleCount: number }) {
  const items = [
    { label: "Cactus events", value: `${eventCount} listings`, icon: CalendarDays },
    { label: "ATX Eats", value: `${restaurantCount} spots`, icon: Utensils },
    { label: "Eater guides", value: `${articleCount} maps`, icon: BookOpen },
    { label: "Local plans", value: "Saved + nearby", icon: Heart }
  ];
  return (
    <section className="flex flex-wrap justify-center gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div className="inline-flex items-center gap-3 rounded-full border border-white/50 bg-white/62 px-4 py-3 text-ink shadow-soft backdrop-blur-xl" key={item.label}>
            <Icon className="h-4 w-4 text-cactus" />
            <span className="text-sm font-black">{item.label}</span>
            <span className="text-xs font-bold text-ink/62">{item.value}</span>
          </div>
        );
      })}
    </section>
  );
}

function CategoryCarousel({ events, places }: { events: EventItem[]; places: UnifiedPlace[] }) {
  const foodCount = places.filter((place) => place.kind === "restaurant").length;
  const items = [
    ...categoryLinks.map((category) => ({
      label: category.label,
      href: `/explore?${new URLSearchParams(category.vibe ? { vibe: category.vibe } : category.area ? { area: category.area } : {}).toString()}`,
      icon: category.icon,
      count: categoryEventCount(events, category)
    })),
    { label: "Restaurants", href: "/places", icon: Utensils, count: foodCount }
  ];
  return (
    <section>
      <LandingSectionHeader eyebrow="Categories" title="Browse by your energy." />
      <FullBleedRail snap={false}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link className="category-tile group min-w-[136px] rounded-[1.5rem] p-4 text-center text-ink glass-card" href={item.href} key={item.label}>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-cactus transition duration-300 ease-out group-hover:bg-neon group-hover:text-emerald-950">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-black">{item.label}</p>
              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-ink/62">{item.count.toLocaleString("en-US")}</p>
            </Link>
          );
        })}
      </FullBleedRail>
    </section>
  );
}

function PopularGrid({
  places,
  events,
  savedPlaces,
  savedEvents,
  onSavePlace,
  onSaveEvent,
  onOpenPlace,
  onOpenDetails
}: {
  places: UnifiedPlace[];
  events: EventItem[];
  savedPlaces: string[];
  savedEvents: string[];
  onSavePlace: (id: string) => void;
  onSaveEvent: (id: string) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
  onOpenDetails: (event: EventItem) => void;
}) {
  return (
    <section>
      <LandingSectionHeader eyebrow="Popular" title="What Austin keeps choosing tonight." />
      {events.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {events.slice(0, 3).map((event) => (
            <EventPromoCard key={event.id} event={event} saved={savedEvents.includes(event.id)} onFavorite={onSaveEvent} onOpen={onOpenDetails} />
          ))}
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {places.slice(0, 4).map((place, index) => (
          <MarketplaceCard key={place.id} place={place} saved={savedPlaces.includes(place.id)} rank={index + 1} onFavorite={onSavePlace} onOpen={onOpenPlace} compact />
        ))}
      </div>
    </section>
  );
}

function BeforeAfterSection({ places, savedPlaces, onSavePlace, onOpenPlace }: { places: UnifiedPlace[]; savedPlaces: string[]; onSavePlace: (id: string) => void; onOpenPlace: (place: UnifiedPlace) => void }) {
  if (!places.length) return null;
  return (
    <section>
      <LandingSectionHeader eyebrow="Before + after" title="Easy food moves around the main event." />
      <div className="grid gap-4 lg:grid-cols-2">
        {places.slice(0, 4).map((place, index) => (
          <article className="landing-card glass-card glass-card-hover grid gap-3 rounded-[1.75rem] p-3 text-ink md:grid-cols-[160px_1fr]" key={place.id}>
            <button className="relative min-h-44 overflow-hidden rounded-[1.35rem]" onClick={() => onOpenPlace(place)}>
              <SafeImage className="object-cover" src={place.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="180px" />
              <span className="absolute left-3 top-3 rounded-full bg-neon px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-950">{index % 2 ? "After" : "Before"}</span>
            </button>
            <div className="flex flex-col justify-between gap-4 p-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cactus">{index % 2 ? "Post-show stop" : "Pre-event bite"}</p>
                <button className="mt-2 text-left text-2xl font-black leading-tight hover:text-cactus" onClick={() => onOpenPlace(place)}>{place.name}</button>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/68">{place.price ? `${place.price} · ` : ""}{place.vibe}. {place.mustTry || "Save it for a quick plan."}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <RatingMeta place={place} />
                <FavoriteButton active={savedPlaces.includes(place.id)} onClick={() => onSavePlace(place.id)} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GradientCtaBanner() {
  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden rounded-none py-16 text-center text-white shadow-[0_24px_80px_rgba(9,17,13,0.22)] md:rounded-[2rem]">
      <SafeImage className="object-cover" src="https://upload.wikimedia.org/wikipedia/commons/7/70/Austin-skyline-from-zilker-park.jpg" fallbackSrc={fallbackImage} alt="" fill sizes="100vw" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.20),rgba(0,0,0,0.72)),radial-gradient(circle_at_20%_18%,rgba(48,209,88,0.30),transparent_22rem)]" />
      <div className="media-copy relative mx-auto max-w-4xl px-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/82">One search, whole night</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-4xl font-black leading-[0.95] tracking-[-0.04em] md:text-6xl">Know what&apos;s worth leaving for.</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-6 text-white/86">Cactus Club leads with the event, then folds in the food, bar, or patio that makes the night feel effortless.</p>
        <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-emerald-950 shadow-[0_18px_40px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5" href="/explore">
          Search Austin now <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { label: "Pick the spark", copy: "Start with tonight, a room, a show, comedy, or a neighborhood.", icon: Search },
    { label: "Save the anchor", copy: "Heart events, venues, restaurants, or bars without managing a dashboard.", icon: Heart },
    { label: "Add the stop", copy: "Layer in the bite, drink, or nearby place that makes the plan complete.", icon: Bike }
  ];
  return (
    <section>
      <LandingSectionHeader eyebrow="How it works" title="Three steps, no overthinking." />
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article className="landing-card rounded-[1.75rem] bg-white/74 p-5 text-ink shadow-soft backdrop-blur-xl" key={step.label}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-cactus"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/62">Step {index + 1}</span>
              </div>
              <h3 className="mt-5 text-2xl font-black tracking-[-0.03em]">{step.label}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink/68">{step.copy}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FeaturePanel({ places, event, onOpenPlace, onOpenDetails }: { places: UnifiedPlace[]; event?: EventItem; onOpenPlace: (place: UnifiedPlace) => void; onOpenDetails: (event: EventItem) => void }) {
  const primary = places[0];
  const secondary = places[1];
  return (
    <section className="landing-card glass-card grid gap-6 rounded-[2rem] p-5 text-ink lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cactus">Feature panel</p>
        <h2 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.045em] md:text-5xl">Plan around the thing worth leaving for.</h2>
        <p className="mt-4 text-sm font-semibold leading-7 text-ink/68">Use events as the anchor, then let restaurants, bars, patios, and classics snap into place around the night.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-full bg-emerald-950 px-5 py-3 text-sm font-black text-white" href="/explore?date=Today">Browse tonight</Link>
          <Link className="rounded-full border border-ink/10 px-5 py-3 text-sm font-black text-ink" href="/plan">Open saved plan</Link>
        </div>
      </div>
      <div className="relative min-h-[420px]">
        {primary ? (
          <button className="glass-card-hover absolute left-0 top-0 h-[310px] w-[68%] overflow-hidden rounded-[1.75rem]" onClick={() => onOpenPlace(primary)}>
            <SafeImage className="object-cover" src={primary.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="420px" />
          </button>
        ) : null}
        {event ? (
          <button className="absolute bottom-0 right-0 w-[58%] rounded-[1.65rem] bg-emerald-950 p-4 text-left text-white shadow-[0_24px_70px_rgba(9,17,13,0.24)]" onClick={() => onOpenDetails(event)}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-neon">Tonight</p>
            <h3 className="mt-2 line-clamp-3 text-2xl font-black leading-tight">{event.title}</h3>
            <p className="mt-3 text-xs font-bold text-white/76">{formatEventTime(event)}</p>
          </button>
        ) : secondary ? (
          <button className="absolute bottom-0 right-0 w-[58%] rounded-[1.65rem] bg-emerald-950 p-4 text-left text-white" onClick={() => onOpenPlace(secondary)}>{secondary.name}</button>
        ) : null}
      </div>
    </section>
  );
}

function EditorialCards({ articles, places }: { articles: AtxArticle[]; places: UnifiedPlace[] }) {
  if (!articles.length) return null;
  return (
    <section>
      <LandingSectionHeader eyebrow="Austin guides" title="Keep a few ideas for later." tone="light" />
      <div className="grid gap-4 md:grid-cols-3">
        {articles.map((article, index) => {
          const place = places[index % Math.max(places.length, 1)];
          return (
            <a className="landing-card glass-card glass-card-hover rounded-[1.65rem] p-3 text-ink" href={article.url} target="_blank" rel="noreferrer" key={article.slug}>
              <div className="relative h-44 overflow-hidden rounded-[1.25rem]">
                <SafeImage className="object-cover" src={place?.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="360px" />
              </div>
              <div className="p-2">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cactus">{article.tags?.[0] ?? "Guide"}</p>
                <h3 className="mt-2 line-clamp-2 text-xl font-black leading-tight">{article.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink/66">{article.place_count ?? "Local"} places to keep in your Austin rotation.</p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="rounded-[2rem] bg-emerald-950 p-6 text-white shadow-[0_24px_80px_rgba(9,17,13,0.22)] md:p-8">
      <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-black"><CalendarDays className="h-4 w-4 text-neon" /> Cactus Club</div>
          <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-white/74">A friendly Austin marketplace for events, food, bars, rooms, patios, saved plans, and the next easy yes.</p>
        </div>
        <FooterLinks title="Quick links" links={[["Explore", "/explore"], ["Places", "/places"], ["Plan", "/plan"]]} />
        <FooterLinks title="Support" links={[["Today", "/today"], ["Nearby", "/explore?date=Nearby"], ["Popular", "/explore?vibe=Popular"]]} />
      </div>
      <div className="mt-8 border-t border-white/10 pt-4 text-xs font-bold text-white/64">© 2026 Cactus Club. Built for local decisions.</div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/64">{title}</p>
      <div className="mt-3 grid gap-2">
        {links.map(([label, href]) => <Link className="text-sm font-bold text-white/70 transition hover:text-white" href={href} key={href}>{label}</Link>)}
      </div>
    </div>
  );
}

function LandingSectionHeader({ eyebrow, title, tone = "dark" }: { eyebrow: string; title: string; actionHref?: string; action?: string; centered?: boolean; tone?: "dark" | "light" }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 text-left">
      <div>
        <p className={cn("text-xs font-black uppercase tracking-[0.18em]", tone === "light" ? "text-white/70" : "text-emerald-950/68")}>{eyebrow}</p>
        <h2 className={cn("mt-2 text-3xl font-black leading-none tracking-[-0.035em] md:text-5xl", tone === "light" ? "text-white" : "text-emerald-950")}>{title}</h2>
      </div>
    </div>
  );
}

function MarketplaceCard({ place, saved, onFavorite, onOpen, rank, compact = false }: { place: UnifiedPlace; saved: boolean; onFavorite: (id: string) => void; onOpen: (place: UnifiedPlace) => void; rank?: number; compact?: boolean }) {
  return (
    <article className="landing-card glass-card glass-card-hover rounded-[1.65rem] p-3 text-ink">
      <div className={cn("relative overflow-hidden rounded-[1.25rem]", compact ? "h-44" : "h-52")}>
        <button className="absolute inset-0 z-10" onClick={() => onOpen(place)} aria-label={`Open ${place.name}`} />
        <SafeImage className="object-cover transition duration-700 hover:scale-105" src={place.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="320px" />
        {rank ? <span className="absolute left-3 top-3 z-20 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-black text-ink shadow-soft">#{rank}</span> : null}
        <FavoriteButton active={saved} onClick={() => onFavorite(place.id)} className="absolute right-3 top-3 z-20" />
      </div>
      <button className="w-full p-4 text-left" onClick={() => onOpen(place)}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-lg font-black leading-tight">{place.name}</h3>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-cactus">{place.price ?? "$$"}</span>
        </div>
        <p className="mt-2 line-clamp-1 text-xs font-bold text-ink/66">{place.vibe}</p>
        <RatingMeta place={place} />
      </button>
    </article>
  );
}

function EventPromoCard({ event, saved, onFavorite, onOpen }: { event: EventItem; saved: boolean; onFavorite: (id: string) => void; onOpen: (event: EventItem) => void }) {
  return (
    <article className="landing-card glass-card glass-card-hover rounded-[1.65rem] p-3 text-ink">
      <div className="relative h-48 overflow-hidden rounded-[1.25rem]">
        <button className="absolute inset-0 z-10" onClick={() => onOpen(event)} aria-label={`Open ${event.title}`} />
        <SafeImage className="object-cover" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="360px" />
        <FavoriteButton active={saved} onClick={() => onFavorite(event.id)} className="absolute right-3 top-3 z-20" />
      </div>
      <button className="w-full p-4 text-left" onClick={() => onOpen(event)}>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cactus">{dayLabel(event)}</p>
        <h3 className="mt-2 line-clamp-2 text-lg font-black leading-tight">{event.title}</h3>
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-ink/66"><CalendarDays className="h-4 w-4 text-cactus" /> {formatEventTime(event)}</div>
      </button>
    </article>
  );
}

function FavoriteButton({ active, onClick, className }: { active: boolean; onClick: () => void; className?: string }) {
  return (
    <button className={cn("grid h-10 w-10 place-items-center rounded-full bg-white/88 text-ink shadow-soft backdrop-blur transition hover:scale-105", active && "bg-neon text-emerald-950", className)} onClick={(event) => { event.stopPropagation(); onClick(); }} aria-label={active ? "Remove favorite" : "Add favorite"}>
      <Heart className={cn("h-5 w-5", active && "fill-current")} />
    </button>
  );
}

function RatingMeta({ place }: { place: UnifiedPlace }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-ink/66">
      <span className="inline-flex items-center gap-1 text-ink/70"><Star className="h-4 w-4 fill-[#f5a83c] text-[#f5a83c]" /> {ratingForPlace(place)}</span>
      <span>•</span>
      <span>{formatDistance(place.distanceMiles) ?? prepTimeForPlace(place)}</span>
      <span>•</span>
      <span>{place.area === "Burbs" ? "Suburbs" : place.area}</span>
    </div>
  );
}

function ratingForPlace(place: UnifiedPlace) {
  return (4.4 + Math.min(0.5, place.popularityScore / 240)).toFixed(1);
}

function prepTimeForPlace(place: UnifiedPlace) {
  if (place.kind === "bar") return "20-35 min";
  if (place.price === "$") return "15-25 min";
  return "25-45 min";
}

function HomeCommandPanel({
  savedCount,
  visitedCount,
  foodCount,
  eventCount,
  weather
}: {
  savedCount: number;
  visitedCount: number;
  foodCount: number;
  eventCount: number;
  weather: WeatherState | null;
}) {
  return (
    <section className="glass-panel relative overflow-hidden rounded-[1.65rem] p-5 md:p-8">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-neon/18 blur-3xl" />
      <div className="relative grid gap-7 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <p className="inline-flex rounded-full border border-white/28 bg-white/24 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-bone/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] backdrop-blur-xl">
            {timeGreeting()}
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-black leading-[0.94] tracking-[-0.04em] text-balance md:text-7xl">
            Your Austin list, live.
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-bone/68 md:text-lg">
            Restaurants, events, saved places, and tonight’s easy moves are now in one calm workspace.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Food spots" value={foodCount.toLocaleString("en-US")} />
          <MetricTile label="Upcoming" value={eventCount.toLocaleString("en-US")} />
          <MetricTile label="Saved" value={savedCount.toLocaleString("en-US")} />
          <MetricTile label={weather ? weather.label : "Weather"} value={weather ? `${weather.temperature}°` : "Ready"} />
          {visitedCount ? <div className="col-span-2"><MetricTile label="Visited" value={visitedCount.toLocaleString("en-US")} /></div> : null}
        </div>
      </div>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-white/18 bg-white/14 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.30)] backdrop-blur-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bone/44">{label}</p>
      <p className="mt-2 text-2xl font-black leading-none tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function NarrativeSkeleton() {
  return (
    <section className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => <div className="h-56 animate-pulse rounded-[1.25rem] bg-white/8" key={item} />)}
    </section>
  );
}

function FullBleedRail({ children, snap = true }: { children: React.ReactNode; snap?: boolean }) {
  return (
    <div className="container-bleed-rail relative overflow-visible">
      <div className={cn("-mx-3 flex gap-3 overflow-x-auto px-3 py-6 hide-scrollbar", snap && "snap-x")}>
        {children}
      </div>
    </div>
  );
}

function CategoryJumpGrid({ events }: { events: EventItem[] }) {
  return (
    <section>
      <SectionHeader kicker="Browse by mood" title="Pick a lane." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {categoryLinks.map((category) => {
          const Icon = category.icon;
          const count = categoryEventCount(events, category);
          const params = new URLSearchParams();
          if (category.vibe) params.set("vibe", category.vibe);
          if (category.area) params.set("area", category.area);
          return (
            <Link
              className="glass-panel group flex min-h-[132px] flex-col items-center justify-center rounded-[1.35rem] p-4 text-center transition duration-300 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/36"
              href={`/explore?${params.toString()}`}
              key={category.label}
            >
              <AnimatedCategoryIcon label={category.label} icon={Icon} />
              <h3 className="mt-3 text-base font-black leading-tight">{category.label}</h3>
              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-bone/45 group-hover:text-bone/66">
                ({count.toLocaleString("en-US")})
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AnimatedCategoryIcon({ label, icon: Icon }: { label: string; icon: typeof Music }) {
  const animationData = useMemo(() => makeCategoryLottie(categoryAnimationThemes[label] ?? categoryAnimationThemes["Live Music"]), [label]);
  return (
    <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-black/22 ring-1 ring-white/10 transition group-hover:bg-black/36 group-hover:ring-neon/35">
      <Lottie
        animationData={animationData}
        autoplay
        loop
        className="absolute inset-0 h-full w-full opacity-90"
        aria-hidden
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      />
      <Icon className="relative z-10 h-6 w-6 text-bone drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] transition group-hover:scale-110 group-hover:text-neon" />
    </div>
  );
}

function InlineLottieIcon({ label, icon: Icon }: { label: string; icon: typeof Music }) {
  const animationData = useMemo(() => makeCategoryLottie(categoryAnimationThemes[label] ?? categoryAnimationThemes["Live Music"]), [label]);
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-visible">
      <Lottie
        animationData={animationData}
        autoplay
        loop
        className="absolute inset-[-8px] h-[52px] w-[52px] opacity-80"
        aria-hidden
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      />
      <Icon className="relative z-10 h-5 w-5 text-neon drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]" />
    </span>
  );
}

function makeCategoryLottie(theme: { primary: string; secondary: string; speed: number }) {
  const primary = hexToLottieColor(theme.primary);
  const secondary = hexToLottieColor(theme.secondary);
  const outPoint = Math.round(90 / theme.speed);

  return {
    v: "5.10.2",
    fr: 30,
    ip: 0,
    op: outPoint,
    w: 96,
    h: 96,
    nm: "category lane",
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "halo",
        sr: 1,
        ks: {
          o: { a: 1, k: [{ t: 0, s: [18] }, { t: 45, s: [62] }, { t: 90, s: [18] }] },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [48, 48, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 1, k: [{ t: 0, s: [78, 78, 100] }, { t: outPoint / 2, s: [118, 118, 100] }, { t: outPoint, s: [78, 78, 100] }] }
        },
        shapes: [
          { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [56, 56] }, nm: "halo ellipse" },
          { ty: "st", c: { a: 0, k: secondary }, o: { a: 0, k: 100 }, w: { a: 0, k: 5 }, lc: 2, lj: 2, nm: "halo stroke" },
          { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
        ],
        ip: 0,
        op: outPoint,
        st: 0,
        bm: 0
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: "mark",
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 1, k: [{ t: 0, s: [0] }, { t: outPoint, s: [360] }] },
          p: { a: 0, k: [48, 48, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] }
        },
        shapes: [
          { ty: "el", p: { a: 0, k: [0, -26] }, s: { a: 0, k: [8, 8] }, nm: "dot one" },
          { ty: "fl", c: { a: 0, k: primary }, o: { a: 0, k: 90 }, r: 1, nm: "dot fill one" },
          { ty: "el", p: { a: 0, k: [20, 18] }, s: { a: 0, k: [6, 6] }, nm: "dot two" },
          { ty: "fl", c: { a: 0, k: secondary }, o: { a: 0, k: 82 }, r: 1, nm: "dot fill two" },
          { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
        ],
        ip: 0,
        op: outPoint,
        st: 0,
        bm: 0
      }
    ]
  };
}

function hexToLottieColor(hex: string) {
  const value = hex.replace("#", "");
  const channels = value.length === 3 ? value.split("").map((item) => `${item}${item}`) : [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)];
  return channels.map((channel) => parseInt(channel, 16) / 255).concat(1);
}

function categoryEventCount(events: EventItem[], category: (typeof categoryLinks)[number]) {
  return events.filter((event) => {
    const vibeMatch = category.vibe ? event.vibeTags.includes(category.vibe) : true;
    const areaMatch = category.area ? event.area === category.area : true;
    return vibeMatch && areaMatch;
  }).length;
}

function WeatherPlanSection({ weather, events, savedEvents, onSave, onOpenDetails }: { weather: WeatherState | null; events: EventItem[]; savedEvents: string[]; onSave: (id: string) => void; onOpenDetails: (event: EventItem) => void }) {
  if (!weather && !events.length) return null;
  const patio = weather ? isPatioWeather(weather) : false;
  const rainRisk = weather?.precipitationChance ?? 0;
  const patioScore = weather ? Math.max(12, Math.min(98, patio ? 92 - Math.floor(rainRisk / 4) : weather.temperature < 58 ? 58 - (58 - weather.temperature) : 72 - Math.floor(rainRisk / 2))) : 74;
  const visual = weatherVisual(weather, isNightTime(), patio, rainRisk);
  return (
    <section className="glass-panel overflow-hidden rounded-[1.75rem]">
      <div className="grid gap-4 p-4 md:grid-cols-[340px_1fr] md:p-5">
        <div className={cn("relative overflow-hidden rounded-[1.25rem] border p-5 shadow-[0_20px_70px_rgba(0,0,0,0.34)]", visual.panelClass)}>
          <SafeImage className={cn("object-cover", visual.imageClass)} src={visual.imageUrl} fallbackSrc={fallbackImage} alt={visual.imageAlt} fill sizes="340px" />
          <div className={cn("absolute inset-0", visual.imageOverlayClass)} />
          <div className={cn("absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl", visual.skyGlowClass)} />
          <div className={cn("absolute -bottom-16 left-8 h-36 w-36 rounded-full blur-3xl", visual.groundGlowClass)} />
          <div className={visual.orbClass} />
          {visual.rain ? (
            <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(105deg,transparent_0_44%,rgba(255,255,255,0.52)_45%,transparent_47%)] [background-size:18px_42px]" />
          ) : null}
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn("text-xs font-black uppercase tracking-[0.18em]", visual.eyebrowClass)}>{timeGreeting()}</p>
                <h2 className={cn("mt-2 max-w-[13rem] text-3xl font-black leading-[0.94]", visual.textClass)}>{visual.headline}</h2>
              </div>
            </div>
            {weather ? (
              <div className="mt-8">
                <div className="flex items-end gap-3">
                  <p className={cn("text-7xl font-black leading-none tracking-[-0.04em]", visual.textClass)}>{weather.temperature}°</p>
                  <p className={cn("pb-2 text-sm font-black uppercase tracking-[0.16em]", visual.mutedClass)}>{weather.label}</p>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <WeatherMetric icon={Thermometer} label="Patio" value={`${patioScore}%`} dark={visual.dark} />
                  <WeatherMetric icon={Droplets} label="Rain" value={`${rainRisk}%`} dark={visual.dark} />
                  <WeatherMetric icon={Wind} label="Move" value={patio ? "Open air" : "Room"} dark={visual.dark} />
                </div>
              </div>
            ) : (
              <p className={cn("mt-8 text-sm font-black leading-6", visual.mutedClass)}>Austin forecast loading when available. Picks still work without location.</p>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Weather picks</p>
              <h3 className="mt-1 text-2xl font-black">{patio ? "Patios, parks, easy yeses." : "Rooms worth hiding in."}</h3>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {events.map((event) => (
              <div className="w-[76vw] shrink-0 sm:w-[300px]" key={event.id}>
                <EventCard event={event} size="compact" saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AppleNativeBrief() {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {[
        { label: "Today is the command center", copy: "Food, events, weather, and saved intent appear only when they help the next decision.", icon: Sparkles },
        { label: "Plans are spatial", copy: "Save an anchor, add nearby stops, and keep advanced group tools behind the plan surface.", icon: ListPlus },
        { label: "Austin stays calm", copy: "Curated rows, soft panels, and contextual actions keep the app powerful without dashboard overload.", icon: Compass }
      ].map((item) => {
        const Icon = item.icon;
        return (
          <article className="glass-panel rounded-[1.35rem] p-4" key={item.label}>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/18 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-black leading-tight">{item.label}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-bone/58">{item.copy}</p>
          </article>
        );
      })}
    </section>
  );
}

function OutingRail({
  recommendations,
  savedEvents,
  savedPlaces,
  onSaveEvent,
  onSavePlace,
  onOpenDetails,
  onOpenPlace
}: {
  recommendations: OutingRecommendation[];
  savedEvents: string[];
  savedPlaces: string[];
  onSaveEvent: (id: string) => void;
  onSavePlace: (id: string) => void;
  onOpenDetails: (event: EventItem) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
}) {
  if (!recommendations.length) return null;
  return (
    <section>
      <SectionHeader kicker="Complete moves" title="Anchor + add-ons." />
      <FullBleedRail>
        {recommendations.map((recommendation) => {
          const anchor = recommendation.anchor;
          const eventAnchor = "title" in anchor ? anchor : null;
          const placeAnchor = "name" in anchor && !("title" in anchor) ? anchor : null;
          return (
            <article className="glass-panel flex min-h-[360px] w-[82vw] shrink-0 snap-start flex-col justify-between rounded-[1.65rem] p-4 sm:w-[420px]" key={recommendation.id}>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Austin move</p>
                <button className="mt-2 text-left text-3xl font-black leading-none tracking-[-0.03em] underline-offset-4 transition hover:text-neon hover:underline" onClick={() => eventAnchor ? onOpenDetails(eventAnchor) : placeAnchor ? onOpenPlace(placeAnchor) : undefined}>
                  {eventAnchor ? eventAnchor.title : placeAnchor?.name}
                </button>
                <p className="mt-3 text-sm font-semibold leading-6 text-bone/62">{recommendation.reason}</p>
              </div>
              <div className="mt-5 space-y-3">
                {recommendation.addOns.map((place) => (
                  <button className="flex w-full items-center justify-between gap-3 rounded-[1.1rem] bg-white/14 p-3 text-left transition hover:bg-white/24" key={place.id} onClick={() => onOpenPlace(place)}>
                    <span>
                      <span className="block text-sm font-black">{place.name}</span>
                      <span className="mt-1 block text-xs font-bold text-bone/50">{place.price ? `${place.price} · ` : ""}{place.vibe}</span>
                    </span>
                    <Utensils className="h-4 w-4 shrink-0 text-emerald-100" />
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {eventAnchor ? (
                  <button className={cn("rounded-full px-4 py-2 text-xs font-black transition", savedEvents.includes(eventAnchor.id) ? "bg-neon text-emerald-950" : "bg-white/18 text-bone hover:bg-white/28")} onClick={() => onSaveEvent(eventAnchor.id)}>
                    {savedEvents.includes(eventAnchor.id) ? "Saved anchor" : "Save anchor"}
                  </button>
                ) : null}
                {recommendation.addOns[0] ? (
                  <button className={cn("rounded-full px-4 py-2 text-xs font-black transition", savedPlaces.includes(recommendation.addOns[0].id) ? "bg-neon text-emerald-950" : "bg-white/18 text-bone hover:bg-white/28")} onClick={() => onSavePlace(recommendation.addOns[0].id)}>
                    {savedPlaces.includes(recommendation.addOns[0].id) ? "Food saved" : "Save food"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </FullBleedRail>
    </section>
  );
}

function PlaceRail({
  title,
  kicker,
  places,
  savedPlaces,
  visitedPlaces,
  onSavePlace,
  onOpenPlace
}: {
  title: string;
  kicker: string;
  places: UnifiedPlace[];
  savedPlaces: string[];
  visitedPlaces: string[];
  onSavePlace: (id: string) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
}) {
  if (!places.length) return null;
  return (
    <section>
      <SectionHeader kicker={kicker} title={title} />
      <FullBleedRail>
        {places.map((place) => (
          <div className="w-[76vw] shrink-0 snap-start sm:w-[320px]" key={place.id}>
            <UnifiedPlaceCard
              place={place}
              saved={savedPlaces.includes(place.id)}
              visited={visitedPlaces.includes(place.id)}
              onSave={onSavePlace}
              onVisit={(_id) => undefined}
              onOpen={onOpenPlace}
            />
          </div>
        ))}
      </FullBleedRail>
    </section>
  );
}

function weatherVisual(weather: WeatherState | null, night: boolean, patio: boolean, rainRisk: number) {
  const code = weather?.code ?? 0;
  const rainy = code >= 51 || rainRisk > 35;
  const stormy = code >= 95;
  const cloudy = (code >= 2 && code <= 3) || (code >= 45 && code <= 48);

  if (rainy || stormy) {
    return {
      dark: true,
      rain: true,
      icon: CloudRain,
      headline: stormy ? "Storm mode. Find a room." : "Rain wants a roof.",
      imageUrl: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1200&auto=format&fit=crop",
      imageAlt: "Rain streaks on glass at night",
      imageClass: "opacity-62 saturate-125",
      imageOverlayClass: "bg-[linear-gradient(145deg,rgba(8,12,20,0.88)_0%,rgba(16,24,39,0.70)_42%,rgba(38,50,65,0.82)_100%)]",
      panelClass: "border-emerald-200/12 bg-[radial-gradient(circle_at_18%_10%,rgba(125,211,252,0.24),transparent_14rem),linear-gradient(145deg,#101827_0%,#172033_46%,#263241_100%)] text-bone",
      skyGlowClass: "bg-emerald-200/18",
      groundGlowClass: "bg-violet/18",
      orbClass: "absolute right-8 top-8 h-16 w-16 rounded-full bg-emerald-100/18 blur-sm",
      iconClass: "bg-emerald-100/14 text-emerald-100 ring-1 ring-emerald-100/20",
      textClass: "text-bone",
      mutedClass: "text-bone/62",
      eyebrowClass: "text-emerald-100/64"
    };
  }

  if (night) {
    return {
      dark: true,
      rain: false,
      icon: Moon,
      headline: patio ? "Night air is working." : "Low-lit rooms win.",
      imageUrl: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=1200&auto=format&fit=crop",
      imageAlt: "City lights after dark",
      imageClass: "opacity-64 saturate-125",
      imageOverlayClass: "bg-[linear-gradient(145deg,rgba(8,7,6,0.88)_0%,rgba(17,24,39,0.70)_52%,rgba(33,21,53,0.82)_100%)]",
      panelClass: "border-white/12 bg-[radial-gradient(circle_at_78%_15%,rgba(248,240,223,0.18),transparent_10rem),radial-gradient(circle_at_18%_10%,rgba(110,66,255,0.28),transparent_16rem),linear-gradient(145deg,#080706_0%,#111827_52%,#211535_100%)] text-bone",
      skyGlowClass: "bg-bone/16",
      groundGlowClass: "bg-violet/24",
      orbClass: "absolute right-10 top-9 h-12 w-12 rounded-full bg-bone shadow-[0_0_42px_rgba(248,240,223,0.42)]",
      iconClass: "bg-bone text-ink",
      textClass: "text-bone",
      mutedClass: "text-bone/62",
      eyebrowClass: "text-neon/72"
    };
  }

  if (cloudy) {
    return {
      dark: false,
      rain: false,
      icon: CloudSun,
      headline: patio ? "Soft sky, good plans." : "Cloud cover, easy rooms.",
      imageUrl: "https://images.unsplash.com/photo-1483977399921-6cf94f6fdc3a?q=80&w=1200&auto=format&fit=crop",
      imageAlt: "Cloudy sky over a city street",
      imageClass: "opacity-54 saturate-90",
      imageOverlayClass: "bg-[linear-gradient(145deg,rgba(219,231,229,0.76)_0%,rgba(190,205,201,0.72)_48%,rgba(143,163,159,0.84)_100%)]",
      panelClass: "border-white/16 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.42),transparent_15rem),linear-gradient(145deg,#dbe7e5_0%,#becdc9_48%,#8fa39f_100%)] text-ink",
      skyGlowClass: "bg-white/34",
      groundGlowClass: "bg-cactus/18",
      orbClass: "absolute right-8 top-8 h-16 w-16 rounded-full bg-white/48 blur-md",
      iconClass: "bg-ink text-bone",
      textClass: "text-ink",
      mutedClass: "text-ink/68",
      eyebrowClass: "text-ink/66"
    };
  }

  return {
    dark: false,
    rain: false,
    icon: CloudSun,
    headline: patio ? "Sun says yes." : "Bright day, choose shade.",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "Bright sunny outdoor lawn and trees",
    imageClass: "opacity-56 saturate-125",
    imageOverlayClass: "bg-[linear-gradient(145deg,rgba(248,240,223,0.82)_0%,rgba(247,206,151,0.74)_52%,rgba(215,102,50,0.70)_100%)]",
    panelClass: "border-white/12 bg-[radial-gradient(circle_at_18%_10%,rgba(213,255,95,0.30),transparent_16rem),linear-gradient(145deg,rgba(248,240,223,0.96),rgba(247,206,151,0.86)_52%,rgba(215,102,50,0.68))] text-ink",
    skyGlowClass: "bg-white/28",
    groundGlowClass: "bg-neon/30",
    orbClass: "absolute right-8 top-8 h-16 w-16 rounded-full bg-[#ffe680] shadow-[0_0_48px_rgba(255,230,128,0.72)]",
    iconClass: "bg-ink text-bone",
    textClass: "text-ink",
    mutedClass: "text-ink/68",
    eyebrowClass: "text-ink/66"
  };
}

function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour < 6 || hour >= 20;
}

function WeatherMetric({ icon: Icon, label, value, dark = false }: { icon: typeof CloudSun; label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur", dark ? "border border-white/12 bg-white/10" : "border border-ink/8 bg-white/34")}>
      <Icon className={cn("h-4 w-4", dark ? "text-bone/68" : "text-ink/68")} />
      <p className={cn("mt-3 text-[10px] font-black uppercase tracking-[0.16em]", dark ? "text-bone/68" : "text-ink/66")}>{label}</p>
      <p className={cn("mt-1 text-sm font-black leading-tight", dark ? "text-bone" : "text-ink")}>{value}</p>
    </div>
  );
}

function MoodRails({ events, savedEvents, onSave, onOpenDetails }: { events: EventItem[]; savedEvents: string[]; onSave: (id: string) => void; onOpenDetails: (event: EventItem) => void }) {
  const rails = [
    { title: "Live music lanes", vibe: "Live Music" as VibeTag, icon: Music },
    { title: "Comedy first", vibe: "Comedy" as VibeTag, icon: Laugh },
    { title: "Date Night", vibe: "Date Night" as VibeTag, icon: Heart },
    { title: "Free but good", vibe: "Free" as VibeTag, icon: Martini },
    { title: "Weird Austin", vibe: "Weird Austin" as VibeTag, icon: Sparkles }
  ]
    .map((rail) => ({ ...rail, events: events.filter((event) => event.vibeTags.includes(rail.vibe)).slice(0, 10) }))
    .filter((rail) => rail.events.length);
  if (!rails.length) return null;
  return (
    <section className="overflow-visible">
      <SectionHeader kicker="Keep browsing" title="More lanes." />
      <div className="space-y-7">
        {rails.map((rail) => (
          <div key={rail.title}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <InlineLottieIcon label={rail.vibe} icon={rail.icon} />
                <h3 className="truncate text-xl font-black">{rail.title}</h3>
              </div>
              <Link className="text-xs font-black uppercase tracking-[0.16em] text-neon" href={`/explore?vibe=${encodeURIComponent(rail.vibe)}`}>
                See all
              </Link>
            </div>
            <FullBleedRail>
              {rail.events.map((event) => (
                <div className="w-[72vw] shrink-0 snap-start sm:w-[290px]" key={event.id}>
                  <EventCard event={event} size="compact" saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />
                </div>
              ))}
            </FullBleedRail>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvergreenDiscovery({ evergreenEvents, venues, savedVenues, onSaveVenue }: { evergreenEvents: EvergreenEventItem[]; venues: VenueItem[]; savedVenues: string[]; onSaveVenue: (id: string) => void }) {
  const ideas = useMemo(
    () =>
      evergreenEvents
        .map((idea) => ({ idea, venue: venues.find((venue) => venue.id === idea.venueId || venue.name === idea.venueName) }))
        .filter((item): item is { idea: EvergreenEventItem; venue: VenueItem } => Boolean(item.venue)),
    [evergreenEvents, venues]
  );
  const [index, setIndex] = useState(0);
  if (!ideas.length) return null;
  const item = ideas[index % ideas.length];
  const saved = savedVenues.includes(item.venue.id);
  return (
    <section className="glass-panel grid gap-4 overflow-hidden rounded-[1.75rem] p-4 lg:grid-cols-[0.8fr_1.2fr] lg:p-5">
      <div className="flex flex-col justify-center p-1">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Always on</p>
        <h2 className="mt-2 font-display text-4xl leading-none md:text-5xl">Need an idea?</h2>
        <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-bone/62">Evergreen Austin moves for when events are too much and staying home is not it.</p>
      </div>
      <article className="relative min-h-[420px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-black shadow-card">
        <SafeImage className="object-cover" src={item.venue.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 92vw, 720px" />
        <div className="image-card-fade" />
        <div className="absolute inset-x-0 top-0 flex justify-between gap-3 p-4">
          <span className="rounded-full bg-bone px-3 py-2 text-xs font-black text-ink">{item.idea.category || "Austin classic"}</span>
          <button className="grid h-11 w-11 place-items-center rounded-full bg-bone text-ink transition hover:bg-neon" onClick={() => setIndex((current) => current + 1)} aria-label="Show another idea">
            <RefreshCcw className="h-5 w-5" />
          </button>
        </div>
        <div className="media-copy absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{item.venue.neighborhoodPersonality}</p>
          <h3 className="mt-2 max-w-2xl text-4xl font-black leading-none md:text-5xl">{item.idea.title}</h3>
          <p className="mt-3 text-sm font-bold text-bone/70">{item.venue.name} · {areaLabel(item.venue.area)}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className={cn("rounded-full px-4 py-2 text-xs font-black transition", saved ? "bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)]" : "bg-white/18 text-bone hover:bg-white/28")} onClick={() => onSaveVenue(item.venue.id)}>
              {saved ? "Saved" : "Save place"}
            </button>
            <Link className="rounded-full bg-neon px-4 py-2 text-xs font-black text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)] transition hover:bg-[#35E56B]" href={`/places/${item.venue.id}`}>
              Venue page
            </Link>
            {item.venue.venueUrl ? (
              <a className="rounded-full bg-white/18 px-4 py-2 text-xs font-black text-bone transition hover:bg-white/28" href={item.venue.venueUrl} target="_blank" rel="noreferrer">
                Visit
              </a>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}

function MoveMaker({ events, savedEvents, onSave, onOpenDetails }: { events: EventItem[]; savedEvents: string[]; onSave: (id: string) => void; onOpenDetails: (event: EventItem) => void }) {
  const [intent, setIntent] = useState<MoveIntent>({ vibe: "Actually Worth It", energy: "medium", company: "friends" });
  const picks = useMemo(() => chooseForMove(events, intent), [events, intent]);
  return (
    <section className="max-w-full overflow-hidden rounded-[1.75rem] border border-white/54 bg-white/82 p-4 text-ink shadow-[0_24px_90px_rgba(0,0,0,0.16)] backdrop-blur-2xl md:rounded-[2rem] md:p-8">
      <div className="grid min-w-0 max-w-full gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neon">Signature move</p>
          <h2 className="mt-3 max-w-full font-display text-4xl leading-none md:text-6xl">What’s the move?</h2>
          <p className="mt-4 max-w-md text-sm font-medium leading-6 text-ink/62">
            Tell Cactus Club the mood. Get three easy picks without scrolling yourself into staying home.
          </p>
          <div className="mt-6 min-w-0 max-w-full space-y-5">
            <ChipGroup label="Vibe" values={moveVibes} value={intent.vibe} onChange={(vibe) => setIntent({ ...intent, vibe })} />
            <ChipGroup label="Energy" values={["soft", "medium", "chaos"] as MoveEnergy[]} value={intent.energy} onChange={(energy) => setIntent({ ...intent, energy })} />
            <ChipGroup label="With" values={["solo", "date", "friends"] as MoveCompany[]} value={intent.company} onChange={(company) => setIntent({ ...intent, company })} />
          </div>
        </div>
        <div className="grid min-w-0 max-w-full gap-3 md:grid-cols-3">
          {picks.map((event, index) => (
            <EventCard event={event} key={event.id} tone="light" size={index === 0 ? "tall" : "compact"} saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ChipGroup<T extends string>({ label, values, value, onChange }: { label: string; values: T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="min-w-0 max-w-full">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] opacity-55">{label}</p>
      <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar">
        {values.map((item) => (
          <button
            className={cn(
              "max-w-[78vw] shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-black transition",
              value === item ? "border-neon bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.22)]" : "border-ink/10 bg-white/72 text-ink/72 hover:bg-white"
            )}
            key={item}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

type ExploreGuideCard = {
  id: string;
  label: string;
  title: string;
  copy: string;
  anchor: EventItem;
  nearbyEvents: EventItem[];
  addOns: UnifiedPlace[];
  tone: "lime" | "orange" | "blue";
};

type GeneratedExploreArticle = {
  id: string;
  headline: string;
  hook: string;
  featuredEvent: EventItem;
  before?: MoseyStop;
  after?: MoseyStop;
  bonus?: MoseyStop;
  cta: string;
  area: Area;
  timeOfDay: "morning" | "afternoon" | "evening" | "late";
  vibe: string;
  rankedPlaceIds: string[];
  tone: "lime" | "orange" | "blue";
};

type MoseyStop = {
  label: "Before" | "After" | "Bonus";
  place: UnifiedPlace;
  copy: string;
};

function ExploreGuidesFrontPage({
  events,
  places,
  savedEvents,
  savedPlaces,
  onAddToPlan,
  onOpenDetails,
  onOpenPlace
}: {
  events: EventItem[];
  places: UnifiedPlace[];
  savedEvents: string[];
  savedPlaces: string[];
  onAddToPlan: (eventId: string, placeIds: string[]) => void;
  onOpenDetails: (event: EventItem) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
}) {
  const allocation = useMemo(() => allocateExplorePlans(events, places), [events, places]);
  const generatedArticles = allocation.weeklyPlans;
  const [activeArticle, setActiveArticle] = useState<GeneratedExploreArticle | null>(null);
  const heroGuide = allocation.heroPlan;
  const supportingGuides = allocation.supportingPlans;

  if (!heroGuide && !places.length) return null;

  return (
    <section className="space-y-6 pt-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100">Explore guides</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-black leading-[0.95] tracking-[-0.04em] md:text-6xl">Build the night around what is actually happening.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Tonight", "Live Music", "Free", "Date Night"].map((label) => (
            <Link className="rounded-full border border-white/26 bg-white/18 px-3 py-2 text-xs font-black text-bone/76 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/28 hover:text-bone" href={label === "Tonight" ? "/explore?date=Today" : `/explore?vibe=${encodeURIComponent(label)}`} key={label}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        {heroGuide ? <ExploreGuideHeroCard article={heroGuide} onOpen={() => setActiveArticle(heroGuide)} onOpenPlace={onOpenPlace} /> : null}

        <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {supportingGuides.map((article) => (
            <ExploreGuideCardView article={article} key={article.id} onOpen={() => setActiveArticle(article)} />
          ))}
        </section>

        {generatedArticles.length ? (
          <section className="glass-card rounded-[1.75rem] p-4 text-ink">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cactus">Austin plan guides</p>
                <h2 className="mt-2 text-2xl font-black leading-tight tracking-[-0.035em] md:text-3xl">Start with the thing, then make the rest easy.</h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {generatedArticles.map((article) => (
                <GeneratedExploreArticleCard article={article} onOpen={() => setActiveArticle(article)} key={article.id} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <CompactStoryList title="Soonest calendar" items={allocation.soonestPlans.map((article) => ({ id: article.id, title: article.featuredEvent.title, meta: `${dayLabel(article.featuredEvent)} · ${formatEventTime(article.featuredEvent)}`, imageUrl: article.featuredEvent.imageUrl, onClick: () => setActiveArticle(article) }))} />
          <CompactStoryList title="Most browsed" items={allocation.mostBrowsedPlans.map((article) => ({ id: article.id, title: article.featuredEvent.title, meta: `${article.featuredEvent.category} · ${areaLabel(article.featuredEvent.area)}`, imageUrl: article.featuredEvent.imageUrl, onClick: () => setActiveArticle(article) }))} />
        </section>
      </div>
      <MoseyArticleDrawer
        article={activeArticle}
        savedEvents={savedEvents}
        savedPlaces={savedPlaces}
        onAddToPlan={onAddToPlan}
        onClose={() => setActiveArticle(null)}
        onOpenDetails={onOpenDetails}
        onOpenPlace={onOpenPlace}
      />
    </section>
  );
}

function ExploreGuideHeroCard({ article, onOpen, onOpenPlace }: { article: GeneratedExploreArticle; onOpen: () => void; onOpenPlace: (place: UnifiedPlace) => void }) {
  const stopButtons = planFoodDrinkStops(article).slice(0, 2);
  return (
    <article className="glass-card glass-card-hover grid min-w-0 gap-4 rounded-[2rem] p-3 text-ink lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
      <button className="group relative min-h-[430px] overflow-hidden rounded-[1.65rem] text-left" onClick={onOpen}>
        <SafeImage className="object-cover transition duration-700 group-hover:scale-105" src={article.featuredEvent.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 1024px) 94vw, 700px" />
        <div className="image-card-fade" />
        <div className="media-copy absolute inset-x-0 bottom-0 p-5 md:p-7">
          <span className="inline-flex w-fit rounded-full border border-white/24 bg-black/34 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-xl">
            {explorePlanLabel(article)}
          </span>
          <h2 className="mt-4 max-w-2xl text-4xl font-black leading-[0.94] tracking-[-0.045em] text-white md:text-6xl">{eventAtVenueTitle(article.featuredEvent)}</h2>
          <StoryMetadataRow primary={`${dayLabel(article.featuredEvent)} · ${formatEventTime(article.featuredEvent)}`} secondary={article.featuredEvent.venueName} />
        </div>
      </button>
      <div className="flex min-w-0 flex-col justify-between gap-4 p-2 lg:p-4">
        <div>
          <p className="text-sm font-bold leading-6 text-ink/68">{article.hook}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-full bg-emerald-950 px-3 py-2 text-xs font-black text-white shadow-soft transition hover:-translate-y-0.5" onClick={onOpen}>
              {formatEventTime(article.featuredEvent)} · {article.featuredEvent.venueName}
            </button>
          </div>
        </div>
        <div className="grid gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cactus">Add a stop nearby</p>
          {stopButtons.map((stop) => (
            <button className="grid grid-cols-[82px_1fr] gap-3 rounded-[1.15rem] bg-white/36 p-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] transition hover:-translate-y-0.5 hover:bg-white/50" key={stop.place.id} onClick={() => onOpenPlace(stop.place)}>
              <span className="relative h-20 overflow-hidden rounded-[0.95rem]">
                <SafeImage className="object-cover" src={stop.place.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="100px" />
              </span>
              <span className="min-w-0 py-1">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cactus">{stop.label}</span>
                <span className="mt-1 line-clamp-2 block text-base font-black leading-tight">{stop.place.name}</span>
                <span className="mt-2 block text-xs font-bold text-ink/58">{stop.place.price ?? "$$"} · {areaLabel(stop.place.area)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function ExploreGuideCardView({ article, onOpen }: { article: GeneratedExploreArticle; onOpen: () => void }) {
  const stops = planFoodDrinkStops(article).slice(0, 2);
  return (
    <article className="glass-card glass-card-hover rounded-[1.75rem] p-3 text-ink">
      <button className="group relative h-56 w-full overflow-hidden rounded-[1.35rem] text-left" onClick={onOpen}>
        <SafeImage className="object-cover transition duration-700 group-hover:scale-105" src={article.featuredEvent.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="420px" />
        <div className="image-card-fade" />
        <div className="media-copy absolute inset-x-0 bottom-0 p-4">
          <StoryLabel tone={article.tone}>{explorePlanLabel(article)}</StoryLabel>
          <h3 className="mt-3 line-clamp-2 text-2xl font-black leading-tight text-white">{eventAtVenueTitle(article.featuredEvent)}</h3>
        </div>
      </button>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-6 text-ink/66">{article.hook}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-full bg-emerald-950 px-3 py-2 text-xs font-black text-white transition hover:-translate-y-0.5" onClick={onOpen}>
            {formatEventTime(article.featuredEvent)}
          </button>
          {stops.map((stop) => (
            <span className="rounded-full bg-white/54 px-3 py-2 text-xs font-black text-emerald-950 shadow-soft" key={stop.place.id}>
              {stop.place.name}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function GeneratedExploreArticleCard({
  article,
  onOpen
}: {
  article: GeneratedExploreArticle;
  onOpen: () => void;
}) {
  const stops = [article.before, article.after, article.bonus].filter(Boolean) as MoseyStop[];
  return (
    <button className="glass-card-hover flex h-full flex-col rounded-[1.35rem] bg-white/28 p-2 text-left text-ink" onClick={onOpen}>
      <span className="group relative h-36 w-full overflow-hidden rounded-[1rem] text-left">
        <SafeImage className="object-cover transition duration-700 group-hover:scale-105" src={article.featuredEvent.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="260px" />
        <div className="image-card-fade" />
        <div className="absolute left-2 top-2"><StoryLabel tone={article.tone}>{article.timeOfDay}</StoryLabel></div>
        <div className="media-copy absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-base font-black leading-tight text-white">{article.featuredEvent.title}</p>
          <p className="mt-1 truncate text-[11px] font-bold text-white/74">{formatEventTime(article.featuredEvent)} · {article.featuredEvent.venueName}</p>
        </div>
      </span>
      <span className="flex flex-1 flex-col p-2">
        <span className="line-clamp-2 text-base font-black leading-tight">{eventAtVenueTitle(article.featuredEvent)}</span>
        <span className="mt-2 line-clamp-3 text-xs font-bold leading-5 text-ink/62">{article.hook}</span>
        {stops.length ? (
          <span className="mt-3 flex flex-wrap gap-1.5">
            {stops.map((place) => (
              <span className="max-w-full truncate rounded-full bg-white/54 px-2.5 py-1.5 text-[10px] font-black text-emerald-950 shadow-soft" key={place.place.id}>
                {place.place.name}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function MoseyArticleDrawer({
  article,
  savedEvents,
  savedPlaces,
  onAddToPlan,
  onClose,
  onOpenDetails,
  onOpenPlace
}: {
  article: GeneratedExploreArticle | null;
  savedEvents: string[];
  savedPlaces: string[];
  onAddToPlan: (eventId: string, placeIds: string[]) => void;
  onClose: () => void;
  onOpenDetails: (event: EventItem) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
}) {
  if (!article) return null;
  const activeArticle = article;
  const stops = [activeArticle.before, activeArticle.after, activeArticle.bonus].filter(Boolean) as MoseyStop[];
  const fullySaved = savedEvents.includes(activeArticle.featuredEvent.id) && activeArticle.rankedPlaceIds.every((id) => savedPlaces.includes(id));

  function addToPlan() {
    onAddToPlan(activeArticle.featuredEvent.id, activeArticle.rankedPlaceIds);
  }

  function openEventDetails() {
    onClose();
    onOpenDetails(activeArticle.featuredEvent);
  }

  function openPlaceDetails(place: UnifiedPlace) {
    onClose();
    onOpenPlace(place);
  }

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[90] bg-emerald-950/54 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.aside
          className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[1.75rem] border border-white/40 bg-bone text-ink shadow-[0_-24px_90px_rgba(0,0,0,0.34)] md:inset-x-auto md:right-5 md:top-5 md:h-[calc(100vh-2.5rem)] md:w-[460px] md:max-h-none md:rounded-[1.75rem]"
          initial={{ y: 36, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 36, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-emerald-950/10 bg-bone/88 p-4 backdrop-blur-xl">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cactus">{areaLabel(activeArticle.area)}</p>
              <p className="mt-1 text-sm font-black text-ink/62">{formatEventTime(activeArticle.featuredEvent)} · {activeArticle.vibe}</p>
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-emerald-950 text-bone transition hover:bg-cactus" onClick={onClose} aria-label="Close plan">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <h2 className="font-display text-4xl font-black leading-[0.95] tracking-[-0.035em] md:text-5xl">{activeArticle.headline}</h2>
              <p className="mt-3 text-base font-semibold leading-7 text-ink/68">{activeArticle.hook}</p>
            </div>

            <section className="rounded-[1.35rem] bg-white p-2 shadow-soft">
              <p className="px-2 pb-2 pt-1 text-xs font-black uppercase tracking-[0.16em] text-cactus">Featured event</p>
              <button className="grid w-full grid-cols-[96px_1fr] gap-3 rounded-[1.1rem] bg-emerald-950 text-left text-bone transition hover:-translate-y-0.5 hover:bg-cactus" onClick={openEventDetails}>
                <span className="relative min-h-[108px] overflow-hidden rounded-l-[1.1rem] bg-black">
                  <SafeImage className="object-cover" src={activeArticle.featuredEvent.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="120px" />
                </span>
                <span className="min-w-0 py-3 pr-3">
                  <span className="line-clamp-2 text-lg font-black leading-tight">{activeArticle.featuredEvent.title}</span>
                  <span className="mt-2 block text-xs font-bold text-bone/70">{dayLabel(activeArticle.featuredEvent)} · {formatEventTime(activeArticle.featuredEvent)}</span>
                  <span className="mt-1 block truncate text-xs font-bold text-bone/56">{activeArticle.featuredEvent.venueName}</span>
                </span>
              </button>
            </section>

            {stops.map((stop) => (
              <section className="rounded-[1.35rem] bg-white/72 p-3 shadow-soft" key={`${stop.label}-${stop.place.id}`}>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cactus">{stop.label} recommendation</p>
                <p className="mt-2 text-sm font-bold leading-6 text-ink/68">{stop.copy}</p>
                <button className="mt-3 grid w-full grid-cols-[74px_1fr] gap-3 rounded-[1rem] bg-emerald-950/6 p-2 text-left transition hover:-translate-y-0.5 hover:bg-emerald-950/10" onClick={() => openPlaceDetails(stop.place)}>
                  <span className="relative h-16 overflow-hidden rounded-[0.8rem] bg-white">
                    <SafeImage className="object-cover" src={stop.place.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="90px" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-base font-black">{stop.place.name}</span>
                    <span className="mt-1 block text-xs font-bold text-ink/56">{placeKindLabel(stop.place.kind)} · {areaLabel(stop.place.area)}</span>
                    <span className="mt-1 block line-clamp-1 text-xs font-semibold text-ink/48">{stop.place.price ?? "$$"} · {stop.place.openFor ?? stop.place.neighborhoodPersonality}</span>
                  </span>
                </button>
              </section>
            ))}

            <button
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black shadow-[0_14px_32px_rgba(5,46,22,0.18)] transition",
                fullySaved ? "bg-emerald-950 text-bone" : "bg-neon text-emerald-950 hover:bg-[#35E56B]"
              )}
              onClick={addToPlan}
            >
              {fullySaved ? <Check className="h-5 w-5" /> : <ListPlus className="h-5 w-5" />}
              {fullySaved ? "Added to plan" : activeArticle.cta}
            </button>
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}

function LocalGuideArticleCard({ article, place }: { article: AtxArticle; place?: UnifiedPlace }) {
  return (
    <a className="glass-card-hover rounded-[1.35rem] bg-white/28 p-2 text-ink" href={article.url} target="_blank" rel="noreferrer">
      <div className="relative h-32 overflow-hidden rounded-[1rem]">
        <SafeImage className="object-cover transition duration-700 hover:scale-105" src={place?.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="220px" />
        <div className="absolute left-2 top-2"><StoryLabel tone="lime">{article.tags?.[0] ?? "Guide"}</StoryLabel></div>
      </div>
      <div className="p-2">
        <h3 className="line-clamp-2 text-sm font-black leading-tight">{article.title}</h3>
        <p className="mt-2 text-xs font-bold text-ink/58">{article.place_count ?? "Local"} places · Local rotation</p>
      </div>
    </a>
  );
}

function SidebarFeatureCard({ imageUrl, label, title, meta, onClick }: { imageUrl?: string; label: string; title: string; meta: string; onClick: () => void }) {
  return (
    <button className="glass-card-hover relative min-h-[210px] w-full overflow-hidden rounded-[1.45rem] text-left" onClick={onClick}>
      <SafeImage className="object-cover transition duration-700 hover:scale-105" src={imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="340px" />
      <div className="image-card-fade" />
      <div className="media-copy absolute inset-x-0 bottom-0 p-4">
        <StoryLabel tone="lime">{label}</StoryLabel>
        <h3 className="mt-2 line-clamp-2 text-xl font-black text-white">{title}</h3>
        <p className="mt-2 text-xs font-bold text-white/76">{meta}</p>
      </div>
    </button>
  );
}

function CompactStoryList({ title, items, compact = false }: { title: string; compact?: boolean; items: Array<{ id: string; title: string; meta: string; imageUrl?: string; onClick: () => void }> }) {
  if (!items.length) return null;
  return (
    <section className={cn("glass-card rounded-[1.45rem] p-4 text-ink", compact && "bg-emerald-950/70 text-bone")}>
      <h3 className={cn("text-xs font-black uppercase tracking-[0.18em]", compact ? "text-emerald-100" : "text-cactus")}>{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <button className={cn("grid grid-cols-[58px_1fr] gap-3 rounded-[1rem] p-2 text-left transition hover:-translate-y-0.5", compact ? "hover:bg-white/12" : "bg-white/24 hover:bg-white/42")} key={item.id} onClick={item.onClick}>
            <span className="relative h-14 overflow-hidden rounded-xl bg-white/12">
              <SafeImage className="object-cover" src={item.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="80px" />
            </span>
            <span className="min-w-0">
              <span className={cn("line-clamp-2 text-sm font-black leading-tight", compact ? "text-bone" : "text-ink")}>{item.title}</span>
              <span className={cn("mt-1 block truncate text-xs font-bold", compact ? "text-bone/48" : "text-ink/52")}>{item.meta}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function EventCalendarWidget({
  calendarMonth,
  dateMode,
  endDate,
  locationEnabled,
  onMonthChange,
  onPickDate,
  onQuickPick,
  startDate
}: {
  calendarMonth: Date;
  dateMode: "Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby";
  endDate: string;
  locationEnabled: boolean;
  onMonthChange: (date: Date) => void;
  onPickDate: (value: string) => void;
  onQuickPick: (mode: "Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby") => void;
  startDate: string;
}) {
  return (
    <section className="glass-card min-h-[430px] rounded-[1.5rem] p-3 text-ink">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cactus">Calendar</p>
          <h3 className="mt-1 text-xl font-black text-ink">Pick the date.</h3>
        </div>
        <CalendarDays className="h-5 w-5 text-cactus" />
      </div>
      <DateCalendarPicker
        calendarMonth={calendarMonth}
        dateMode={dateMode}
        endDate={endDate}
        locationEnabled={locationEnabled}
        onClearDates={() => onQuickPick("Any")}
        onMonthChange={onMonthChange}
        onPickDate={onPickDate}
        onQuickPick={onQuickPick}
        startDate={startDate}
      />
    </section>
  );
}

function StoryLabel({ children, tone }: { children: React.ReactNode; tone: "lime" | "orange" | "blue" }) {
  return (
    <span className={cn(
      "inline-flex w-fit rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]",
      tone === "lime" && "bg-neon text-emerald-950",
      tone === "orange" && "bg-[#ffb86b] text-emerald-950",
      tone === "blue" && "bg-sky-200 text-emerald-950"
    )}>
      {children}
    </span>
  );
}

function StoryMetadataRow({ primary, secondary, compact = false }: { primary: string; secondary: string; compact?: boolean }) {
  return (
    <div className={cn("mt-4 flex flex-wrap items-center gap-2 font-bold text-white/78", compact ? "text-[11px]" : "text-sm")}>
      <span>{primary}</span>
      <span className="text-white/42">•</span>
      <span>{secondary}</span>
    </div>
  );
}

function ExploreView({
  events,
  places,
  articles,
  locationEnabled,
  savedEvents,
  savedPlaces,
  visitedPlaces,
  preferredAreas,
  preferredVibes,
  onSave,
  onSavePlace,
  onAddMoseyToPlan,
  onVisitPlace,
  onOpenPlace,
  onOpenDetails,
  onPreferredArea,
  onPreferredVibe
}: {
  events: EventItem[];
  places: UnifiedPlace[];
  articles: AtxArticle[];
  locationEnabled: boolean;
  savedEvents: string[];
  savedPlaces: string[];
  visitedPlaces: string[];
  preferredAreas: Area[];
  preferredVibes: VibeTag[];
  onSave: (id: string) => void;
  onSavePlace: (id: string) => void;
  onAddMoseyToPlan: (eventId: string, placeIds: string[]) => void;
  onVisitPlace: (id: string) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
  onOpenDetails: (event: EventItem) => void;
  onPreferredArea: (areas: Area[]) => void;
  onPreferredVibe: (vibes: VibeTag[]) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVibe = searchParams.get("vibe");
  const initialArea = searchParams.get("area");
  const initialDateMode = searchParams.get("date");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [vibe, setVibe] = useState<VibeTag | "All">(vibeFilters.includes(initialVibe as VibeTag) ? (initialVibe as VibeTag) : "All");
  const [area, setArea] = useState<Area | "All">(areaFilters.includes(initialArea as Area) ? (initialArea as Area) : "All");
  const [dateMode, setDateMode] = useState<"Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby">(
    ["Today", "Tomorrow", "Weekend", "Range", "Nearby"].includes(initialDateMode ?? "") ? (initialDateMode as "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby") : "Any"
  );
  const [startDate, setStartDate] = useState(searchParams.get("start") ?? "");
  const [endDate, setEndDate] = useState(searchParams.get("end") ?? "");
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(parseDateKey(searchParams.get("start") ?? "") ?? new Date()));
  const [openFilter, setOpenFilter] = useState<"date" | "vibe" | "area" | null>(null);
  const [visibleResultCount, setVisibleResultCount] = useState(24);
  const searchKey = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const nextQuery = params.get("q") ?? "";
    const nextVibe = params.get("vibe");
    const nextArea = params.get("area");
    const nextDateMode = params.get("date");
    const nextStart = params.get("start") ?? "";
    const nextEnd = params.get("end") ?? "";
    const parsedVibe = vibeFilters.includes(nextVibe as VibeTag) ? (nextVibe as VibeTag) : "All";
    const parsedArea = areaFilters.includes(nextArea as Area) ? (nextArea as Area) : "All";
    const parsedDate = ["Today", "Tomorrow", "Weekend", "Range", "Nearby"].includes(nextDateMode ?? "")
      ? (nextDateMode as "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby")
      : "Any";

    setQuery(nextQuery);
    setVibe(parsedVibe);
    setArea(parsedArea);
    setDateMode(parsedDate);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    if (nextStart) setCalendarMonth(monthStart(parseDateKey(nextStart) ?? new Date()));
  }, [searchKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (vibe !== "All") params.set("vibe", vibe);
    if (area !== "All") params.set("area", area);
    if (dateMode !== "Any") params.set("date", dateMode);
    if (dateMode === "Range" && startDate) params.set("start", startDate);
    if (dateMode === "Range" && endDate) params.set("end", endDate);
    const next = params.toString() ? `/explore?${params.toString()}` : "/explore";
    const current = searchKey ? `/explore?${searchKey}` : "/explore";
    if (next !== current) router.replace(next, { scroll: false });
  }, [area, dateMode, endDate, query, router, searchKey, startDate, vibe]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((event) => !q || `${event.title} ${event.venueName} ${event.category}`.toLowerCase().includes(q))
      .filter((event) => vibe === "All" || event.vibeTags.includes(vibe))
      .filter((event) => area === "All" || event.area === area)
      .filter((event) => {
        if (dateMode === "Any") return true;
        if (dateMode === "Today") return isToday(event);
        if (dateMode === "Tomorrow") return isTomorrow(event);
        if (dateMode === "Weekend") return isThisWeekend(event);
        if (dateMode === "Range") return isWithinDateRange(event, startDate, endDate || startDate);
        return typeof event.distanceMiles === "number" && event.distanceMiles <= 8;
      })
      .sort((a, b) => {
        return sortSoonest(a, b) || (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99);
      });
  }, [area, dateMode, endDate, events, query, startDate, vibe]);

  useEffect(() => {
    setVisibleResultCount(24);
  }, [area, dateMode, endDate, query, startDate, vibe]);

  const visibleResults = useMemo(() => results.slice(0, visibleResultCount), [results, visibleResultCount]);
  const visibleResultGroups = useMemo(() => groupEventsByDayAndTime(visibleResults), [visibleResults]);
  function selectVibe(next: VibeTag | "All") {
    setVibe(next);
    setOpenFilter(null);
    if (next !== "All") onPreferredVibe(uniq([next, ...preferredVibes]).slice(0, 6));
  }
  function selectArea(next: Area | "All") {
    setArea(next);
    setOpenFilter(null);
    if (next !== "All") onPreferredArea(uniq([next, ...preferredAreas]).slice(0, 5));
  }
  function resetFilters() {
    setQuery("");
    setVibe("All");
    setArea("All");
    setDateMode("Any");
    setStartDate("");
    setEndDate("");
    setOpenFilter(null);
  }
  function selectCalendarDate(value: string) {
    if (value < localDateKey(new Date())) return;
    if (dateMode !== "Range" || !startDate || endDate) {
      setStartDate(value);
      setEndDate("");
      setDateMode("Range");
      return;
    }
    if (value < startDate) {
      setEndDate(startDate);
      setStartDate(value);
      return;
    }
    if (value === startDate) {
      setEndDate("");
      return;
    }
    setEndDate(value);
  }
  const activeFilterCount = [query.trim(), vibe !== "All", area !== "All", dateMode !== "Any"].filter(Boolean).length;
  return (
    <motion.section {...viewMotion} className="space-y-8 pt-2 md:pt-4">
      <ExploreGuidesFrontPage
        events={events}
        places={places}
        savedEvents={savedEvents}
        savedPlaces={savedPlaces}
        onAddToPlan={onAddMoseyToPlan}
        onOpenDetails={onOpenDetails}
        onOpenPlace={onOpenPlace}
      />
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-white/20" />
        <span className="rounded-full border border-white/28 bg-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bone/62 backdrop-blur-xl">Filters + listings</span>
        <div className="h-px flex-1 bg-white/20" />
      </div>
      <section className="glass-panel sticky top-20 z-30 rounded-[1.5rem] p-2 md:top-24 md:p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <div className="flex h-11 w-[58vw] min-w-[190px] shrink-0 items-center gap-2 rounded-full border border-white/28 bg-white/24 px-3 transition focus-within:border-neon/50 focus-within:bg-white/34 md:w-auto md:min-w-[260px] md:flex-1 md:gap-3 md:rounded-2xl md:px-4">
            <Search className="h-5 w-5 shrink-0 text-emerald-100" />
            <input className="w-full min-w-0 bg-transparent text-sm text-bone outline-none placeholder:text-bone/38" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events..." />
            {query ? <button className="grid h-7 w-7 place-items-center rounded-full bg-white/10" onClick={() => setQuery("")} aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <BrowseButton label="Date" value={dateLabel(dateMode, startDate, endDate)} active={dateMode !== "Any"} open={openFilter === "date"} onClick={() => setOpenFilter(openFilter === "date" ? null : "date")} />
          <BrowseButton label="Vibe" value={vibe} active={vibe !== "All"} open={openFilter === "vibe"} onClick={() => setOpenFilter(openFilter === "vibe" ? null : "vibe")} />
          <BrowseButton label="Area" value={areaLabel(area)} active={area !== "All"} open={openFilter === "area"} onClick={() => setOpenFilter(openFilter === "area" ? null : "area")} />
          <button className="h-11 shrink-0 rounded-full bg-neon px-4 text-xs font-black text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)] transition hover:bg-[#35E56B] md:rounded-2xl" onClick={resetFilters}>
            {activeFilterCount ? `Clear ${activeFilterCount}` : `${results.length} events`}
          </button>
        </div>

        <AnimatePresence>
          {openFilter ? (
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(8px)" }} className="mt-3 rounded-[1.25rem] border border-white/28 bg-white/22 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.36)] backdrop-blur-2xl">
              {openFilter === "date" ? (
                <DateCalendarPicker
                  calendarMonth={calendarMonth}
                  dateMode={dateMode}
                  endDate={endDate}
                  locationEnabled={locationEnabled}
                  onClearDates={() => {
                    setStartDate("");
                    setEndDate("");
                    setDateMode("Any");
                  }}
                  onMonthChange={setCalendarMonth}
                  onPickDate={selectCalendarDate}
                  onQuickPick={(mode) => {
                    setDateMode(mode);
                    if (mode !== "Range") {
                      setStartDate("");
                      setEndDate("");
                    }
                  }}
                  startDate={startDate}
                />
              ) : null}
              {openFilter === "vibe" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  <button
                    className={cn(
                      "group flex min-h-[118px] flex-col items-center justify-center rounded-[1.25rem] border p-3 text-center transition hover:-translate-y-0.5",
                      vibe === "All" ? "border-neon/45 bg-neon/12" : "border-white/10 bg-white/8 hover:border-neon/40 hover:bg-white/12"
                    )}
                    onClick={() => selectVibe("All")}
                  >
                    <InlineLottieIcon label="Weird Austin" icon={Sparkles} />
                    <span className="mt-3 text-sm font-black">All</span>
                  </button>
                  {categoryLinks.filter((category) => category.vibe).map((category) => {
                    const Icon = category.icon;
                    const selected = vibe === category.vibe;
                    return (
                      <button
                        className={cn(
                          "group flex min-h-[118px] flex-col items-center justify-center rounded-[1.25rem] border p-3 text-center transition hover:-translate-y-0.5",
                          selected ? "border-neon/45 bg-neon/12" : "border-white/10 bg-white/8 hover:border-neon/40 hover:bg-white/12"
                        )}
                        key={category.label}
                        onClick={() => selectVibe(category.vibe ?? "All")}
                      >
                        <AnimatedCategoryIcon label={category.label} icon={Icon} />
                        <span className="mt-3 text-sm font-black">{category.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {openFilter === "area" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                  {(["All", ...areaFilters] as const).map((item) => <FilterChip key={item} active={area === item} onClick={() => selectArea(item)}>{areaLabel(item)}</FilterChip>)}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-bone/58">
        <p>
          {results.length ? `Showing ${visibleResults.length} of ${results.length}` : "No"} {area !== "All" ? `${areaLabel(area)} ` : ""}events
        </p>
        {area === "Burbs" ? <p className="text-bone/42">Suburbs only. No in-town Austin venues.</p> : null}
      </div>
      <div className="space-y-8">
        {visibleResultGroups.map((group) => (
          <section className="space-y-3" key={group.id}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{group.day}</p>
                <h2 className="text-2xl font-black leading-none tracking-[-0.035em] text-bone">{group.timeLabel}</h2>
              </div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-bone/46">
                {group.events.length} {group.events.length === 1 ? "event" : "events"}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.events.map((event) => (
                <EventCard event={event} key={event.id} saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {visibleResults.length < results.length ? (
        <div className="flex justify-center">
          <button
            className="rounded-full bg-neon px-5 py-3 text-xs font-black text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)] transition hover:bg-[#35E56B]"
            onClick={() => setVisibleResultCount((count) => Math.min(count + 24, results.length))}
          >
            Show more ({visibleResults.length}/{results.length})
          </button>
        </div>
      ) : null}
      {!results.length ? <EmptyPanel message="Nothing there yet. Try fewer filters." /> : null}
    </motion.section>
  );
}

function PlanView({
  events,
  venues,
  places,
  savedEvents,
  savedVenues,
  savedPlaces,
  visitedPlaces,
  customLists,
  friendProfiles,
  onSaveEvent,
  onSaveVenue,
  onSavePlace,
  onVisitPlace,
  onOpenPlace,
  onAddPlaceToList,
  onRemovePlaceFromList,
  onFriendProfiles,
  onOpenDetails
}: {
  events: EventItem[];
  venues: VenueItem[];
  places: UnifiedPlace[];
  savedEvents: string[];
  savedVenues: string[];
  savedPlaces: string[];
  visitedPlaces: string[];
  customLists: Record<string, string[]>;
  friendProfiles: FriendTasteProfile[];
  onSaveEvent: (id: string) => void;
  onSaveVenue: (id: string) => void;
  onSavePlace: (id: string) => void;
  onVisitPlace: (id: string) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
  onAddPlaceToList: (listName: string, placeId: string) => void;
  onRemovePlaceFromList: (listName: string, placeId: string) => void;
  onFriendProfiles: (next: FriendTasteProfile[] | ((current: FriendTasteProfile[]) => FriendTasteProfile[])) => void;
  onOpenDetails: (event: EventItem) => void;
}) {
  const [areaFilter, setAreaFilter] = useState<Area | "All">("All");
  const [sortMode, setSortMode] = useState<"Soonest" | "Popular" | "Neighborhood">("Soonest");
  const [planMode, setPlanMode] = useState<"Timeline" | "Neighborhood" | "Places">("Timeline");
  const planned = useMemo(() => {
    return events
      .filter((event) => savedEvents.includes(event.id))
      .filter((event) => areaFilter === "All" || event.area === areaFilter)
      .sort((a, b) => {
        if (sortMode === "Popular") return b.popularityScore - a.popularityScore || sortSoonest(a, b);
        if (sortMode === "Neighborhood") return a.area.localeCompare(b.area) || sortSoonest(a, b);
        return sortSoonest(a, b);
      });
  }, [areaFilter, events, savedEvents, sortMode]);
  const venuePlans = useMemo(() => {
    return venues
      .filter((venue) => savedVenues.includes(venue.id))
      .filter((venue) => areaFilter === "All" || venue.area === areaFilter)
      .sort((a, b) => {
        if (sortMode === "Popular") return b.popularityScore - a.popularityScore;
        if (sortMode === "Neighborhood") return a.area.localeCompare(b.area) || a.name.localeCompare(b.name);
        return (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99);
      });
  }, [areaFilter, savedVenues, sortMode, venues]);
  const placePlans = useMemo(() => {
    return places
      .filter((place) => savedPlaces.includes(place.id))
      .filter((place) => areaFilter === "All" || place.area === areaFilter)
      .sort((a, b) => {
        if (sortMode === "Popular") return b.popularityScore - a.popularityScore;
        if (sortMode === "Neighborhood") return a.area.localeCompare(b.area) || a.name.localeCompare(b.name);
        return (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99);
      });
  }, [areaFilter, places, savedPlaces, sortMode]);
  const tonight = planned.filter((event) => isTonight(event));
  const weekend = planned.filter((event) => !isTonight(event) && isThisWeekend(event));
  const later = planned.filter((event) => !isTonight(event) && !isThisWeekend(event)).slice(0, 20);
  const neighborhoodGroups = areaFilters
    .map((area) => ({ area, events: planned.filter((event) => event.area === area) }))
    .filter((group) => group.events.length);
  return (
    <motion.section {...viewMotion} className="space-y-10 pt-6 md:pt-10">
      <PageTitle kicker="Plan" title="Your upcoming life." copy="Saved events stay fresh. Saved places keep sending signals." />
      {!planned.length && !venuePlans.length && !placePlans.length ? <EmptyPanel message="No plans yet. Let’s fix that." /> : null}
      <PlanControls areaFilter={areaFilter} sortMode={sortMode} planMode={planMode} onAreaFilter={setAreaFilter} onSortMode={setSortMode} onPlanMode={setPlanMode} />
      <PlanIntelligencePanel
        places={places}
        savedPlaces={placePlans}
        visitedPlaces={visitedPlaces}
        customLists={customLists}
        friendProfiles={friendProfiles}
        onOpenPlace={onOpenPlace}
        onSavePlace={onSavePlace}
        onVisitPlace={onVisitPlace}
        onAddPlaceToList={onAddPlaceToList}
        onRemovePlaceFromList={onRemovePlaceFromList}
        onFriendProfiles={onFriendProfiles}
      />
      {planMode === "Timeline" ? (
        <>
          <PlanGroup title="Tonight" events={tonight} onRemove={onSaveEvent} onOpenDetails={onOpenDetails} />
          <PlanGroup title="This Weekend" events={weekend} onRemove={onSaveEvent} onOpenDetails={onOpenDetails} />
          <PlanGroup title="Later" events={later} onRemove={onSaveEvent} onOpenDetails={onOpenDetails} />
        </>
      ) : null}
      {planMode === "Neighborhood" ? (
        neighborhoodGroups.length ? neighborhoodGroups.map((group) => (
          <PlanGroup key={group.area} title={areaLabel(group.area)} events={group.events} onRemove={onSaveEvent} onOpenDetails={onOpenDetails} />
        )) : <EmptyPanel message="No saved events in that neighborhood yet." />
      ) : null}
      {venuePlans.length && planMode !== "Timeline" ? (
        <section>
          <SectionHeader kicker="Saved venues" title="Places that keep pulling you back." />
          <div className="grid gap-4 md:grid-cols-3">
            {venuePlans.map((venue) => <PlanVenueCard key={venue.id} venue={venue} onRemove={onSaveVenue} />)}
          </div>
        </section>
      ) : null}
      {venuePlans.length && planMode === "Timeline" ? (
        <section>
          <SectionHeader kicker="Saved venues" title="Places that keep pulling you back." />
          <FullBleedRail>
            {venuePlans.map((venue) => <div className="w-[76vw] shrink-0 snap-start sm:w-[320px]" key={venue.id}><PlanVenueCard venue={venue} onRemove={onSaveVenue} /></div>)}
          </FullBleedRail>
        </section>
      ) : null}
      {placePlans.length ? (
        <section>
          <SectionHeader kicker="Saved food + places" title="Your unified Austin list." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {placePlans.map((place) => (
              <UnifiedPlaceCard
                key={place.id}
                place={place}
                saved={savedPlaces.includes(place.id)}
                visited={visitedPlaces.includes(place.id)}
                onSave={onSavePlace}
                onVisit={onVisitPlace}
                onOpen={onOpenPlace}
              />
            ))}
          </div>
        </section>
      ) : null}
    </motion.section>
  );
}

function PlanControls({ areaFilter, sortMode, planMode, onAreaFilter, onSortMode, onPlanMode }: { areaFilter: Area | "All"; sortMode: "Soonest" | "Popular" | "Neighborhood"; planMode: "Timeline" | "Neighborhood" | "Places"; onAreaFilter: (area: Area | "All") => void; onSortMode: (mode: "Soonest" | "Popular" | "Neighborhood") => void; onPlanMode: (mode: "Timeline" | "Neighborhood" | "Places") => void }) {
  return (
    <section className="glass-panel rounded-[1.5rem] p-4">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Tune your plan</p>
          <p className="mt-1 text-sm font-bold text-bone/52">Filter by neighborhood. Sort by what matters now.</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {(["Timeline", "Neighborhood", "Places"] as const).map((mode) => (
              <FilterChip key={mode} active={planMode === mode} onClick={() => onPlanMode(mode)}>
                {mode}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <label className="flex min-w-[220px] items-center gap-3 rounded-full border border-white/28 bg-white/20 px-4 py-3 text-xs font-black text-bone/78 backdrop-blur-xl">
            <span className="shrink-0 uppercase tracking-[0.14em] text-bone/38">Location</span>
            <select
              className="min-w-0 flex-1 bg-transparent text-sm font-black text-bone outline-none"
              value={areaFilter}
              onChange={(event) => onAreaFilter(event.target.value as Area | "All")}
            >
              {(["All", ...areaFilters] as const).map((area) => (
                <option className="bg-night text-bone" key={area} value={area}>
                  {areaLabel(area)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {(["Soonest", "Popular", "Neighborhood"] as const).map((mode) => (
              <FilterChip key={mode} active={sortMode === mode} onClick={() => onSortMode(mode)}>
                {mode}
              </FilterChip>
            ))}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanVenueCard({ venue, onRemove }: { venue: VenueItem; onRemove: (id: string) => void }) {
  const eventLabel = venue.upcomingCount > 0 ? `${venue.upcomingCount} events` : `${venue.evergreenCount ?? 0} ideas`;
  return (
    <motion.article className="relative min-h-[300px] overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/8 shadow-card" whileHover={{ y: -3 }} transition={{ duration: 0.22 }}>
      <SafeImage className="object-cover opacity-76" src={venue.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 90vw, 420px" />
      <div className="image-card-fade" />
      <button className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/26 text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] backdrop-blur-xl transition hover:bg-white/70 hover:text-ink" onClick={() => onRemove(venue.id)} aria-label={`Remove ${venue.name} from plan`}>
        <X className="h-4 w-4" />
      </button>
        <div className="media-copy absolute inset-x-0 bottom-0 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{venue.neighborhoodPersonality}</p>
        <Link className="mt-2 block text-left text-3xl font-black leading-none underline-offset-4 transition hover:text-neon hover:underline" href={`/places/${venue.id}`}>
          {venue.name}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-neon/18 px-3 py-1.5 text-xs font-black text-emerald-100">{areaLabel(venue.area)}</span>
          <Link className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold transition hover:bg-white/20" href={`/places/${venue.id}`}>
            {eventLabel}
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

function PlanGroup({ title, events, onRemove, onOpenDetails }: { title: string; events: EventItem[]; onRemove: (id: string) => void; onOpenDetails: (event: EventItem) => void }) {
  if (!events.length) return null;
  return (
    <section>
      <SectionHeader kicker={String(events.length)} title={title} />
      <div className="space-y-3">
        {events.map((event) => (
          <article className="glass-panel relative grid gap-3 rounded-[1.5rem] p-3 md:grid-cols-[160px_1fr]" key={event.id}>
            <button className="absolute inset-0 z-10 cursor-pointer rounded-[1.5rem] text-left" onClick={() => onOpenDetails(event)} aria-label={`Open details for ${event.title}`} />
            <button className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/26 text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] backdrop-blur-xl transition hover:bg-white/70 hover:text-ink" onClick={() => onRemove(event.id)} aria-label={`Remove ${event.title} from plan`}>
              <X className="h-4 w-4" />
            </button>
            <div className="relative min-h-36 overflow-hidden rounded-2xl">
              <SafeImage className="object-cover" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="180px" />
            </div>
            <div className="flex flex-col justify-between gap-4 p-2">
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{dayLabel(event)}</p>
                <h3 className="mt-2 text-2xl font-black leading-tight">{event.title}</h3>
                <p className="mt-2 text-sm text-bone/58">{formatEventTime(event)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-neon/18 px-3 py-1.5 text-xs font-black text-emerald-100">{areaLabel(event.area)}</span>
                <span className="rounded-full bg-white/18 px-3 py-1.5 text-xs font-bold text-bone/72">{event.neighborhoodPersonality}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function VenuesView({
  events,
  venues,
  places,
  locationEnabled,
  savedVenues,
  savedPlaces,
  onSaveVenue,
  onSavePlace,
  onOpenPlace
}: {
  events: EventItem[];
  venues: VenueItem[];
  places: UnifiedPlace[];
  locationEnabled: boolean;
  savedVenues: string[];
  savedPlaces: string[];
  onSaveVenue: (id: string) => void;
  onSavePlace: (id: string) => void;
  onOpenPlace: (place: UnifiedPlace) => void;
}) {
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const sortedVenues = useMemo(() => [...venues].sort((a, b) => b.popularityScore - a.popularityScore || b.upcomingCount - a.upcomingCount), [venues]);
  const evergreen = sortedVenues.filter((venue) => venue.source === "evergreen" || (venue.evergreenCount ?? 0) > 0).slice(0, 12);
  const patios = sortedVenues.filter((venue) => venue.vibe.includes("patio") || venue.upcomingEventIds.some((id) => eventById.get(id)?.vibeTags.includes("Patio"))).slice(0, 12);
  const institutions = sortedVenues.filter((venue) => venue.popularityScore > 25 || venue.upcomingCount >= 8).slice(0, 12);
  const musicRooms = sortedVenues.filter((venue) => venue.upcomingEventIds.some((id) => eventById.get(id)?.vibeTags.includes("Live Music"))).slice(0, 12);
  const comedyRooms = sortedVenues.filter((venue) => venue.upcomingEventIds.some((id) => eventById.get(id)?.vibeTags.includes("Comedy"))).slice(0, 12);
  const nearby = venues.filter((venue) => typeof venue.distanceMiles === "number").sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99)).slice(0, 12);
  const restaurants = places.filter((place) => place.kind === "restaurant").slice(0, 18);
  const bars = places.filter((place) => place.kind === "bar").slice(0, 12);
  const unifiedNearby = places.filter((place) => typeof place.distanceMiles === "number").sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99)).slice(0, 12);
  const areaRows = areaFilters
    .map((area) => ({ area, venues: sortedVenues.filter((venue) => venue.area === area).slice(0, 10) }))
    .filter((row) => row.venues.length);
  return (
    <motion.section {...viewMotion} className="space-y-12 pt-6 md:space-y-16 md:pt-10">
      <PageTitle kicker="Places" title="Pick the room, then the night." copy="Browse by neighborhood when geography matters. Browse by vibe when it does not." />
      <VenueDecisionStrip />
      {locationEnabled ? <PlaceRail kicker="Near you" title="Closest food, bars, rooms" places={unifiedNearby} savedPlaces={savedPlaces} visitedPlaces={[]} onSavePlace={onSavePlace} onOpenPlace={onOpenPlace} /> : null}
      <PlaceRail kicker="ATX Eats" title="Restaurants worth anchoring around" places={restaurants} savedPlaces={savedPlaces} visitedPlaces={[]} onSavePlace={onSavePlace} onOpenPlace={onOpenPlace} />
      <PlaceRail kicker="Before or after" title="Bars and easy second stops" places={bars} savedPlaces={savedPlaces} visitedPlaces={[]} onSavePlace={onSavePlace} onOpenPlace={onOpenPlace} />
      {locationEnabled ? <VenueRail kicker="Near you" title="Closest with a pulse" venues={nearby} savedVenues={savedVenues} onSaveVenue={onSaveVenue} /> : null}
      <VenueRail kicker="Always good" title="Popular hang outs" venues={evergreen} savedVenues={savedVenues} onSaveVenue={onSaveVenue} />
      <section id="neighborhoods" className="scroll-mt-28">
        <SectionHeader kicker="Browse by neighborhood" title="Where do you want to end up?" />
        <div className="space-y-8">
          {areaRows.map((row) => (
            <VenueRail key={row.area} kicker={String(row.venues.length)} title={areaLabel(row.area)} venues={row.venues} savedVenues={savedVenues} onSaveVenue={onSaveVenue} compact />
          ))}
        </div>
      </section>
      <section id="vibes" className="scroll-mt-28">
        <SectionHeader kicker="Browse by kind of night" title="What are you in the mood for?" />
        <div className="space-y-8">
          <VenueRail kicker="Open air" title="Patio Weather" venues={patios} savedVenues={savedVenues} onSaveVenue={onSaveVenue} compact />
          <VenueRail kicker="Rooms" title="Live Music Institutions" venues={institutions} savedVenues={savedVenues} onSaveVenue={onSaveVenue} compact />
          <VenueRail kicker="Sound" title="Music-first rooms" venues={musicRooms} savedVenues={savedVenues} onSaveVenue={onSaveVenue} compact />
          <VenueRail kicker="Laughs" title="Comedy-adjacent places" venues={comedyRooms} savedVenues={savedVenues} onSaveVenue={onSaveVenue} compact />
        </div>
      </section>
    </motion.section>
  );
}

function VenueDecisionStrip() {
  const items = [
    { label: "Start with place", href: "#neighborhoods", icon: MapPin },
    { label: "Start with vibe", href: "#vibes", icon: Sparkles },
    { label: "Need a classic", href: "/explore?vibe=Popular", icon: Flame }
  ];
  return (
      <section className="grid gap-3 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link className="glass-panel group flex items-center gap-3 rounded-[1.25rem] p-4 transition hover:-translate-y-0.5 hover:border-neon/35 hover:bg-white/10" href={item.href} key={item.label}>
            <InlineLottieIcon label={item.label === "Start with place" ? "East Side" : "Weird Austin"} icon={Icon} />
            <span className="text-sm font-black">{item.label}</span>
          </Link>
        );
      })}
    </section>
  );
}

function VenueRail({ title, kicker, venues, savedVenues, onSaveVenue, compact = false }: { title: string; kicker: string; venues: VenueItem[]; savedVenues: string[]; onSaveVenue: (id: string) => void; compact?: boolean }) {
  if (!venues.length) return null;
  return (
    <section>
      <SectionHeader kicker={kicker} title={title} />
      <FullBleedRail>
        {venues.map((venue) => (
          <div className={cn("shrink-0 snap-start", compact ? "w-[72vw] sm:w-[300px]" : "w-[78vw] sm:w-[340px]")} key={venue.id}>
            <VenueCard venue={venue} saved={savedVenues.includes(venue.id)} onSave={onSaveVenue} />
          </div>
        ))}
      </FullBleedRail>
    </section>
  );
}

function EditorialSection({ title, kicker, events, savedEvents, onSave, onOpenDetails, variant }: { title: string; kicker: string; events: EventItem[]; savedEvents: string[]; onSave: (id: string) => void; onOpenDetails: (event: EventItem) => void; variant: "mosaic" | "rail" | "stack" }) {
  if (!events.length) return null;
  return (
    <section>
      <SectionHeader kicker={kicker} title={title} />
      {variant === "rail" ? (
        <div className="-mx-3 flex gap-4 overflow-x-auto px-3 py-6 hide-scrollbar">
          {events.map((event) => <div className="w-[78vw] shrink-0 sm:w-[360px]" key={event.id}><EventCard event={event} saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} /></div>)}
        </div>
      ) : (
        <div className={cn("grid gap-4", variant === "mosaic" ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {events.map((event, index) => <EventCard event={event} key={event.id} size={variant === "mosaic" && index === 0 ? "tall" : "default"} saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />)}
        </div>
      )}
    </section>
  );
}

function EventCard({ event, saved, onSave, onOpenDetails, size = "default", tone = "dark" }: { event: EventItem; saved: boolean; onSave: (id: string) => void; onOpenDetails: (event: EventItem) => void; size?: "default" | "compact" | "hero" | "tall" | "carousel"; tone?: "dark" | "light" }) {
  const light = tone === "light";
  const prominent = size === "hero" || size === "tall" || size === "carousel";
  return (
    <motion.article
      className={cn("group relative overflow-hidden rounded-[1.65rem] border shadow-card transition-colors", light ? "border-white/70 bg-white/78 text-ink backdrop-blur-xl" : "border-white/24 bg-white/[0.12]", size === "carousel" ? "h-[62vh] min-h-[430px] max-h-[620px]" : size === "hero" ? "min-h-[380px]" : size === "tall" ? "min-h-[420px]" : size === "compact" ? "min-h-[255px]" : "min-h-[330px]")}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <button className="absolute inset-0 z-10 cursor-pointer text-left" onClick={() => onOpenDetails(event)} aria-label={`Open details for ${event.title}`} />
      <SafeImage className="object-cover transition duration-700 group-hover:scale-105" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 90vw, 420px" />
      <div className="image-card-fade" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="media-chip rounded-full bg-white/26 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-bone/88 backdrop-blur-xl">{dayLabel(event)}</span>
        <button className={cn("relative z-20 grid h-10 w-10 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-xl transition", saved ? "bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)]" : "bg-white/26 text-bone hover:bg-white/70 hover:text-ink")} onClick={(click) => { click.stopPropagation(); onSave(event.id); }} aria-label={saved ? "Unsave event" : "Save event"}>
          <Heart className={cn("h-5 w-5", saved && "fill-current")} />
        </button>
      </div>
      <div className="media-copy absolute inset-x-0 bottom-0 p-4">
        {prominent ? <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-neon">{event.neighborhoodPersonality}</p> : null}
        <h3 className={cn("break-words font-black leading-[1.04] tracking-[-0.02em]", size === "hero" ? "text-3xl md:text-5xl" : "text-2xl")}>{event.title}</h3>
        <p className="mt-2 line-clamp-1 text-xs font-semibold text-bone/66">{event.venueName} · {areaLabel(event.area)}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="media-chip inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-2 text-xs font-bold text-bone/90 backdrop-blur-xl">
            <CalendarDays className="h-4 w-4 text-emerald-100" />
            {prominent ? formatEventTime(event) : `${dayLabel(event)} · ${formatEventTime(event)}`}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function VenueSection({ title, venues, savedVenues, onSaveVenue }: { title: string; venues: VenueItem[]; savedVenues: string[]; onSaveVenue: (id: string) => void }) {
  if (!venues.length) return null;
  return (
    <section>
      <SectionHeader kicker={String(venues.length)} title={title} />
      <div className="grid gap-4 md:grid-cols-3">
        {venues.map((venue) => <VenueCard key={venue.id} venue={venue} saved={savedVenues.includes(venue.id)} onSave={onSaveVenue} />)}
      </div>
    </section>
  );
}

function VenueCard({ venue, saved, onSave }: { venue: VenueItem; saved: boolean; onSave: (id: string) => void }) {
  const eventLabel = venue.upcomingCount > 0 ? `${venue.upcomingCount} events` : `${venue.evergreenCount ?? 0} ideas`;
  return (
    <motion.article className="relative min-h-[300px] overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/8 shadow-card" whileHover={{ y: -3 }} transition={{ duration: 0.22 }}>
      <SafeImage className="object-cover opacity-76" src={venue.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 90vw, 420px" />
      <div className="image-card-fade" />
      <button className={cn("absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-xl transition", saved ? "bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)]" : "bg-white/26 text-bone hover:bg-white/70 hover:text-ink")} onClick={() => onSave(venue.id)} aria-label={saved ? "Unsave venue" : "Save venue"}>
        <Heart className={cn("h-5 w-5", saved && "fill-current")} />
      </button>
      <div className="media-copy absolute inset-x-0 bottom-0 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{venue.neighborhoodPersonality}</p>
        <Link className="mt-2 block text-left text-3xl font-black leading-none underline-offset-4 transition hover:text-neon hover:underline" href={`/places/${venue.id}`}>
          {venue.name}
        </Link>
        <p className="mt-3 text-sm font-semibold leading-6 text-bone/68">{venue.vibe}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Link className="rounded-full bg-white/12 px-3 py-2 text-xs font-bold transition hover:bg-white/20" href={`/places/${venue.id}`}>
            {eventLabel}
          </Link>
          {venue.venueUrl ? (
            <a className="inline-flex items-center gap-2 rounded-full bg-bone px-3 py-2 text-xs font-black text-ink" href={venue.venueUrl} target="_blank" rel="noreferrer">
              Visit <Navigation className="h-4 w-4" />
            </a>
          ) : (
            <a className="inline-flex items-center gap-2 rounded-full bg-bone px-3 py-2 text-xs font-black text-ink" href={venue.mapUrl} target="_blank" rel="noreferrer">
              Map <Navigation className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function UnifiedPlaceCard({
  place,
  saved,
  visited,
  onSave,
  onVisit,
  onOpen
}: {
  place: UnifiedPlace;
  saved: boolean;
  visited: boolean;
  onSave: (id: string) => void;
  onVisit: (id: string) => void;
  onOpen: (place: UnifiedPlace) => void;
}) {
  return (
    <motion.article className="group relative min-h-[310px] overflow-hidden rounded-[1.65rem] border border-white/14 bg-white/10 shadow-card" whileHover={{ y: -3 }} transition={{ duration: 0.22 }}>
      <button className="absolute inset-0 z-10 cursor-pointer text-left" onClick={() => onOpen(place)} aria-label={`Open details for ${place.name}`} />
      <SafeImage className="object-cover opacity-78 transition duration-700 group-hover:scale-105" src={place.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 90vw, 420px" />
      <div className="image-card-fade" />
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
        <span className="media-chip rounded-full bg-white/28 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-bone backdrop-blur-xl">
          {placeKindLabel(place.kind)}
        </span>
        <div className="flex gap-2">
          <button className={cn("grid h-10 w-10 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-xl transition", visited ? "bg-white text-ink" : "bg-white/24 text-bone hover:bg-white/70 hover:text-ink")} onClick={(click) => { click.stopPropagation(); onVisit(place.id); }} aria-label={visited ? "Mark unvisited" : "Mark visited"}>
            <Check className="h-5 w-5" />
          </button>
          <button className={cn("grid h-10 w-10 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-xl transition", saved ? "bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)]" : "bg-white/24 text-bone hover:bg-white/70 hover:text-ink")} onClick={(click) => { click.stopPropagation(); onSave(place.id); }} aria-label={saved ? "Unsave place" : "Save place"}>
            <Heart className={cn("h-5 w-5", saved && "fill-current")} />
          </button>
        </div>
      </div>
      <div className="media-copy absolute inset-x-0 bottom-0 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{place.neighborhoodPersonality}</p>
        <h3 className="mt-2 text-3xl font-black leading-none tracking-[-0.025em]">{place.name}</h3>
        <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-bone/68">
          {place.price ? `${place.price} · ` : ""}{place.vibe}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-neon/18 px-3 py-1.5 text-xs font-black text-emerald-100">{areaLabel(place.area)}</span>
          {formatDistance(place.distanceMiles) ? <span className="rounded-full bg-white/14 px-3 py-1.5 text-xs font-bold text-bone/72">{formatDistance(place.distanceMiles)}</span> : null}
          {place.articleTitles.length ? <span className="rounded-full bg-white/14 px-3 py-1.5 text-xs font-bold text-bone/72">{place.articleTitles.length} guides</span> : null}
        </div>
      </div>
    </motion.article>
  );
}

function placeKindLabel(kind: UnifiedPlace["kind"]) {
  if (kind === "event-spot") return "Event spot";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function PlanIntelligencePanel({
  places,
  savedPlaces,
  visitedPlaces,
  customLists,
  friendProfiles,
  onOpenPlace,
  onSavePlace,
  onVisitPlace,
  onAddPlaceToList,
  onRemovePlaceFromList,
  onFriendProfiles
}: {
  places: UnifiedPlace[];
  savedPlaces: UnifiedPlace[];
  visitedPlaces: string[];
  customLists: Record<string, string[]>;
  friendProfiles: FriendTasteProfile[];
  onOpenPlace: (place: UnifiedPlace) => void;
  onSavePlace: (id: string) => void;
  onVisitPlace: (id: string) => void;
  onAddPlaceToList: (listName: string, placeId: string) => void;
  onRemovePlaceFromList: (listName: string, placeId: string) => void;
  onFriendProfiles: (next: FriendTasteProfile[] | ((current: FriendTasteProfile[]) => FriendTasteProfile[])) => void;
}) {
  const [profileDraft, setProfileDraft] = useState("");
  const topSaved = savedPlaces.slice(0, 3);
  const friendMatch = useMemo(() => {
    const friendTags = new Set(friendProfiles.flatMap((profile) => profile.tasteTags));
    return places
      .filter((place) => place.tags.some((tag) => friendTags.has(tag)) || place.vibeTags.some((tag) => friendTags.has(tag)))
      .slice(0, 3);
  }, [friendProfiles, places]);

  function importFriend() {
    try {
      const parsed = JSON.parse(profileDraft) as FriendTasteProfile;
      if (!Array.isArray(parsed.saved) || !Array.isArray(parsed.tasteTags)) return;
      onFriendProfiles((current) => uniqBy([{ ...parsed, id: parsed.id || crypto.randomUUID(), name: parsed.name || "Austin friend" }, ...current], (profile) => profile.id));
      setProfileDraft("");
    } catch {
      setProfileDraft("");
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="glass-panel rounded-[1.5rem] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Lists + context</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.02em]">Your food memory is part of the plan.</h2>
          </div>
          <ListPlus className="h-5 w-5 shrink-0 text-emerald-100" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {Object.entries(customLists).slice(0, 3).map(([name, ids]) => (
            <div className="rounded-[1.15rem] border border-white/14 bg-white/10 p-3" key={name}>
              <p className="text-sm font-black">{name}</p>
              <p className="mt-1 text-xs font-bold text-bone/48">{ids.length} saved places</p>
              <div className="mt-3 flex flex-wrap gap-2">
              {topSaved[0] ? (
                <button className="mt-3 rounded-full bg-white/14 px-3 py-2 text-[11px] font-black text-bone/72 transition hover:bg-white/24" onClick={() => onAddPlaceToList(name, topSaved[0].id)}>
                  Add {topSaved[0].name}
                </button>
              ) : null}
              {ids[0] ? (
                <button className="mt-3 rounded-full bg-white/14 px-3 py-2 text-[11px] font-black text-bone/72 transition hover:bg-white/24" onClick={() => onRemovePlaceFromList(name, ids[0])}>
                  Remove one
                </button>
              ) : null}
              </div>
            </div>
          ))}
        </div>
        {topSaved.length ? (
          <div className="mt-5 grid gap-2">
            {topSaved.map((place) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/12 px-3 py-3 text-left transition hover:bg-white/20" key={place.id}>
                <button className="min-w-0 flex-1 text-left" onClick={() => onOpenPlace(place)}>
                  <span className="block text-sm font-black">{place.name}</span>
                  <span className="mt-1 block text-xs font-bold text-bone/48">{visitedPlaces.includes(place.id) ? "Visited" : "Need to try"} · {place.vibe}</span>
                </button>
                <button className="rounded-full bg-white/12 px-3 py-1.5 text-[10px] font-black text-bone/70" onClick={() => onVisitPlace(place.id)}>
                  {visitedPlaces.includes(place.id) ? "Undo" : "Visited"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="glass-panel rounded-[1.5rem] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Group tools</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.02em]">Friends stay one layer deeper.</h2>
          </div>
          <Users className="h-5 w-5 shrink-0 text-emerald-100" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-2 text-xs font-black text-bone/72 transition hover:bg-white/24" onClick={() => {
            const profile = {
              id: crypto.randomUUID(),
              name: "My Austin taste",
              saved: savedPlaces.map((place) => place.id),
              visited: visitedPlaces,
              tasteTags: uniq(savedPlaces.flatMap((place) => place.tags)).slice(0, 12),
              exportedAt: new Date().toISOString()
            };
            navigator.clipboard?.writeText(JSON.stringify(profile, null, 2));
          }}>
            <Share2 className="h-4 w-4" /> Copy profile
          </button>
          <button className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-2 text-xs font-black text-bone/72 transition hover:bg-white/24" onClick={importFriend}>
            <Copy className="h-4 w-4" /> Import draft
          </button>
        </div>
        <textarea
          className="mt-4 min-h-24 w-full resize-none rounded-[1.15rem] border border-white/18 bg-white/12 p-3 text-sm font-semibold text-bone outline-none placeholder:text-bone/34"
          value={profileDraft}
          onChange={(event) => setProfileDraft(event.target.value)}
          placeholder="Paste an ATX Eats friend profile JSON..."
        />
        <p className="mt-3 text-xs font-bold leading-5 text-bone/44">{friendProfiles.length} friend profiles imported. Halfway picks use shared taste signals without taking over the main navigation.</p>
        {friendMatch.length ? (
          <div className="mt-4 grid gap-2">
            {friendMatch.map((place) => (
              <button className="rounded-2xl bg-white/12 px-3 py-3 text-left text-sm font-black transition hover:bg-white/20" key={place.id} onClick={() => onOpenPlace(place)}>
                {place.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PageTitle({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div className="max-w-4xl">
      <p className="inline-flex rounded-full border border-white/28 bg-white/28 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-bone/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-xl">{kicker}</p>
      <h1 className="mt-4 font-display text-5xl font-black leading-[0.92] tracking-[-0.04em] text-balance md:text-7xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-bone/72">{copy}</p>
    </div>
  );
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/90">{kicker}</p>
        <h2 className="mt-2 font-display text-3xl font-black leading-none tracking-[-0.035em] md:text-5xl">{title}</h2>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-black transition", active ? "bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.24)]" : "bg-white/18 text-bone/72 hover:bg-white/28 hover:text-bone")} onClick={onClick}>
      {children}
    </button>
  );
}

function DateCalendarPicker({
  calendarMonth,
  dateMode,
  endDate,
  locationEnabled,
  onClearDates,
  onMonthChange,
  onPickDate,
  onQuickPick,
  startDate
}: {
  calendarMonth: Date;
  dateMode: "Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby";
  endDate: string;
  locationEnabled: boolean;
  onClearDates: () => void;
  onMonthChange: (date: Date) => void;
  onPickDate: (value: string) => void;
  onQuickPick: (mode: "Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby") => void;
  startDate: string;
}) {
  const [hoverDate, setHoverDate] = useState("");
  const days = calendarDays(calendarMonth);
  const monthLabel = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const quickPicks: Array<"Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby"> = ["Any", "Today", "Tomorrow", "Weekend", "Range", ...(locationEnabled ? ["Nearby" as const] : [])];
  const selectedSummary = dateLabel(dateMode, startDate, endDate);
  const todayKey = localDateKey(new Date());
  const previewingRange = dateMode === "Range" && startDate && !endDate && hoverDate && hoverDate !== startDate;
  const previewStart = previewingRange ? (hoverDate < startDate ? hoverDate : startDate) : "";
  const previewEnd = previewingRange ? (hoverDate > startDate ? hoverDate : startDate) : "";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
      <div className="rounded-[1.25rem] bg-white/8 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-mezcal">Make a date</p>
        <h3 className="mt-2 text-2xl font-black leading-tight">Pick one day or build a range.</h3>
        <div className="mt-5 flex flex-wrap gap-2">
          {quickPicks.map((item) => (
            <FilterChip
              key={item}
              active={dateMode === item}
              onClick={() => {
                setHoverDate("");
                onQuickPick(item);
              }}
            >
              {item === "Range" ? "Date range" : item}
            </FilterChip>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-night/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bone/42">Selected</p>
            {dateMode !== "Any" ? (
              <button className="rounded-full bg-white/8 px-3 py-1.5 text-[10px] font-black text-bone/58 transition hover:bg-white/14 hover:text-bone" onClick={onClearDates}>
                Clear
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-black text-bone">{selectedSummary}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className={cn("rounded-2xl border p-3", startDate ? "border-neon/40 bg-neon/10" : "border-white/10 bg-white/6")}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bone/42">Start</p>
              <p className="mt-1 text-sm font-black">{startDate ? shortDate(startDate) : "Choose date"}</p>
            </div>
            <div className={cn("rounded-2xl border p-3", endDate ? "border-neon/40 bg-neon/10" : "border-white/10 bg-white/6")}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bone/42">End</p>
              <p className="mt-1 text-sm font-black">{endDate ? shortDate(endDate) : startDate ? "Tap another day" : "Optional"}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-bone/48">
            {startDate && !endDate && dateMode === "Range" ? "Now hover, then tap the last day to save the range." : "For one day, tap once. For a range, tap the first day and then the last day."}
          </p>
        </div>
      </div>
      <div className="rounded-[1.25rem] border border-white/10 bg-black/24 p-3">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <button className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-bone/70 transition hover:bg-white/14 hover:text-bone" onClick={() => onMonthChange(addMonths(calendarMonth, -1))} aria-label="Previous month">
            ‹
          </button>
          <p className="text-sm font-black">{monthLabel}</p>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-bone/70 transition hover:bg-white/14 hover:text-bone" onClick={() => onMonthChange(addMonths(calendarMonth, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 px-1 pb-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-bone/38">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const value = localDateKey(day.date);
            const past = value < todayKey;
            const selectedStart = value === startDate;
            const selectedEnd = value === endDate;
            const inRange = Boolean(startDate && endDate && value > startDate && value < endDate);
            const inPreviewRange = Boolean(previewStart && previewEnd && value > previewStart && value < previewEnd);
            const previewEndpoint = Boolean(previewingRange && (value === hoverDate || value === startDate));
            const quickSelected = isQuickDateSelection(value, dateMode);
            const today = value === todayKey;
            return (
              <button
                className={cn(
                  "grid aspect-square min-h-10 place-items-center rounded-2xl text-sm font-black transition",
                  !day.inMonth && "text-bone/22",
                  past && "cursor-not-allowed bg-white/[0.03] text-bone/18",
                  day.inMonth && !past && !selectedStart && !selectedEnd && !inRange && !inPreviewRange && !previewEndpoint && !quickSelected && "bg-white/6 text-bone/70 hover:bg-white/12 hover:text-bone",
                  (inRange || inPreviewRange) && "bg-neon/18 text-bone ring-1 ring-neon/18",
                  quickSelected && "bg-neon/22 text-bone ring-1 ring-neon/50",
                  (selectedStart || selectedEnd || previewEndpoint) && "bg-neon text-ink shadow-[0_0_24px_rgba(48,209,88,0.24)]",
                  today && !selectedStart && !selectedEnd && !quickSelected && "ring-1 ring-neon/45"
                )}
                disabled={past}
                key={value}
                onClick={() => {
                  setHoverDate("");
                  onPickDate(value);
                }}
                onFocus={() => !past && setHoverDate(value)}
                onMouseEnter={() => !past && setHoverDate(value)}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BrowseButton({ label, value, active, open, onClick }: { label: string; value: string; active: boolean; open: boolean; onClick: () => void }) {
  return (
    <button
      className={cn(
        "inline-flex h-11 max-w-[54vw] shrink-0 items-center gap-2 rounded-full border px-3 text-left text-xs font-black transition sm:max-w-full",
        active || open ? "border-neon/45 bg-neon/22 text-bone shadow-[0_8px_24px_rgba(48,209,88,0.18)]" : "border-white/28 bg-white/18 text-bone/72 hover:bg-white/28 hover:text-bone"
      )}
      onClick={onClick}
    >
      <span className="min-w-0 truncate sm:max-w-[190px]">
        <span className="text-bone/45">{label}</span>
        <span className="text-bone/38">:</span> {value}
      </span>
      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black", active || open ? "bg-neon text-emerald-950" : "bg-white/20 text-bone/70")}>
        {open ? "x" : "+"}
      </span>
    </button>
  );
}

function dateLabel(mode: "Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby", startDate: string, endDate: string) {
  if (mode !== "Range") return mode;
  if (startDate && endDate && startDate !== endDate) return `${shortDate(startDate)}-${shortDate(endDate)}`;
  if (startDate) return shortDate(startDate);
  return "Pick dates";
}

function calendarDays(month: Date) {
  const first = monthStart(month);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inMonth: date.getMonth() === first.getMonth() };
  });
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function parseDateKey(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupEventsByDayAndTime(events: EventItem[]) {
  const groups = new Map<string, { id: string; day: string; timeLabel: string; events: EventItem[] }>();
  events.forEach((event) => {
    const start = new Date(event.startDateTime);
    const dateKey = Number.isFinite(start.getTime()) ? localDateKey(start) : event.date || "unknown";
    const period = eventTimePeriod(event);
    const id = `${dateKey}-${period.id}`;
    const existing = groups.get(id);
    if (existing) {
      existing.events.push(event);
      return;
    }
    groups.set(id, {
      id,
      day: eventDayHeading(event),
      timeLabel: period.label,
      events: [event]
    });
  });
  return Array.from(groups.values());
}

function eventDayHeading(event: EventItem) {
  if (isToday(event)) return "Today";
  if (isTomorrow(event)) return "Tomorrow";
  return dayLabel(event);
}

function eventTimePeriod(event: EventItem) {
  const hour = eventHour(event);
  if (hour < 12) return { id: "morning", label: "Morning" };
  if (hour < 17) return { id: "afternoon", label: "Afternoon" };
  if (hour < 22) return { id: "evening", label: "Evening" };
  return { id: "late", label: "Late night" };
}

function isQuickDateSelection(value: string, mode: "Any" | "Today" | "Tomorrow" | "Weekend" | "Range" | "Nearby") {
  const today = new Date();
  const todayKey = localDateKey(today);
  if (mode === "Today") return value === todayKey;
  if (mode === "Tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return value === localDateKey(tomorrow);
  }
  if (mode === "Weekend") {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const saturday = new Date(start);
    saturday.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7));
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    return value === localDateKey(saturday) || value === localDateKey(sunday);
  }
  return false;
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function personalizedScore(event: EventItem, preferredVibes: VibeTag[], preferredAreas: Area[]) {
  const vibeBoost = event.vibeTags.reduce((score, tag) => score + (preferredVibes.includes(tag) ? 9 : 0), 0);
  const areaBoost = preferredAreas.includes(event.area) ? 12 : 0;
  const distanceBoost = typeof event.distanceMiles === "number" ? Math.max(0, 18 - event.distanceMiles * 2) : 0;
  return event.scores.smart + vibeBoost + areaBoost + distanceBoost;
}

function dedupeHomepageEvents(events: EventItem[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${normalizeEventIdentity(event.title)}|${normalizeEventIdentity(event.venueName)}|${eventWeekKey(event)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function allocateExplorePlans(events: EventItem[], places: UnifiedPlace[]) {
  const ranked = dedupeHomepageEvents([...events].sort((a, b) => articleEventScore(b) - articleEventScore(a) || sortSoonest(a, b)));
  const soonest = dedupeHomepageEvents([...events].sort(sortSoonest));
  const today = ranked.filter((event) => isToday(event));
  const tomorrow = ranked.filter((event) => isTomorrow(event));
  const primaryPool = today.length ? today : tomorrow.length ? tomorrow : ranked;
  const used = new Set<string>();
  let dailyPlans = buildPlansFromAnchors(primaryPool, places, 6, used, "daily");
  if (dailyPlans.length < 6) {
    dailyPlans = [...dailyPlans, ...buildPlansFromAnchors(ranked, places, 6 - dailyPlans.length, used, "daily-fallback")];
  }

  const weeklyPool = ranked.filter((event) => isWithinNextDays(event, 7));
  let weeklyPlans = buildPlansFromAnchors(weeklyPool, places, 4, used, "week");
  if (weeklyPlans.length < 4) {
    weeklyPlans = [...weeklyPlans, ...buildPlansFromAnchors(weeklyPool.length ? weeklyPool : ranked, places, 4 - weeklyPlans.length, new Set(weeklyPlans.map((article) => exploreEventKey(article.featuredEvent))), "week-fill")];
  }

  return {
    heroPlan: dailyPlans[0],
    supportingPlans: dailyPlans.slice(1, 6),
    weeklyPlans: weeklyPlans.slice(0, 4),
    soonestPlans: buildPlansFromAnchors(soonest, places, 5, new Set(), "soonest"),
    mostBrowsedPlans: buildPlansFromAnchors(ranked, places, 5, new Set(), "browsed")
  };
}

function buildPlansFromAnchors(anchors: EventItem[], places: UnifiedPlace[], count: number, used: Set<string>, namespace: string) {
  const plans: GeneratedExploreArticle[] = [];
  anchors.forEach((event, index) => {
    if (plans.length >= count) return;
    const key = exploreEventKey(event);
    if (used.has(key)) return;
    const plan = buildGeneratedMoseyForEvent(event, places, namespace, index);
    if (!plan) return;
    used.add(key);
    plans.push(plan);
  });
  return plans;
}

function buildGeneratedMoseyForEvent(anchor: EventItem, places: UnifiedPlace[], context: string, index: number) {
  const plan = buildGeneratedMosey(anchor, places, `${moseyTemplateIdForEvent(anchor)}-${context}`, moseyToneForEvent(anchor), index);
  if (!plan) return null;
  const { completeness: _completeness, index: _index, ...article } = plan;
  return article;
}

function moseyTemplateIdForEvent(event: EventItem) {
  if (hasVibe(event, "Date Night")) return "date-night-not-trying";
  if (hasVibe(event, "Comedy") || /comedy|stand.?up|improv/i.test(`${event.title} ${event.category}`)) return "comedy-before-after";
  if (event.isFree || hasVibe(event, "Free")) return "free-things-real-plan";
  if (hasVibe(event, "Wellness", "Outdoors") && eventHour(event) < 14) return "wellness-morning-brunch";
  if (hasVibe(event, "Dancing", "Late Night", "Social") && eventHour(event) >= 18) return "dinner-drinks-dance-floor";
  if (hasVibe(event, "Popular", "Live Music", "Dancing") || event.attendeeCount > 80) return "group-chat-picked-plan";
  return "solid-plan";
}

function moseyToneForEvent(event: EventItem): "lime" | "orange" | "blue" {
  if (hasVibe(event, "Date Night", "Dancing", "Late Night")) return "orange";
  if (hasVibe(event, "Comedy", "Weird Austin", "Under the Radar")) return "blue";
  return "lime";
}

function planFoodDrinkStops(article: GeneratedExploreArticle) {
  const stops = [article.before, article.after, article.bonus].filter(Boolean) as MoseyStop[];
  return [
    ...stops.filter((stop) => stop.place.kind === "restaurant" || stop.place.kind === "bar"),
    ...stops.filter((stop) => stop.place.kind !== "restaurant" && stop.place.kind !== "bar")
  ];
}

function explorePlanLabel(article: GeneratedExploreArticle) {
  if (isToday(article.featuredEvent) && (article.timeOfDay === "evening" || article.timeOfDay === "late")) return "Tonight near you";
  if (isToday(article.featuredEvent)) return "Today plan";
  if (isTomorrow(article.featuredEvent)) return "Tomorrow plan";
  return "Plan guide";
}

function eventAtVenueTitle(event: EventItem) {
  return `${event.title} at ${event.venueName}`;
}

function isWithinNextDays(event: EventItem, days: number) {
  const start = new Date(event.startDateTime).getTime();
  if (!Number.isFinite(start)) return false;
  const now = new Date();
  return start >= now.getTime() && start <= now.getTime() + days * 24 * 60 * 60 * 1000;
}

function allocateExploreEvents(events: EventItem[], places: UnifiedPlace[], maxAppearances = 2) {
  const counts = new Map<string, number>();
  const ranked = [...events].sort((a, b) => b.popularityScore + b.attendeeCount / 24 - (a.popularityScore + a.attendeeCount / 24) || sortSoonest(a, b));
  const soonest = [...events].sort(sortSoonest);
  const guideDefinitions: Array<{ label: string; title: string; copy: string; tone: "lime" | "orange" | "blue"; candidates: EventItem[] }> = [
    {
      label: "Tonight near you",
      title: "Start with tonight, then add the easy nearby stop.",
      copy: "A strong event anchor with nearby food, bars, or rooms that keep the plan moving.",
      tone: "lime",
      candidates: ranked.filter((event) => isTonight(event) || isToday(event))
    },
    {
      label: "Live music night",
      title: "Let a room set the tone.",
      copy: "Music-first plans with nearby options for the before or after.",
      tone: "blue",
      candidates: ranked.filter((event) => event.vibeTags.includes("Live Music") || /music|dj|concert|band/i.test(`${event.title} ${event.category}`))
    },
    {
      label: "Free plans",
      title: "Good plans without a ticket tax.",
      copy: "Free anchors with enough nearby context to make leaving the house feel easy.",
      tone: "lime",
      candidates: ranked.filter((event) => event.isFree || event.vibeTags.includes("Free"))
    },
    {
      label: "Date night",
      title: "A low-pressure plan with a clear next move.",
      copy: "Event-led date plans with food or drinks nearby, not a giant decision tree.",
      tone: "orange",
      candidates: ranked.filter((event) => event.vibeTags.includes("Date Night"))
    },
    {
      label: "Weekend anchors",
      title: "Weekend events worth planning around.",
      copy: "Bigger Austin outings with supporting stops close enough to keep the night fluid.",
      tone: "blue",
      candidates: ranked.filter((event) => isThisWeekend(event) || isNextWeek(event))
    },
    {
      label: "Before + after",
      title: "Pick the event, then make the rest obvious.",
      copy: "Useful anchors that pair naturally with nearby food, patios, bars, or coffee.",
      tone: "orange",
      candidates: ranked
    }
  ];

  function keyFor(event: EventItem) {
    return exploreEventKey(event);
  }

  function canUse(event: EventItem) {
    return (counts.get(keyFor(event)) ?? 0) < maxAppearances;
  }

  function mark(event: EventItem) {
    const key = keyFor(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return event;
  }

  function take(candidates: EventItem[], count: number, exclude: EventItem[] = []) {
    const excluded = new Set(exclude.map(keyFor));
    const picked: EventItem[] = [];
    for (const event of candidates) {
      const key = keyFor(event);
      if (excluded.has(key) || !canUse(event) || picked.some((item) => keyFor(item) === key)) continue;
      picked.push(mark(event));
      if (picked.length >= count) break;
    }
    return picked;
  }

  const guideCards: ExploreGuideCard[] = [];
  for (const definition of guideDefinitions) {
    const anchor = take(definition.candidates.length ? definition.candidates : ranked, 1)[0];
    if (!anchor) continue;
    const nearbyEvents = take(findNearbySameTimeEvents(anchor, ranked), 2, [anchor]);
    guideCards.push({
      id: `guide-${definition.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${anchor.id}`,
      label: definition.label,
      title: definition.title,
      copy: definition.copy,
      anchor,
      nearbyEvents,
      addOns: findNearbyAddOns(anchor, places),
      tone: definition.tone
    });
  }

  const sidebarPromo = take(ranked.filter((event) => isTonight(event) || isToday(event)), 1)[0] ?? take(ranked, 1)[0];
  const soonestCalendar = take(soonest, 5);
  const mostBrowsed = take(ranked, 5);
  const sidebarPlace = places
    .filter((place) => place.kind === "restaurant" || place.kind === "bar" || place.kind === "venue")
    .sort((a, b) => b.popularityScore + b.upcomingCount * 8 - (a.popularityScore + a.upcomingCount * 8))[0];

  return { guideCards, sidebarPromo, sidebarPlace, soonestCalendar, mostBrowsed };
}

function generateExplorePlanArticles(events: EventItem[], places: UnifiedPlace[]) {
  const ranked = dedupeHomepageEvents([...events].sort((a, b) => articleEventScore(b) - articleEventScore(a) || sortSoonest(a, b)));
  const today = ranked.filter((event) => isToday(event));
  const tomorrow = ranked.filter((event) => isTomorrow(event));
  const weekend = ranked.filter((event) => isThisWeekend(event) && !isToday(event) && !isTomorrow(event));
  const fallback = ranked.filter((event) => !isToday(event) && !isTomorrow(event) && !isThisWeekend(event));
  const anchorPool = dedupeHomepageEvents([...today, ...tomorrow, ...weekend, ...fallback]);
  const usedEvents = new Set<string>();
  const templates: Array<{
    id: string;
    tone: "lime" | "orange" | "blue";
    matches: (event: EventItem) => boolean;
  }> = [
    {
      id: "east-side-girl-dinner-show",
      tone: "orange",
      matches: (event) => event.area === "East Side" && (hasVibe(event, "Live Music", "Comedy", "Dancing", "Social") || isTonight(event))
    },
    {
      id: "wellness-morning-brunch",
      tone: "lime",
      matches: (event) => hasVibe(event, "Wellness", "Outdoors") && eventHour(event) < 14
    },
    {
      id: "hot-girl-walk-plan",
      tone: "blue",
      matches: (event) => hasVibe(event, "Outdoors", "Wellness", "Low-Key") && ["Barton/Zilker", "Central", "East Side"].includes(event.area)
    },
    {
      id: "dinner-drinks-dance-floor",
      tone: "orange",
      matches: (event) => hasVibe(event, "Dancing", "Late Night", "Social") && eventHour(event) >= 18
    },
    {
      id: "free-things-real-plan",
      tone: "lime",
      matches: (event) => event.isFree || hasVibe(event, "Free")
    },
    {
      id: "comedy-before-after",
      tone: "blue",
      matches: (event) => hasVibe(event, "Comedy") || /comedy|stand.?up|improv/i.test(`${event.title} ${event.category}`)
    },
    {
      id: "barton-springs-day",
      tone: "lime",
      matches: (event) => event.area === "Barton/Zilker" && (hasVibe(event, "Outdoors", "Wellness", "Social") || eventHour(event) < 18)
    },
    {
      id: "date-night-not-trying",
      tone: "orange",
      matches: (event) => hasVibe(event, "Date Night", "Low-Key", "Live Music", "Comedy") && eventHour(event) >= 17
    },
    {
      id: "weird-austin-cute",
      tone: "blue",
      matches: (event) => hasVibe(event, "Weird Austin", "Under the Radar") || /weird|odd|drag|burlesque|market|art/i.test(`${event.title} ${event.category}`)
    },
    {
      id: "group-chat-picked-plan",
      tone: "lime",
      matches: (event) => hasVibe(event, "Popular", "Social", "Live Music", "Dancing") || event.attendeeCount > 80
    }
  ];

  const templatePlans = templates
    .map((template, index) => {
      const anchor = anchorPool.find((event) => template.matches(event) && !usedEvents.has(exploreEventKey(event)));
      if (!anchor) return null;
      usedEvents.add(exploreEventKey(anchor));
      return buildGeneratedMosey(anchor, places, template.id, template.tone, index);
    })
    .filter((article): article is GeneratedExploreArticle & { completeness: number; index: number } => Boolean(article));

  if (templatePlans.length < 4) {
    for (const anchor of anchorPool) {
      if (templatePlans.length >= 4) break;
      if (usedEvents.has(exploreEventKey(anchor))) continue;
      const fallbackPlan = buildGeneratedMosey(anchor, places, "solid-plan", "lime", templatePlans.length + templates.length);
      if (!fallbackPlan) continue;
      usedEvents.add(exploreEventKey(anchor));
      templatePlans.push(fallbackPlan);
    }
  }

  return templatePlans
    .sort((a, b) => b.completeness - a.completeness || a.index - b.index)
    .slice(0, 4)
    .map(({ completeness: _completeness, index: _index, ...article }) => article);
}

function buildGeneratedMosey(anchor: EventItem, places: UnifiedPlace[], templateId: string, tone: "lime" | "orange" | "blue", index: number): (GeneratedExploreArticle & { completeness: number; index: number }) | null {
  const usedPlaceIds: string[] = [];
  const timeOfDay = eventTimeOfDay(anchor);
  const before = buildMoseyStop(anchor, places, "Before", moseyBeforeKinds(timeOfDay), usedPlaceIds);
  if (before) usedPlaceIds.push(before.place.id);
  const after = buildMoseyStop(anchor, places, "After", moseyAfterKinds(timeOfDay), usedPlaceIds);
  if (after) usedPlaceIds.push(after.place.id);
  const bonus = buildMoseyStop(anchor, places, "Bonus", ["park", "venue", "event-spot", "restaurant", "bar"], usedPlaceIds);
  if (bonus) usedPlaceIds.push(bonus.place.id);
  const stops = [before, after, bonus].filter(Boolean) as MoseyStop[];
  if (!stops.length) return null;
  const headline = moseyHeadline(anchor, templateId, timeOfDay);
  const hook = moseyHook(anchor, stops);
  const completeness = (isToday(anchor) ? 4 : 0) + (isTomorrow(anchor) ? 2 : 0) + (stops.length >= 2 ? 2 : 0) + (stops.length >= 3 ? 1 : 0) + articleEventScore(anchor) / 80;
  return {
    id: `mosey-${templateId}-${anchor.id}`,
    headline,
    hook,
    featuredEvent: anchor,
    before,
    after,
    bonus,
    cta: "Add to plan",
    area: anchor.area,
    timeOfDay,
    vibe: moseyVibe(anchor),
    rankedPlaceIds: stops.map((stop) => stop.place.id),
    tone,
    completeness,
    index
  };
}

function buildMoseyStop(anchor: EventItem, places: UnifiedPlace[], label: MoseyStop["label"], kinds: UnifiedPlace["kind"][], excludedIds: string[]) {
  const place = findArticlePlaces(anchor, places, kinds, excludedIds)[0];
  if (!place) return undefined;
  return {
    label,
    place,
    copy: moseyStopCopy(label, place, anchor)
  };
}

function eventTimeOfDay(event: EventItem): GeneratedExploreArticle["timeOfDay"] {
  const hour = eventHour(event);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "late";
}

function moseyBeforeKinds(timeOfDay: GeneratedExploreArticle["timeOfDay"]): UnifiedPlace["kind"][] {
  return ["restaurant", "bar"];
}

function moseyAfterKinds(timeOfDay: GeneratedExploreArticle["timeOfDay"]): UnifiedPlace["kind"][] {
  if (timeOfDay === "morning") return ["restaurant", "bar"];
  return ["bar", "restaurant"];
}

function moseyHeadline(event: EventItem, templateId: string, timeOfDay: GeneratedExploreArticle["timeOfDay"]) {
  const eventTitle = shortEventTitle(event.title);
  const dayWord = isToday(event) ? "today" : isTomorrow(event) ? "tomorrow" : dayLabel(event);
  if (templateId.includes("date")) return `Heading to ${eventTitle}? Here's a solid plan.`;
  if (templateId.includes("comedy")) return `What to do before and after ${eventTitle}.`;
  if (templateId.includes("group")) return `The group chat could just do this ${dayWord}.`;
  if (templateId.includes("wellness")) return `A surprisingly good ${timeOfDay} in ${areaLabel(event.area)}.`;
  if (templateId.includes("free")) return `One free thing, plus a reason to leave the house.`;
  if (isToday(event)) return `If you're looking for something to do today, start here.`;
  if (isTonight(event)) return `If you're looking for something to do tonight, start here.`;
  return `${eventTitle} is worth your ${dayWord}.`;
}

function moseyHook(event: EventItem, stops: MoseyStop[]) {
  const lead = stops[0]?.place.name;
  const second = stops[1]?.place.name;
  if (lead && second) return `${event.venueName} gives you the reason to go. ${lead} and ${second} make the rest feel easy.`;
  if (lead) return `${event.venueName} is the anchor. ${lead} keeps it from feeling like you only left the house for one thing.`;
  return "Not a bad way to spend a few hours without turning it into a project.";
}

function moseyStopCopy(label: MoseyStop["label"], place: UnifiedPlace, event: EventItem) {
  if (label === "Before") {
    if (eventHour(event) < 12) return `Grab ${place.kind === "bar" ? "a drink" : "something easy"} first. No need to make the morning complicated.`;
    if (eventHour(event) < 17) return `Start here before ${event.venueName}. It keeps the plan close and low-effort.`;
    return `Eat or drink here first so the event is not the whole plan.`;
  }
  if (label === "After") {
    if (eventHour(event) >= 17) return `Stick around afterward. This is close enough that nobody has to pitch a second neighborhood.`;
    return `Since you're already over there, this is a good next move.`;
  }
  return `If you're still out, this gives the plan one more easy stop.`;
}

function moseyVibe(event: EventItem) {
  if (event.vibeTags.includes("Live Music")) return "live music";
  if (event.vibeTags.includes("Comedy")) return "comedy";
  if (event.vibeTags.includes("Wellness")) return "wellness";
  if (event.vibeTags.includes("Date Night")) return "date night";
  if (event.vibeTags.includes("Dancing")) return "dance";
  if (event.isFree || event.vibeTags.includes("Free")) return "free";
  return event.category || "plan";
}

function shortEventTitle(title: string) {
  return title.replace(/\s+(?:at|@)\s+.+$/i, "").replace(/\s+\|\s+.+$/i, "").trim().slice(0, 64);
}

function findArticlePlaces(anchor: EventItem, places: UnifiedPlace[], kinds: UnifiedPlace["kind"][], excludedIds: string[]) {
  const origin = places.find((place) => place.source === "cactus" && place.sourceId === anchor.venueId) ?? places.find((place) => place.upcomingEventIds.includes(anchor.id));
  const excluded = new Set(excludedIds);
  return places
    .filter((place) => kinds.includes(place.kind) && !excluded.has(place.id))
    .filter((place) => place.sourceId !== anchor.venueId && normalizeEventIdentity(place.name) !== normalizeEventIdentity(anchor.venueName))
    .filter((place) => !place.upcomingEventIds.includes(anchor.id))
    .map((place) => {
      const coordinateDistance = origin?.latitude && origin.longitude && place.latitude && place.longitude
        ? distanceMiles({ latitude: origin.latitude, longitude: origin.longitude }, { latitude: place.latitude, longitude: place.longitude })
        : undefined;
      const sameArea = place.area === anchor.area;
      const walkable = typeof coordinateDistance === "number" ? coordinateDistance <= 1.5 : sameArea;
      return {
        place,
        score:
          (walkable ? 140 : 0) +
          (sameArea ? 80 : 0) +
          (typeof coordinateDistance === "number" ? Math.max(0, 60 - coordinateDistance * 24) : 0) +
          (place.vibeTags.some((tag) => anchor.vibeTags.includes(tag)) ? 18 : 0) +
          place.popularityScore +
          place.upcomingCount * 3
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.place);
}

function articleEventScore(event: EventItem) {
  return event.popularityScore + event.attendeeCount / 24 + event.tastemakerCount * 3 + (isToday(event) ? 32 : 0) + (isThisWeekend(event) ? 18 : 0) + (isTonight(event) ? 12 : 0);
}

function eventHour(event: EventItem) {
  const date = new Date(event.startDateTime);
  return Number.isFinite(date.getTime()) ? date.getHours() : 18;
}

function hasVibe(event: EventItem, ...vibes: VibeTag[]) {
  return vibes.some((vibe) => event.vibeTags.includes(vibe));
}

function placeListCopy(places: UnifiedPlace[], fallback: string) {
  if (!places.length) return fallback;
  if (places.length === 1) return places[0].name;
  return `${places[0].name} and ${places[1].name}`;
}

function buildExploreGuideCards(events: EventItem[], places: UnifiedPlace[]) {
  return allocateExploreEvents(events, places).guideCards;
}

function findNearbyAddOns(event: EventItem, places: UnifiedPlace[]) {
  return places
    .filter((place) => place.kind === "restaurant" || place.kind === "bar" || place.kind === "venue" || place.kind === "park")
    .map((place) => ({
      place,
      score:
        (place.area === event.area ? 50 : 0) +
        (typeof place.distanceMiles === "number" ? Math.max(0, 24 - place.distanceMiles * 3) : 0) +
        (place.vibeTags.some((tag) => event.vibeTags.includes(tag)) ? 16 : 0) +
        place.popularityScore +
        place.upcomingCount * 4
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.place)
    .slice(0, 4);
}

function findNearbySameTimeEvents(anchor: EventItem, events: EventItem[]) {
  const anchorStart = new Date(anchor.startDateTime);
  return events
    .filter((event) => exploreEventKey(event) !== exploreEventKey(anchor))
    .filter((event) => event.area === anchor.area || event.venueName === anchor.venueName || event.date === anchor.date)
    .sort((a, b) => {
      const aStart = new Date(a.startDateTime);
      const bStart = new Date(b.startDateTime);
      const aTimeGap = Number.isFinite(anchorStart.getTime()) && Number.isFinite(aStart.getTime()) ? Math.abs(aStart.getTime() - anchorStart.getTime()) / 3_600_000 : 24;
      const bTimeGap = Number.isFinite(anchorStart.getTime()) && Number.isFinite(bStart.getTime()) ? Math.abs(bStart.getTime() - anchorStart.getTime()) / 3_600_000 : 24;
      return aTimeGap - bTimeGap || b.popularityScore - a.popularityScore;
    });
}

function curateLocalArticles(articles: AtxArticle[]) {
  const preferred = [/live.?music/i, /dive.?bar/i, /patio/i, /south.?lamar/i, /south.?congress/i, /university|campus|ut/i, /brew/i, /hidden|underrated/i, /coffee/i, /lunch/i, /new.?restaurant/i];
  const seen = new Set<string>();
  return [...articles]
    .sort((a, b) => articleLocalScore(b, preferred) - articleLocalScore(a, preferred))
    .filter((article) => {
      const key = article.slug || normalizeEventIdentity(article.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function articleLocalScore(article: AtxArticle, preferred: RegExp[]) {
  const text = `${article.title} ${article.tags?.join(" ") ?? ""}`;
  return preferred.reduce((score, pattern, index) => score + (pattern.test(text) ? 100 - index * 4 : 0), 0) + Math.min(40, article.place_count ?? 0);
}

function exploreEventKey(event: EventItem) {
  const start = new Date(event.startDateTime);
  const timeBucket = Number.isFinite(start.getTime())
    ? `${localDateKey(start)}-${String(start.getHours()).padStart(2, "0")}`
    : `${event.date}-${event.timeText}`;
  return `${normalizeEventIdentity(event.title)}|${normalizeEventIdentity(event.venueName)}|${timeBucket}`;
}

function normalizeEventIdentity(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function eventWeekKey(event: EventItem) {
  const start = new Date(event.startDateTime);
  if (!Number.isFinite(start.getTime())) return event.date || "unknown";
  const weekStart = new Date(start);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(start.getDate() - start.getDay());
  return localDateKey(weekStart);
}

function weatherMatchedEvents(events: EventItem[], weather: WeatherState | null) {
  if (!weather) return events.slice(0, 5);
  const outdoor = isPatioWeather(weather);
  return [...events]
    .filter((event) => {
      if (outdoor) return event.vibeTags.includes("Outdoors") || event.vibeTags.includes("Patio") || /patio|market|park|outdoor|walk|garden/i.test(`${event.title} ${event.venueName}`);
      return event.vibeTags.includes("Live Music") || event.vibeTags.includes("Comedy") || event.vibeTags.includes("Low-Key") || /indoor|theatre|theater|club|comedy|music/i.test(`${event.title} ${event.venueName}`);
    })
    .sort((a, b) => personalizedScore(b, [], []) - personalizedScore(a, [], []));
}

function isPatioWeather(weather: WeatherState) {
  return weather.temperature >= 58 && weather.temperature <= 88 && weather.precipitation < 0.05 && weather.precipitationChance < 35 && weather.code < 61;
}

function weatherLabel(code: number) {
  if ([0, 1].includes(code)) return "clear";
  if ([2, 3].includes(code)) return "cloudy";
  if (code >= 45 && code <= 48) return "foggy";
  if (code >= 51 && code <= 67) return "rainy";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 95) return "stormy";
  return "mild";
}

function PlaceDetailDrawer({
  place,
  events,
  listNames,
  saved,
  visited,
  onClose,
  onSave,
  onVisit,
  onAddToList,
  onOpenDetails
}: {
  place?: UnifiedPlace | null;
  events: EventItem[];
  listNames: string[];
  saved: boolean;
  visited: boolean;
  onClose: () => void;
  onSave: (id: string) => void;
  onVisit: (id: string) => void;
  onAddToList: (listName: string, placeId: string) => void;
  onOpenDetails: (event: EventItem) => void;
}) {
  return (
    <AnimatePresence>
      {place ? (
        <motion.div
          className="fixed inset-0 z-[82] bg-black/34 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[2rem] border border-white/24 bg-emerald-950/92 text-bone shadow-[0_24px_90px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[560px] md:rounded-l-[2rem] md:rounded-tr-none"
            initial={{ y: "100%", x: 0, scale: 0.96, filter: "blur(8px)" }}
            animate={{ y: 0, x: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ y: "100%", x: 0, scale: 0.96, filter: "blur(8px)" }}
            transition={{ duration: 0.34, ease: "easeOut" }}
            onClick={(click) => click.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/16 bg-emerald-950/82 px-4 py-3 backdrop-blur-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100">{placeKindLabel(place.kind)}</p>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/16 text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:bg-white/70 hover:text-ink" onClick={onClose} aria-label="Close place details">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative min-h-[280px] overflow-hidden rounded-[1.5rem]">
                <SafeImage className="object-cover" src={place.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 100vw, 560px" />
                <div className="image-card-fade" />
                <div className="media-copy absolute bottom-4 left-4 right-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{place.neighborhoodPersonality}</p>
                  <h2 className="mt-2 text-4xl font-black leading-none tracking-[-0.04em]">{place.name}</h2>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <PlaceInfo label="Area" value={areaLabel(place.area)} />
                <PlaceInfo label="Distance" value={formatDistance(place.distanceMiles) ?? "Austin"} />
                <PlaceInfo label="Price" value={place.price ?? "Varies"} />
                <PlaceInfo label="Proof" value={place.articleTitles.length ? `${place.articleTitles.length} guides` : `${place.upcomingCount} events`} />
              </div>
              <div className="mt-5 rounded-[1.25rem] border border-white/28 bg-white/18 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Why it belongs</p>
                <p className="mt-2 text-sm leading-6 text-bone/70">{place.mustTry || place.notes || place.vibe}</p>
              </div>
              {place.articleTitles.length ? (
                <div className="mt-5 rounded-[1.25rem] border border-white/24 bg-white/14 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Editorial proof</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {place.articleTitles.slice(0, 4).map((title, index) => (
                      place.articleUrls[index] ? (
                        <a className="rounded-full bg-white/16 px-3 py-2 text-xs font-black text-bone/72 transition hover:bg-white/24" href={place.articleUrls[index]} target="_blank" rel="noreferrer" key={title}>
                          {title}
                        </a>
                      ) : (
                        <span className="rounded-full bg-white/16 px-3 py-2 text-xs font-black text-bone/72" key={title}>{title}</span>
                      )
                    ))}
                  </div>
                </div>
              ) : null}
              {events.length ? (
                <div className="mt-5 rounded-[1.25rem] border border-white/24 bg-white/14 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Upcoming here</p>
                  <div className="mt-3 grid gap-2">
                    {events.map((event) => (
                      <button className="rounded-2xl bg-white/12 px-3 py-3 text-left transition hover:bg-white/20" key={event.id} onClick={() => onOpenDetails(event)}>
                        <span className="block text-sm font-black">{event.title}</span>
                        <span className="mt-1 block text-xs font-bold text-bone/48">{dayLabel(event)} · {formatEventTime(event)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button className={cn("rounded-full px-4 py-3 text-sm font-black transition", saved ? "bg-neon text-emerald-950" : "bg-white/18 text-bone hover:bg-white/28")} onClick={() => onSave(place.id)}>
                  {saved ? "Saved" : "Save"}
                </button>
                <button className={cn("rounded-full px-4 py-3 text-sm font-black transition", visited ? "bg-bone text-ink" : "bg-white/18 text-bone hover:bg-white/28")} onClick={() => onVisit(place.id)}>
                  {visited ? "Visited" : "Mark visited"}
                </button>
                {listNames.slice(0, 3).map((name) => (
                  <button className="rounded-full bg-white/18 px-4 py-3 text-sm font-black text-bone transition hover:bg-white/28" key={name} onClick={() => onAddToList(name, place.id)}>
                    Add to {name}
                  </button>
                ))}
                <a className="rounded-full bg-neon px-4 py-3 text-sm font-black text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)] transition hover:bg-[#35E56B]" href={place.mapUrl} target="_blank" rel="noreferrer">
                  Directions
                </a>
                {place.websiteUrl ? (
                  <a className="rounded-full bg-white/18 px-4 py-3 text-sm font-black text-bone transition hover:bg-white/28" href={place.websiteUrl} target="_blank" rel="noreferrer">
                    Website
                  </a>
                ) : null}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PlaceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/24 bg-white/16 px-3 py-3 backdrop-blur-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bone/42">{label}</p>
      <p className="mt-1 text-sm font-black text-bone">{value}</p>
    </div>
  );
}

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late night";
}

function EmptyPanel({ message = "Import the CSV and the night shows up here." }: { message?: string }) {
  return (
    <div className="glass-panel rounded-[1.5rem] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)]"><Martini className="h-6 w-6" /></div>
      <p className="mt-4 text-xl font-black tracking-[-0.02em]">{message}</p>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-bone/50">Try widening the date, mood, or neighborhood. I’ll keep the good stuff close.</p>
    </div>
  );
}

const viewMotion = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.22, ease: "easeOut" }
};
