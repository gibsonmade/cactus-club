import eventsData from "@/public/data/events.json";
import venuesData from "@/public/data/venues.json";
import evergreenEventsData from "@/public/data/evergreen-events.json";
import atxPlacesData from "@/public/data/atx-eats/places.json";
import articlesData from "@/public/data/atx-eats/articles.json";
import { isToday, isTonight, isTomorrow, isUpcoming, isThisWeekend, sortSoonest } from "@/lib/time";
import type { EventItem, EvergreenEventItem, VenueItem } from "@/lib/types";
import type { AtxArticle, AtxEatPlace } from "@/lib/unified";

export type AppData = {
  events: EventItem[];
  venues: VenueItem[];
  evergreenEvents: EvergreenEventItem[];
  restaurants: AtxEatPlace[];
  articles: AtxArticle[];
  isPartial?: boolean;
};

const allEvents = eventsData as EventItem[];
const allVenues = venuesData as VenueItem[];
const allEvergreenEvents = evergreenEventsData as EvergreenEventItem[];
const allRestaurants = atxPlacesData as AtxEatPlace[];
const allArticles = articlesData as AtxArticle[];

export function loadAppDataServer(): AppData {
  return {
    events: allEvents,
    venues: allVenues,
    evergreenEvents: allEvergreenEvents,
    restaurants: allRestaurants,
    articles: allArticles,
    isPartial: false
  };
}

export function buildHomeInitialData(): AppData {
  const events = [...allEvents]
    .filter((event) => isUpcoming(event))
    .sort((a, b) => {
      const aBoost = eventFirstPaintBoost(a);
      const bBoost = eventFirstPaintBoost(b);
      return b.popularityScore + b.attendeeCount / 24 + bBoost - (a.popularityScore + a.attendeeCount / 24 + aBoost) || sortSoonest(a, b);
    })
    .slice(0, 260)
    .sort(sortSoonest);
  const venueIds = new Set(events.map((event) => event.venueId));
  const venues = allVenues
    .filter((venue) => venueIds.has(venue.id) || venue.upcomingCount > 0 || (venue.evergreenCount ?? 0) > 0)
    .sort((a, b) => b.popularityScore - a.popularityScore || b.upcomingCount - a.upcomingCount)
    .slice(0, 180);

  return {
    events,
    venues,
    evergreenEvents: allEvergreenEvents.slice(0, 80),
    restaurants: rankedRestaurants().slice(0, 96),
    articles: allArticles,
    isPartial: true
  };
}

export function buildExploreInitialData(): AppData {
  const events = [...allEvents].filter((event) => isUpcoming(event)).sort(sortSoonest).slice(0, 420);
  const venueIds = new Set(events.map((event) => event.venueId));
  const venues = allVenues
    .filter((venue) => venueIds.has(venue.id) || venue.upcomingCount > 0 || (venue.evergreenCount ?? 0) > 0)
    .sort((a, b) => b.upcomingCount - a.upcomingCount || b.popularityScore - a.popularityScore)
    .slice(0, 240);

  return {
    events,
    venues,
    evergreenEvents: allEvergreenEvents.slice(0, 120),
    restaurants: rankedRestaurants().slice(0, 144),
    articles: allArticles,
    isPartial: true
  };
}

function eventFirstPaintBoost(event: EventItem) {
  if (isTonight(event)) return 70;
  if (isToday(event)) return 54;
  if (isTomorrow(event)) return 28;
  if (isThisWeekend(event)) return 18;
  return 0;
}

function rankedRestaurants() {
  return [...allRestaurants].sort((a, b) => {
    const aScore = (a.appearances ?? 0) * 10 + (a.image_url ? 5 : 0);
    const bScore = (b.appearances ?? 0) * 10 + (b.image_url ? 5 : 0);
    return bScore - aScore || a.name.localeCompare(b.name);
  });
}
