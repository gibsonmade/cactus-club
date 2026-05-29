import type { Area, EventItem, VenueItem, VibeTag } from "@/lib/types";
import { distanceMiles, type UserLocation } from "@/lib/location";

export type AtxEatPlace = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  image_url?: string;
  open_for?: string;
  price_range?: string;
  must_try?: string;
  notes?: string;
  tags?: string;
  article_titles?: string;
  article_urls?: string;
  appearances?: number;
  opening_hours?: string;
  hours_source?: string;
};

export type AtxArticle = {
  title: string;
  url: string;
  slug: string;
  tags: string[];
  updated_at?: string;
  place_count?: number;
};

export type UnifiedPlaceKind = "restaurant" | "venue" | "bar" | "park" | "event-spot";

export type UnifiedPlace = {
  id: string;
  sourceId: string;
  source: "atx-eats" | "cactus";
  kind: UnifiedPlaceKind;
  name: string;
  area: Area;
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  imageUrl?: string;
  websiteUrl?: string;
  mapUrl: string;
  price?: string;
  hours?: string;
  openFor?: string;
  mustTry?: string;
  notes?: string;
  articleTitles: string[];
  articleUrls: string[];
  tags: string[];
  vibeTags: VibeTag[];
  vibe: string;
  neighborhoodPersonality: string;
  popularityScore: number;
  upcomingEventIds: string[];
  upcomingCount: number;
};

export type OutingRecommendation = {
  id: string;
  anchor: EventItem | UnifiedPlace;
  addOns: UnifiedPlace[];
  reason: string;
};

const defaultAustinLocation = { latitude: 30.2672, longitude: -97.7431 };

export function buildUnifiedPlaces({
  restaurants,
  venues,
  events,
  userLocation
}: {
  restaurants: AtxEatPlace[];
  venues: VenueItem[];
  events: EventItem[];
  userLocation?: UserLocation;
}) {
  const venuePlaces = venues.map((venue) => fromVenue(venue, userLocation));
  const restaurantPlaces = restaurants.map((place) => fromRestaurant(place, userLocation));
  return mergeDuplicatePlaces([...restaurantPlaces, ...venuePlaces], events);
}

