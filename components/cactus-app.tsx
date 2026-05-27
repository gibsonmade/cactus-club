"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Lottie from "lottie-react";
import { SafeImage } from "@/components/safe-image";
import {
  CalendarDays,
  ChevronDown,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Dumbbell,
  Flame,
  Heart,
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
  Sparkles,
  Thermometer,
  Trees,
  Wind,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventDetailDrawer } from "@/components/event-detail-drawer";
import { chooseForMove } from "@/lib/enrichment";
import { enrichDistances, formatDistance, type UserLocation } from "@/lib/location";
import { dayLabel, formatEventTime, isNextWeek, isThisWeekend, isToday, isTomorrow, isTonight, isUpcoming, isWithinDateRange, sortSoonest } from "@/lib/time";
import type { Area, EventItem, EvergreenEventItem, MoveCompany, MoveEnergy, MoveIntent, MoveVibe, VenueItem, VibeTag } from "@/lib/types";
import { publicPath } from "@/lib/public-path";
import { cn, uniq } from "@/lib/utils";

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

type AppData = {
  events: EventItem[];
  venues: VenueItem[];
  evergreenEvents: EvergreenEventItem[];
};

type WeatherState = {
  temperature: number;
  code: number;
  precipitation: number;
  precipitationChance: number;
  label: string;
};

let appDataCache: AppData | undefined;
let appDataPromise: Promise<AppData> | undefined;

function loadAppData() {
  if (appDataCache) return Promise.resolve(appDataCache);
  if (!appDataPromise) {
    appDataPromise = Promise.all([
      fetch(publicPath("/data/events.json")).then((response) => response.json() as Promise<EventItem[]>),
      fetch(publicPath("/data/venues.json")).then((response) => response.json() as Promise<VenueItem[]>),
      fetch(publicPath("/data/evergreen-events.json"))
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []) as Promise<EvergreenEventItem[]>
    ]).then(([events, venues, evergreenEvents]) => {
      appDataCache = { events, venues, evergreenEvents };
      return appDataCache;
    });
  }
  return appDataPromise;
}

