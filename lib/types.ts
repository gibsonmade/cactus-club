export type Area =
  | "Downtown"
  | "East Side"
  | "Central"
  | "Barton/Zilker"
  | "South Austin"
  | "North Austin"
  | "Burbs";

export type VibeTag =
  | "Date Night"
  | "Free"
  | "Weird Austin"
  | "Low-Key"
  | "Popular"
  | "Social"
  | "Outdoors"
  | "Late Night"
  | "Under the Radar"
  | "Wellness"
  | "Live Music"
  | "Comedy"
  | "Dancing"
  | "Patio";

export type MoveVibe =
  | "Main Character Night"
  | "Touch Grass"
  | "Cheap Thrills"
  | "Date Without Trying Too Hard"
  | "East Side Energy"
  | "Avoid Staying Home"
  | "One Drink Turns Into Four"
  | "Soft Night"
  | "Weird Austin"
  | "Actually Worth It";

export type MoveEnergy = "soft" | "medium" | "chaos";
export type MoveCompany = "solo" | "date" | "friends";

export type MoveIntent = {
  vibe: MoveVibe;
  energy: MoveEnergy;
  company: MoveCompany;
};

export type ScoreSet = {
  smart: number;
  popular: number;
  weird: number;
  dateNight: number;
  social: number;
  lowKey: number;
  wellness: number;
  nearby: number;
};

export type EventItem = {
  id: string;
  source: string;
  title: string;
  byline?: string;
  category: string;
  eventUrl?: string;
  imageUrl?: string;
  startDateTime: string;
  endDateTime?: string;
  date: string;
  timeText: string;
  isRecurring: boolean;
  recurrenceLabel?: string;
  isFree: boolean;
  ticketUrl?: string;
  venueId: string;
  venueName: string;
  area: Area;
  neighborhoodPersonality: string;
  popularityScore: number;
  attendeeCount: number;
  tastemakerCount: number;
  vibeTags: VibeTag[];
  scores: ScoreSet;
  distanceMiles?: number;
};

export type EvergreenEventItem = {
  id: string;
  source: "evergreen";
  title: string;
  category: string;
  venueId: string;
  venueName: string;
  vibeTags: string[];
};

export type VenueItem = {
  id: string;
  name: string;
  source?: string;
  area: Area;
  neighborhoodPersonality: string;
  vibe: string;
  imageUrl?: string;
  venueUrl?: string;
  address?: string;
  evergreenEventIds?: string[];
  evergreenCount?: number;
  upcomingEventIds: string[];
  upcomingCount: number;
  popularityScore: number;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  mapUrl: string;
};

export type SavedState = {
  savedEvents: string[];
  savedVenues: string[];
  hiddenEvents: string[];
  preferredVibes: VibeTag[];
  preferredAreas: Area[];
  userLocation?: { latitude: number; longitude: number };
};