export function buildOutingRecommendations(events: EventItem[], places: UnifiedPlace[]) {
  const restaurants = places.filter((place) => place.kind === "restaurant");
  return events.slice(0, 8).map((event) => {
    const nearFood = restaurants
      .map((place) => ({
        place,
        score:
          proximityScore(event, place) +
          (place.vibeTags.some((tag) => event.vibeTags.includes(tag)) ? 12 : 0) +
          Math.min(28, place.popularityScore / 3)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((item) => item.place);

    return {
      id: `outing-${event.id}`,
      anchor: event,
      addOns: nearFood,
      reason: nearFood.length
        ? `Start with ${event.venueName}, then keep the plan close with ${nearFood.map((place) => place.name).join(" or ")}.`
        : `${event.neighborhoodPersonality}. Good anchor for a low-friction Austin plan.`
    };
  });
}

export function placeMatchesQuery(place: UnifiedPlace, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [place.name, place.address, place.vibe, place.notes, place.mustTry, ...place.tags, ...place.articleTitles]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function tagToVibeTags(tags: string[] = []): VibeTag[] {
  const text = tags.join(" ").toLowerCase();
  const vibes = new Set<VibeTag>();
  if (/date|romantic|wine|cocktail|dinner/.test(text)) vibes.add("Date Night");
  if (/free|cheap|budget|happy hour/.test(text)) vibes.add("Free");
  if (/weird|quirky|hidden|under/.test(text)) vibes.add("Weird Austin");
  if (/coffee|breakfast|brunch|bakery|low|casual/.test(text)) vibes.add("Low-Key");
  if (/patio|outdoor|barbecue|bbq|park/.test(text)) vibes.add("Outdoors");
  if (/late|bar|cocktail|drinks/.test(text)) vibes.add("Late Night");
  if (/healthy|vegan|vegetarian|wellness/.test(text)) vibes.add("Wellness");
  if (/music|dance/.test(text)) vibes.add("Live Music");
  if (/popular|best|essential|iconic|classic/.test(text)) vibes.add("Popular");
  if (/group|party|social|bar/.test(text)) vibes.add("Social");
  if (!vibes.size) vibes.add("Popular");
  return Array.from(vibes);
}

function fromRestaurant(place: AtxEatPlace, userLocation?: UserLocation): UnifiedPlace {
  const tags = parseList(place.tags);
  const articleTitles = parseList(place.article_titles);
  const articleUrls = parseList(place.article_urls);
  const location = place.latitude && place.longitude ? { latitude: place.latitude, longitude: place.longitude } : undefined;
  const distance = location && userLocation ? distanceMiles(userLocation, location) : undefined;
  return {
    id: `food:${place.id}`,
    sourceId: place.id,
    source: "atx-eats",
    kind: inferRestaurantKind(place, tags),
    name: place.name,
    area: inferArea(place.address, place.latitude, place.longitude),
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceMiles: distance,
    imageUrl: place.image_url,
    websiteUrl: place.website,
    mapUrl: mapsUrl(place.name, place.address),
    price: place.price_range,
    hours: place.opening_hours,
    openFor: place.open_for,
    mustTry: place.must_try,
    notes: place.notes,
    articleTitles,
    articleUrls,
    tags,
    vibeTags: tagToVibeTags([...tags, ...articleTitles, place.open_for ?? "", place.notes ?? ""]),
    vibe: readableFoodVibe(place, tags, articleTitles),
    neighborhoodPersonality: foodPersonality(place, tags),
    popularityScore: Math.min(100, 38 + (place.appearances ?? articleTitles.length) * 8),
    upcomingEventIds: [],
    upcomingCount: 0
  };
}

function fromVenue(venue: VenueItem, userLocation?: UserLocation): UnifiedPlace {
  const location = venue.latitude && venue.longitude ? { latitude: venue.latitude, longitude: venue.longitude } : undefined;
  const distance = location && userLocation ? distanceMiles(userLocation, location) : venue.distanceMiles;
  return {
    id: `venue:${venue.id}`,
    sourceId: venue.id,
    source: "cactus",
    kind: inferVenueKind(venue),
    name: venue.name,
    area: venue.area,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    distanceMiles: distance,
    imageUrl: venue.imageUrl,
    websiteUrl: venue.venueUrl,
    mapUrl: venue.mapUrl,
    articleTitles: [],
    articleUrls: [],
    tags: [venue.vibe, venue.neighborhoodPersonality].filter(Boolean),
    vibeTags: [],
    vibe: venue.vibe,
    neighborhoodPersonality: venue.neighborhoodPersonality,
    popularityScore: venue.popularityScore,
    upcomingEventIds: venue.upcomingEventIds,
    upcomingCount: venue.upcomingCount
  };
}

function mergeDuplicatePlaces(places: UnifiedPlace[], events: EventItem[]) {
  const byKey = new Map<string, UnifiedPlace>();
  const eventsByVenueName = new Map<string, EventItem[]>();
  for (const event of events) {
    const key = normalizeKey(event.venueName);
    eventsByVenueName.set(key, [...(eventsByVenueName.get(key) ?? []), event]);
  }

  for (const place of places) {
    const key = `${normalizeKey(place.name)}:${normalizeAddress(place.address)}`;
    const existing = byKey.get(key);
    const relatedEvents = eventsByVenueName.get(normalizeKey(place.name)) ?? [];
    const withEvents = {
      ...place,
      upcomingEventIds: Array.from(new Set([...place.upcomingEventIds, ...relatedEvents.map((event) => event.id)])),
      upcomingCount: Math.max(place.upcomingCount, relatedEvents.length)
    };
    if (!existing) {
      byKey.set(key, withEvents);
      continue;
    }
    byKey.set(key, {
      ...existing,
      ...withEvents,
      id: existing.source === "atx-eats" ? existing.id : withEvents.id,
      imageUrl: existing.imageUrl || withEvents.imageUrl,
      websiteUrl: existing.websiteUrl || withEvents.websiteUrl,
      articleTitles: Array.from(new Set([...existing.articleTitles, ...withEvents.articleTitles])),
      articleUrls: Array.from(new Set([...existing.articleUrls, ...withEvents.articleUrls])),
      tags: Array.from(new Set([...existing.tags, ...withEvents.tags])),
      vibeTags: Array.from(new Set([...existing.vibeTags, ...withEvents.vibeTags])),
      upcomingEventIds: Array.from(new Set([...existing.upcomingEventIds, ...withEvents.upcomingEventIds])),
      upcomingCount: Math.max(existing.upcomingCount, withEvents.upcomingCount),
      popularityScore: Math.max(existing.popularityScore, withEvents.popularityScore)
    });
  }

  return Array.from(byKey.values()).sort((a, b) => b.popularityScore - a.popularityScore || a.name.localeCompare(b.name));
}

function proximityScore(event: EventItem, place: UnifiedPlace) {
  if (typeof event.distanceMiles === "number" && typeof place.distanceMiles === "number") {
    return Math.max(0, 35 - Math.abs(event.distanceMiles - place.distanceMiles) * 4);
  }
  if (event.area === place.area) return 20;
  return 0;
}

function parseList(value?: string) {
  return (value ?? "")
    .split("|")
    .flatMap((part) => part.split(";"))
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapsUrl(name: string, address?: string) {
  const query = encodeURIComponent([name, address].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function inferRestaurantKind(place: AtxEatPlace, tags: string[]): UnifiedPlaceKind {
  const text = `${place.name} ${place.open_for} ${tags.join(" ")} ${place.notes}`.toLowerCase();
  if (/bar|cocktail|brewery|beer|wine/.test(text)) return "bar";
  return "restaurant";
}

function inferVenueKind(venue: VenueItem): UnifiedPlaceKind {
  const text = `${venue.name} ${venue.vibe} ${venue.neighborhoodPersonality}`.toLowerCase();
  if (/park|garden|trail|lake|zilker|outdoor/.test(text)) return "park";
  if (/bar|club|cocktail|beer|brewery|lounge/.test(text)) return "bar";
  return "venue";
}

function readableFoodVibe(place: AtxEatPlace, tags: string[], articleTitles: string[]) {
  const source = tags[0] || articleTitles[0] || place.open_for || "Austin food stop";
  return source.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function foodPersonality(place: AtxEatPlace, tags: string[]) {
  if (place.open_for?.toLowerCase().includes("breakfast") || tags.join(" ").includes("coffee")) return "Easy start, low-friction stop";
  if (place.price_range === "$") return "Casual Austin favorite";
  if ((place.appearances ?? 0) > 2) return "Locals keep seeing this one";
  return "Worth saving for the right mood";
}

function inferArea(address?: string, latitude?: number, longitude?: number): Area {
  const text = (address ?? "").toLowerCase();
  if (/round rock|cedar park|pflugerville|bee cave|dripping springs|georgetown|bastrop/.test(text)) return "Burbs";
  if (longitude && longitude > -97.73 && latitude && latitude < 30.31) return "East Side";
  if (longitude && longitude < -97.76 && latitude && latitude < 30.29) return "Barton/Zilker";
  if (latitude && latitude < 30.25) return "South Austin";
  if (latitude && latitude > 30.31) return "North Austin";
  if (longitude && longitude >= -97.76 && longitude <= -97.73 && latitude && Math.abs(latitude - defaultAustinLocation.latitude) < 0.06) return "Downtown";
  return "Central";
}

function normalizeKey(value?: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeAddress(value?: string) {
  return normalizeKey(value).replace(/\b(austin|tx|texas|usa|787\d{2})\b/g, "").trim();
}