export function CactusApp({ initialTab = "Today" }: { initialTab?: Tab }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [initialEvents, setInitialEvents] = useState<EventItem[]>([]);
  const [initialVenues, setInitialVenues] = useState<VenueItem[]>([]);
  const [initialEvergreenEvents, setInitialEvergreenEvents] = useState<EvergreenEventItem[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [savedEvents, setSavedEvents] = useStoredIds("savedEvents");
  const [savedVenues, setSavedVenues] = useStoredIds("savedVenues");
  const [hiddenEvents] = useStoredIds("hiddenEvents");
  const [preferredVibes, setPreferredVibes] = useStoredArray<VibeTag>("preferredVibes");
  const [preferredAreas, setPreferredAreas] = useStoredArray<Area>("preferredAreas");
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>();
  const [locationLabel, setLocationLabel] = useState("Nearby");
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const savedPlanCount = savedEvents.length + savedVenues.length;
  const previousSavedPlanCount = useRef<number | null>(null);
  const [planPulse, setPlanPulse] = useState(0);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let active = true;
    loadAppData()
      .then(({ events, venues, evergreenEvents }) => {
        if (!active) return;
        setInitialEvents(events);
        setInitialVenues(venues);
        setInitialEvergreenEvents(evergreenEvents);
        setDataReady(true);
      })
      .catch(() => {
        if (active) setDataReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("userLocation");
      if (stored) setUserLocation(JSON.parse(stored));
      const storedLabel = window.localStorage.getItem("userLocationLabel");
      if (storedLabel) setLocationLabel(storedLabel);
    } catch {
      setUserLocation(undefined);
    }
  }, []);

  useEffect(() => {
    const location = userLocation ?? austinLocation;
    let active = true;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", "temperature_2m,weather_code,precipitation");
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
        const precipitationChance = Number(payload?.hourly?.precipitation_probability?.[0] ?? 0);
        setWeather({ temperature, code, precipitation, precipitationChance, label: weatherLabel(code) });
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
        if (activeTab !== "Places") {
          setActiveTab("Explore");
          router.push("/explore?date=Nearby");
        }
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
    if (activeTab !== "Places") {
      setActiveTab("Explore");
      router.push(option.area ? `/explore?area=${encodeURIComponent(option.area)}` : "/explore");
    }
  }

  return (
    <main className="min-h-screen pb-24 text-bone md:pb-0">
      <AmbientChrome activeTab={activeTab} locationLabel={locationLabel} locationEnabled={Boolean(userLocation)} savedPlanCount={savedPlanCount} planPulse={planPulse} onNeighborhood={selectNeighborhood} />
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
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
              locationEnabled={Boolean(userLocation)}
              weather={weather}
              venues={venues}
              evergreenEvents={initialEvergreenEvents}
              savedEvents={savedEvents}
              savedVenues={savedVenues}
              onSave={toggleSavedEvent}
              onSaveVenue={toggleSavedVenue}
              onOpenDetails={setDetailEvent}
            />
          ) : null}
          {dataReady && activeTab === "Explore" ? (
            <ExploreView
              key="explore"
              events={visibleEvents}
              locationEnabled={Boolean(userLocation)}
              savedEvents={savedEvents}
              onSave={toggleSavedEvent}
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
              savedEvents={savedEvents}
              savedVenues={savedVenues}
              onSaveEvent={toggleSavedEvent}
              onSaveVenue={toggleSavedVenue}
              onOpenDetails={setDetailEvent}
            />
          ) : null}
          {dataReady && activeTab === "Places" ? (
            <VenuesView
              key="venues"
              events={visibleEvents}
              venues={venues}
              locationEnabled={Boolean(userLocation)}
              savedVenues={savedVenues}
              onSaveVenue={toggleSavedVenue}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <AppFooter />
      <EventDetailDrawer event={detailEvent} onClose={() => setDetailEvent(null)} />
      <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pt-2 md:hidden">
        <div className="glass-panel mx-auto grid max-w-md grid-cols-4 gap-1 rounded-[1.65rem] p-1.5">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const isPlan = tab.id === "Plan";
            return (
              <Link
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 rounded-[1.15rem] text-[11px] font-bold transition",
                  active ? "bg-bone text-ink shadow-[0_10px_30px_rgba(248,240,223,0.14)]" : "text-bone/58 hover:bg-white/8 hover:text-bone"
                )}
                href={tab.href}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
    try {
      const value = window.localStorage.getItem(key);
      if (value) setItems(JSON.parse(value));
    } catch {
      setItems([]);
    }
  }, [key]);
  const update = useCallback((next: T[] | ((current: T[]) => T[])) => {
    setItems((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      window.localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  }, [key]);
  return [items, update] as const;
}

function useStoredIds(key: string) {
  return useStoredArray<string>(key);
}

function AppFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-7xl px-4 pb-28 sm:px-6 lg:px-8 md:pb-12">
      <div className="glass-panel rounded-[1.5rem] p-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neon">Cactus Club</p>
        <p className="mt-2 text-sm font-bold text-bone/58">End of the list. Go make the plan.</p>
      </div>
    </footer>
  );
}

function AppLoadingSkeleton() {
  return (
    <motion.section {...viewMotion} className="space-y-8 pt-6 md:pt-10">
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
        "grid place-items-center rounded-full text-[10px] font-black shadow-[0_0_22px_rgba(214,255,79,0.32)]",
        compact ? "absolute right-2 top-1 h-5 min-w-5 px-1" : "h-5 min-w-5 px-1.5",
        active ? "bg-neon text-ink" : "bg-neon text-ink"
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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="min-w-0" href="/today">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-neon/85">Cactus Club</p>
        </Link>

        <nav className="glass-panel hidden rounded-full p-1 md:flex">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const isPlan = tab.id === "Plan";
            return (
              <Link
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
                  active ? "bg-bone text-ink shadow-[0_10px_32px_rgba(248,240,223,0.14)]" : "text-bone/60 hover:bg-white/8 hover:text-bone"
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

        <div className="relative shrink-0">
          <button
            className="inline-flex max-w-[44vw] items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-bold text-bone/80 backdrop-blur-xl transition hover:bg-white/14 md:max-w-none"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            <LocateFixed className="h-4 w-4 shrink-0 text-neon" />
            <span className="truncate">{locationEnabled ? locationLabel : "Nearby"}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition", open && "rotate-180")} />
          </button>
          <AnimatePresence>
            {open ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-12 z-[90] w-60 overflow-hidden rounded-2xl border border-white/18 bg-[#080706] p-2 text-bone shadow-[0_24px_80px_rgba(0,0,0,0.72)] ring-1 ring-neon/10"
              >
                {neighborhoodOptions.map((option) => (
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold text-bone/82 transition hover:bg-white/12 hover:text-bone focus:outline-none focus:ring-2 focus:ring-neon/40"
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
      </div>
    </header>
  );
}

function UpcomingView({
  events,
  preferredAreas,
  preferredVibes,
  locationEnabled,
  weather,
  venues,
  evergreenEvents,
  savedEvents,
  savedVenues,
  onSave,
  onSaveVenue,
  onOpenDetails
}: {
  events: EventItem[];
  preferredAreas: Area[];
  preferredVibes: VibeTag[];
  locationEnabled: boolean;
  weather: WeatherState | null;
  venues: VenueItem[];
  evergreenEvents: EvergreenEventItem[];
  savedEvents: string[];
  savedVenues: string[];
  onSave: (id: string) => void;
  onSaveVenue: (id: string) => void;
  onOpenDetails: (event: EventItem) => void;
}) {
  const [window, setWindow] = useState<"Today" | "Tomorrow" | "Weekend" | "Next week">("Today");
  const [chapterCount, setChapterCount] = useState(3);
  const upcomingWindow = useMemo(() => {
    const focused = events.filter((event) => isToday(event) || isTomorrow(event) || isThisWeekend(event) || isNextWeek(event));
    return focused.length ? focused : events.slice(0, 60);
  }, [events]);
  const ranked = useMemo(
    () => [...upcomingWindow].sort((a, b) => personalizedScore(b, preferredVibes, preferredAreas) - personalizedScore(a, preferredVibes, preferredAreas)),
    [preferredAreas, preferredVibes, upcomingWindow]
  );
  const popularToday = useMemo(() => {
    const todayPopular = [...events.filter((event) => isToday(event))]
      .sort((a, b) => b.popularityScore - a.popularityScore || b.attendeeCount - a.attendeeCount || personalizedScore(b, preferredVibes, preferredAreas) - personalizedScore(a, preferredVibes, preferredAreas))
      .slice(0, 3);
    return todayPopular.length >= 3 ? todayPopular : ranked.slice(0, 3);
  }, [events, preferredAreas, preferredVibes, ranked]);
  const hero = popularToday[0];
  const support = popularToday.slice(1, 3);
  const today = upcomingWindow.filter((event) => isToday(event));
  const tomorrow = upcomingWindow.filter((event) => isTomorrow(event));
  const weekend = upcomingWindow.filter((event) => isThisWeekend(event));
  const nextWeek = upcomingWindow.filter((event) => isNextWeek(event));
  const windowEvents = {
    Today: today,
    Tomorrow: tomorrow,
    Weekend: weekend,
    "Next week": nextWeek
  }[window].slice(0, 6);
  const weatherEvents = useMemo(() => weatherMatchedEvents(today, weather).slice(0, 5), [today, weather]);
  useEffect(() => {
    setChapterCount(3);
    const timers = [globalThis.setTimeout(() => setChapterCount(4), 260), globalThis.setTimeout(() => setChapterCount(5), 520), globalThis.setTimeout(() => setChapterCount(6), 780)];
    return () => timers.forEach((timer) => globalThis.clearTimeout(timer));
  }, []);
  return (
    <motion.section {...viewMotion} className="space-y-14 md:space-y-20">
      <NarrativeChapter eyebrow={timeGreeting()} title="Start with the day in front of you." copy="Weather, timing, and mood come first. The feed gets wider only after the obvious moves are clear." />
      <WeatherPlanSection weather={weather} events={weatherEvents} savedEvents={savedEvents} onSave={onSave} onOpenDetails={onOpenDetails} />
      <CategoryJumpGrid events={events} />
      {chapterCount >= 3 ? <MoveMaker events={upcomingWindow.slice(0, 80)} savedEvents={savedEvents} onSave={onSave} onOpenDetails={onOpenDetails} /> : <NarrativeSkeleton />}
      <section>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SectionHeader kicker="Timeline" title="Make your plan" />
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {(["Today", "Tomorrow", "Weekend", "Next week"] as const).map((item) => (
              <button
                className={cn("shrink-0 rounded-full px-4 py-2 text-xs font-black transition", window === item ? "bg-neon text-ink" : "bg-white/8 text-bone/64 hover:bg-white/14 hover:text-bone")}
                key={item}
                onClick={() => setWindow(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <FullBleedRail>
          {windowEvents.map((event) => (
            <div className="w-[76vw] shrink-0 snap-start sm:w-[330px]" key={event.id}>
              <EventCard event={event} saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />
            </div>
          ))}
        </FullBleedRail>
        {!windowEvents.length ? <EmptyPanel message="Nothing in this window yet." /> : null}
      </section>
      {chapterCount >= 4 ? <MoodRails events={events} savedEvents={savedEvents} onSave={onSave} onOpenDetails={onOpenDetails} /> : <NarrativeSkeleton />}
      {chapterCount >= 5 ? <EvergreenDiscovery evergreenEvents={evergreenEvents} venues={venues} savedVenues={savedVenues} onSaveVenue={onSaveVenue} /> : null}
      {chapterCount >= 6 ? <section>
        <SectionHeader kicker="Popular today" title="Don’t miss out" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          {hero ? <EventCard event={hero} size="hero" saved={savedEvents.includes(hero.id)} onSave={onSave} onOpenDetails={onOpenDetails} /> : <EmptyPanel />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {support.map((event) => (
              <EventCard event={event} key={event.id} size="compact" saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />
            ))}
          </div>
        </div>
      </section> : null}
    </motion.section>
  );
}

function NarrativeChapter({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <section className="pt-2">
      <div className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-neon/78 backdrop-blur-xl">
        {eyebrow}
      </div>
      <h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-[0.9] tracking-[-0.04em] text-balance md:text-7xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-bone/62 md:text-lg">{copy}</p>
    </section>
  );
}

function NarrativeSkeleton() {
  return (
    <section className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => <div className="h-56 animate-pulse rounded-[1.25rem] bg-white/8" key={item} />)}
    </section>
  );
}

function FullBleedRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-bleed-rail relative overflow-visible">
      <div className="flex snap-x gap-3 overflow-x-auto pb-1 hide-scrollbar">
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
              className="glass-panel group flex min-h-[132px] flex-col items-center justify-center rounded-[1.35rem] p-4 text-center transition duration-300 hover:-translate-y-0.5 hover:border-neon/35 hover:bg-white/12"
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
              <p className="text-xs font-black uppercase tracking-[0.18em] text-mezcal">Weather picks</p>
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
      panelClass: "border-sky-200/12 bg-[radial-gradient(circle_at_18%_10%,rgba(125,211,252,0.24),transparent_14rem),linear-gradient(145deg,#101827_0%,#172033_46%,#263241_100%)] text-bone",
      skyGlowClass: "bg-sky-200/18",
      groundGlowClass: "bg-violet/18",
      orbClass: "absolute right-8 top-8 h-16 w-16 rounded-full bg-sky-100/18 blur-sm",
      iconClass: "bg-sky-100/14 text-sky-100 ring-1 ring-sky-100/20",
      textClass: "text-bone",
      mutedClass: "text-bone/62",
      eyebrowClass: "text-sky-100/64"
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
      mutedClass: "text-ink/58",
      eyebrowClass: "text-ink/52"
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
    mutedClass: "text-ink/58",
    eyebrowClass: "text-ink/54"
  };
}

function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour < 6 || hour >= 20;
}

function WeatherMetric({ icon: Icon, label, value, dark = false }: { icon: typeof CloudSun; label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur", dark ? "border border-white/12 bg-white/10" : "border border-ink/8 bg-white/34")}>
      <Icon className={cn("h-4 w-4", dark ? "text-bone/68" : "text-ink/58")} />
      <p className={cn("mt-3 text-[10px] font-black uppercase tracking-[0.16em]", dark ? "text-bone/48" : "text-ink/45")}>{label}</p>
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
        <p className="text-xs font-black uppercase tracking-[0.22em] text-mezcal">Always on</p>
        <h2 className="mt-2 font-display text-4xl leading-none md:text-5xl">Need an idea?</h2>
        <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-bone/62">Evergreen Austin moves for when events are too much and staying home is not it.</p>
      </div>
      <article className="relative min-h-[420px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-black shadow-card">
        <SafeImage className="object-cover" src={item.venue.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 92vw, 720px" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16)_0%,rgba(0,0,0,0.26)_38%,rgba(0,0,0,0.72)_72%,rgba(0,0,0,0.96)_100%)]" />
        <div className="absolute inset-x-0 top-0 flex justify-between gap-3 p-4">
          <span className="rounded-full bg-bone px-3 py-2 text-xs font-black text-ink">{item.idea.category || "Austin classic"}</span>
          <button className="grid h-11 w-11 place-items-center rounded-full bg-bone text-ink transition hover:bg-neon" onClick={() => setIndex((current) => current + 1)} aria-label="Show another idea">
            <RefreshCcw className="h-5 w-5" />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{item.venue.neighborhoodPersonality}</p>
          <h3 className="mt-2 max-w-2xl text-4xl font-black leading-none md:text-5xl">{item.idea.title}</h3>
          <p className="mt-3 text-sm font-bold text-bone/70">{item.venue.name} · {areaLabel(item.venue.area)}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className={cn("rounded-full px-4 py-2 text-xs font-black transition", saved ? "bg-neon text-ink" : "bg-white/12 text-bone hover:bg-white/18")} onClick={() => onSaveVenue(item.venue.id)}>
              {saved ? "Saved" : "Save place"}
            </button>
            <Link className="rounded-full bg-bone px-4 py-2 text-xs font-black text-ink transition hover:bg-neon" href={`/places/${item.venue.id}`}>
              Venue page
            </Link>
            {item.venue.venueUrl ? (
              <a className="rounded-full bg-white/12 px-4 py-2 text-xs font-black text-bone transition hover:bg-white/18" href={item.venue.venueUrl} target="_blank" rel="noreferrer">
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
    <section className="max-w-full overflow-hidden rounded-[1.75rem] border border-white/30 bg-bone p-4 text-ink shadow-[0_24px_90px_rgba(248,240,223,0.14)] md:rounded-[2rem] md:p-8">
      <div className="grid min-w-0 max-w-full gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-mezcal">Signature move</p>
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
              value === item ? "border-ink bg-ink text-bone" : "border-ink/15 bg-ink/5 text-ink/72 hover:bg-ink/10"
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

function ExploreView({
  events,
  locationEnabled,
  savedEvents,
  preferredAreas,
  preferredVibes,
  onSave,
  onOpenDetails,
  onPreferredArea,
  onPreferredVibe
}: {
  events: EventItem[];
  locationEnabled: boolean;
  savedEvents: string[];
  preferredAreas: Area[];
  preferredVibes: VibeTag[];
  onSave: (id: string) => void;
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
        if (dateMode === "Nearby") return (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99);
        return sortSoonest(a, b);
      });
  }, [area, dateMode, endDate, events, query, startDate, vibe]);

  useEffect(() => {
    setVisibleResultCount(24);
  }, [area, dateMode, endDate, query, startDate, vibe]);

  useEffect(() => {
    if (visibleResultCount >= results.length) return;
    const timer = window.setTimeout(() => {
      setVisibleResultCount((count) => Math.min(count + 24, results.length));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [results.length, visibleResultCount]);

  const visibleResults = useMemo(() => results.slice(0, visibleResultCount), [results, visibleResultCount]);
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
    <motion.section {...viewMotion} className="space-y-8 pt-6 md:pt-10">
      <PageTitle kicker="Explore" title="Find your lane." copy="Search, set a date, or browse by mood." />
      <section className="glass-panel sticky top-20 z-30 rounded-[1.5rem] p-2 md:top-24 md:p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <div className="flex h-11 w-[58vw] min-w-[190px] shrink-0 items-center gap-2 rounded-full border border-white/8 bg-white/8 px-3 transition focus-within:border-neon/40 focus-within:bg-white/12 md:w-auto md:min-w-[260px] md:flex-1 md:gap-3 md:rounded-2xl md:px-4">
            <Search className="h-5 w-5 shrink-0 text-neon" />
            <input className="w-full min-w-0 bg-transparent text-sm text-bone outline-none placeholder:text-bone/38" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events or venues..." />
            {query ? <button className="grid h-7 w-7 place-items-center rounded-full bg-white/10" onClick={() => setQuery("")} aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
          <BrowseButton label="Date" value={dateLabel(dateMode, startDate, endDate)} active={dateMode !== "Any"} open={openFilter === "date"} onClick={() => setOpenFilter(openFilter === "date" ? null : "date")} />
          <BrowseButton label="Vibe" value={vibe} active={vibe !== "All"} open={openFilter === "vibe"} onClick={() => setOpenFilter(openFilter === "vibe" ? null : "vibe")} />
          <BrowseButton label="Area" value={areaLabel(area)} active={area !== "All"} open={openFilter === "area"} onClick={() => setOpenFilter(openFilter === "area" ? null : "area")} />
          <button className="h-11 shrink-0 rounded-full bg-bone px-4 text-xs font-black text-ink transition hover:bg-neon md:rounded-2xl" onClick={resetFilters}>
            {activeFilterCount ? `Clear ${activeFilterCount}` : `${results.length} results`}
          </button>
        </div>

        <AnimatePresence>
          {openFilter ? (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 rounded-[1.25rem] border border-white/10 bg-black/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
          {results.length ? `Showing ${visibleResults.length} of ${results.length}` : "No"} {area !== "All" ? `${areaLabel(area)} ` : ""}results
        </p>
        {area === "Burbs" ? <p className="text-bone/42">Suburbs only. No in-town Austin venues.</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleResults.map((event) => (
          <EventCard event={event} key={event.id} saved={savedEvents.includes(event.id)} onSave={onSave} onOpenDetails={onOpenDetails} />
        ))}
      </div>
      {visibleResults.length < results.length ? (
        <div className="flex justify-center">
          <button
            className="rounded-full bg-bone px-5 py-3 text-xs font-black text-ink transition hover:bg-neon"
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

function PlanView({ events, venues, savedEvents, savedVenues, onSaveEvent, onSaveVenue, onOpenDetails }: { events: EventItem[]; venues: VenueItem[]; savedEvents: string[]; savedVenues: string[]; onSaveEvent: (id: string) => void; onSaveVenue: (id: string) => void; onOpenDetails: (event: EventItem) => void }) {
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
  const tonight = planned.filter((event) => isTonight(event));
  const weekend = planned.filter((event) => !isTonight(event) && isThisWeekend(event));
  const later = planned.filter((event) => !isTonight(event) && !isThisWeekend(event)).slice(0, 20);
  const neighborhoodGroups = areaFilters
    .map((area) => ({ area, events: planned.filter((event) => event.area === area) }))
    .filter((group) => group.events.length);
  return (
    <motion.section {...viewMotion} className="space-y-10 pt-6 md:pt-10">
      <PageTitle kicker="Plan" title="Your upcoming life." copy="Saved events stay fresh. Saved places keep sending signals." />
      {!planned.length && !venuePlans.length ? <EmptyPanel message="No plans yet. Let’s fix that." /> : null}
      <PlanControls areaFilter={areaFilter} sortMode={sortMode} planMode={planMode} onAreaFilter={setAreaFilter} onSortMode={setSortMode} onPlanMode={setPlanMode} />
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
    </motion.section>
  );
}

function PlanControls({ areaFilter, sortMode, planMode, onAreaFilter, onSortMode, onPlanMode }: { areaFilter: Area | "All"; sortMode: "Soonest" | "Popular" | "Neighborhood"; planMode: "Timeline" | "Neighborhood" | "Places"; onAreaFilter: (area: Area | "All") => void; onSortMode: (mode: "Soonest" | "Popular" | "Neighborhood") => void; onPlanMode: (mode: "Timeline" | "Neighborhood" | "Places") => void }) {
  return (
    <section className="glass-panel rounded-[1.5rem] p-4">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-mezcal">Tune your plan</p>
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
          <label className="flex min-w-[220px] items-center gap-3 rounded-full border border-white/10 bg-night/70 px-4 py-3 text-xs font-black text-bone/72">
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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.10)_0%,rgba(0,0,0,0.24)_35%,rgba(0,0,0,0.74)_72%,rgba(0,0,0,0.98)_100%)]" />
      <button className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-bone backdrop-blur-xl transition hover:bg-bone hover:text-ink" onClick={() => onRemove(venue.id)} aria-label={`Remove ${venue.name} from plan`}>
        <X className="h-4 w-4" />
      </button>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-neon">{venue.neighborhoodPersonality}</p>
        <Link className="mt-2 block text-left text-3xl font-black leading-none underline-offset-4 transition hover:text-neon hover:underline" href={`/places/${venue.id}`}>
          {venue.name}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-neon/14 px-3 py-1.5 text-xs font-black text-neon">{areaLabel(venue.area)}</span>
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
          <article className="relative grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/7 p-3 md:grid-cols-[160px_1fr]" key={event.id}>
            <button className="absolute inset-0 z-10 cursor-pointer rounded-[1.5rem] text-left" onClick={() => onOpenDetails(event)} aria-label={`Open details for ${event.title}`} />
            <button className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-bone backdrop-blur-xl transition hover:bg-bone hover:text-ink" onClick={() => onRemove(event.id)} aria-label={`Remove ${event.title} from plan`}>
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
                <span className="rounded-full bg-neon/14 px-3 py-1.5 text-xs font-black text-neon">{areaLabel(event.area)}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-bone/64">{event.neighborhoodPersonality}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function VenuesView({ events, venues, locationEnabled, savedVenues, onSaveVenue }: { events: EventItem[]; venues: VenueItem[]; locationEnabled: boolean; savedVenues: string[]; onSaveVenue: (id: string) => void }) {
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const sortedVenues = useMemo(() => [...venues].sort((a, b) => b.popularityScore - a.popularityScore || b.upcomingCount - a.upcomingCount), [venues]);
  const evergreen = sortedVenues.filter((venue) => venue.source === "evergreen" || (venue.evergreenCount ?? 0) > 0).slice(0, 12);
  const patios = sortedVenues.filter((venue) => venue.vibe.includes("patio") || venue.upcomingEventIds.some((id) => eventById.get(id)?.vibeTags.includes("Patio"))).slice(0, 12);
  const institutions = sortedVenues.filter((venue) => venue.popularityScore > 25 || venue.upcomingCount >= 8).slice(0, 12);
  const musicRooms = sortedVenues.filter((venue) => venue.upcomingEventIds.some((id) => eventById.get(id)?.vibeTags.includes("Live Music"))).slice(0, 12);
  const comedyRooms = sortedVenues.filter((venue) => venue.upcomingEventIds.some((id) => eventById.get(id)?.vibeTags.includes("Comedy"))).slice(0, 12);
  const nearby = venues.filter((venue) => typeof venue.distanceMiles === "number").sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99)).slice(0, 12);
  const areaRows = areaFilters
    .map((area) => ({ area, venues: sortedVenues.filter((venue) => venue.area === area).slice(0, 10) }))
    .filter((row) => row.venues.length);
  return (
    <motion.section {...viewMotion} className="space-y-12 pt-6 md:space-y-16 md:pt-10">
      <PageTitle kicker="Places" title="Pick the room, then the night." copy="Browse by neighborhood when geography matters. Browse by vibe when it does not." />
      <VenueDecisionStrip />
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
        <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
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
      className={cn("group relative overflow-hidden rounded-[1.65rem] border shadow-card transition-colors", light ? "border-ink/10 bg-ink text-bone" : "border-white/10 bg-white/[0.075]", size === "carousel" ? "h-[62vh] min-h-[430px] max-h-[620px]" : size === "hero" ? "min-h-[380px]" : size === "tall" ? "min-h-[420px]" : size === "compact" ? "min-h-[255px]" : "min-h-[330px]")}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <button className="absolute inset-0 z-10 cursor-pointer text-left" onClick={() => onOpenDetails(event)} aria-label={`Open details for ${event.title}`} />
      <SafeImage className="object-cover transition duration-700 group-hover:scale-105" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 90vw, 420px" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.24)_38%,rgba(0,0,0,0.78)_76%,rgba(0,0,0,0.98)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/78 to-transparent" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="rounded-full bg-black/35 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-bone/82 backdrop-blur-xl">{dayLabel(event)}</span>
        <button className={cn("relative z-20 grid h-10 w-10 place-items-center rounded-full backdrop-blur-xl transition", saved ? "bg-neon text-ink" : "bg-black/35 text-bone hover:bg-bone hover:text-ink")} onClick={(click) => { click.stopPropagation(); onSave(event.id); }} aria-label={saved ? "Unsave event" : "Save event"}>
          <Heart className={cn("h-5 w-5", saved && "fill-current")} />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        {prominent ? <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-neon">{event.neighborhoodPersonality}</p> : null}
        <h3 className={cn("break-words font-black leading-[1.04] tracking-[-0.02em]", size === "hero" ? "text-3xl md:text-5xl" : "text-2xl")}>{event.title}</h3>
        <p className="mt-2 line-clamp-1 text-xs font-semibold text-bone/66">{event.venueName} · {areaLabel(event.area)}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-bone/86 backdrop-blur-xl">
            <CalendarDays className="h-4 w-4" />
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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.10)_0%,rgba(0,0,0,0.24)_35%,rgba(0,0,0,0.74)_72%,rgba(0,0,0,0.98)_100%)]" />
      <button className={cn("absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full backdrop-blur-xl", saved ? "bg-neon text-ink" : "bg-black/35 text-bone")} onClick={() => onSave(venue.id)} aria-label={saved ? "Unsave venue" : "Save venue"}>
        <Heart className={cn("h-5 w-5", saved && "fill-current")} />
      </button>
      <div className="absolute inset-x-0 bottom-0 p-4">
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

function PageTitle({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return (
    <div className="max-w-4xl">
      <p className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-neon/82 backdrop-blur-xl">{kicker}</p>
      <h1 className="mt-4 font-display text-5xl font-black leading-[0.92] tracking-[-0.04em] text-balance md:text-7xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-bone/64">{copy}</p>
    </div>
  );
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-mezcal/90">{kicker}</p>
        <h2 className="mt-2 font-display text-3xl font-black leading-none tracking-[-0.035em] md:text-5xl">{title}</h2>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-black transition", active ? "bg-neon text-ink" : "bg-white/8 text-bone/64 hover:bg-white/14 hover:text-bone")} onClick={onClick}>
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
                  (selectedStart || selectedEnd || previewEndpoint) && "bg-neon text-ink shadow-[0_0_24px_rgba(214,255,79,0.22)]",
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
        active || open ? "border-neon/45 bg-neon/14 text-bone" : "border-white/10 bg-white/8 text-bone/66 hover:bg-white/12 hover:text-bone"
      )}
      onClick={onClick}
    >
      <span className="min-w-0 truncate sm:max-w-[190px]">
        <span className="text-bone/45">{label}</span>
        <span className="text-bone/38">:</span> {value}
      </span>
      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black", active || open ? "bg-neon text-ink" : "bg-white/10 text-bone/60")}>
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
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bone text-ink"><Martini className="h-6 w-6" /></div>
      <p className="mt-4 text-xl font-black tracking-[-0.02em]">{message}</p>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-bone/50">Try widening the date, mood, or neighborhood. I’ll keep the good stuff close.</p>
    </div>
  );
}

const viewMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.42, ease: "easeOut" }
};
