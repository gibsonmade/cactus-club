import type { Area, EventItem, MoveIntent, VenueItem, VibeTag } from "@/lib/types";
import { clamp, uniq } from "@/lib/utils";

const AREA_PERSONALITY: Record<Area, string> = {
  Downtown: "Downtown but worth it",
  "East Side": "East Side energy",
  Central: "Classic Austin orbit",
  "Barton/Zilker": "Touch grass territory",
  "South Austin": "South Austin dive energy",
  "North Austin": "North side sleeper hit",
  Burbs: "Worth the drive if the mood is right"
};

const VENUE_OVERRIDES: Record<string, { area: Area; latitude?: number; longitude?: number; vibe?: string }> = {
  "ACL Live at the Moody Theater": { area: "Downtown", latitude: 30.2651, longitude: -97.7472, vibe: "big-room Austin mythology" },
  "3TEN Austin City Limits Live": { area: "Downtown", latitude: 30.2651, longitude: -97.7472, vibe: "small room, big Austin name" },
  "Antone's": { area: "Downtown", latitude: 30.2669, longitude: -97.7401, vibe: "blues history with good shoes" },
  "Cheer Up Charlies": { area: "Downtown", latitude: 30.2695, longitude: -97.736, vibe: "queer, glittery, casually iconic" },
  "Empire Control Room & Garage": { area: "Downtown", latitude: 30.2677, longitude: -97.7361, vibe: "Red River late-night gravity" },
  "Mohawk Austin": { area: "Downtown", latitude: 30.2701, longitude: -97.7356, vibe: "Red River institution" },
  "Parker Jazz Club": { area: "Downtown", latitude: 30.2663, longitude: -97.7426, vibe: "downtown jazz, dressed up" },
  "RAIN on 4th": { area: "Downtown", latitude: 30.267, longitude: -97.7451, vibe: "Fourth Street social orbit" },
  "The Elephant Room": { area: "Downtown", latitude: 30.2669, longitude: -97.7431, vibe: "basement jazz, Austin classic" },
  "The White Horse": { area: "East Side", latitude: 30.2622, longitude: -97.7176, vibe: "two-step chaos" },
  "Hotel Vegas": { area: "East Side", latitude: 30.2604, longitude: -97.7156, vibe: "sweaty East Side lore" },
  "Hotel Vegas & The Volstead Lounge": { area: "East Side", latitude: 30.2604, longitude: -97.7156, vibe: "sweaty East Side lore" },
  "Come and Take It Live": { area: "East Side", latitude: 30.2386, longitude: -97.7287, vibe: "Riverside volume" },
  "Central Machine Works Brewery & Beer Hall": { area: "East Side", latitude: 30.2607, longitude: -97.6982, vibe: "big patio social gravity" },
  "The Continental Club": { area: "South Austin", latitude: 30.2503, longitude: -97.7496, vibe: "South Congress institution" },
  "The Continental Club Gallery": { area: "South Austin", latitude: 30.2503, longitude: -97.7496, vibe: "upstairs, close, grown" },
  "C-Boy's Heart & Soul Bar": { area: "South Austin", latitude: 30.2475, longitude: -97.7502, vibe: "red room, late-night soul" },
  "The Far Out Lounge & Stage": { area: "South Austin", latitude: 30.2067, longitude: -97.7767, vibe: "yard party with a stage" },
  "Meanwhile Brewing": { area: "South Austin", latitude: 30.2152, longitude: -97.701, vibe: "patio weather headquarters" },
  "Sam's Town Point": { area: "South Austin", latitude: 30.1737, longitude: -97.8258, vibe: "deep South Austin dive lore" },
  "The Saxon Pub": { area: "South Austin", latitude: 30.2537, longitude: -97.7637, vibe: "songwriter room with history" },
  "Zilker Botanical Garden": { area: "Barton/Zilker", latitude: 30.267, longitude: -97.7706, vibe: "touch grass properly" },
  "Barton Springs": { area: "Barton/Zilker", latitude: 30.264, longitude: -97.7713, vibe: "cold plunge social reset" },
  "Alamo Drafthouse South Lamar": { area: "Barton/Zilker", latitude: 30.2554, longitude: -97.7633, vibe: "movie night with standards" },
  "Hole in the Wall": { area: "Central", latitude: 30.2866, longitude: -97.7414, vibe: "campus-adjacent music cave" },
  "Austin Public Library Spicewood Springs": { area: "North Austin", vibe: "North Austin library orbit" },
  "Krause's Cafe & Biergarten": { area: "Burbs", vibe: "New Braunfels day trip energy" },
  "The Little Longhorn Saloon": { area: "North Austin", latitude: 30.3317, longitude: -97.7246, vibe: "chicken-shit bingo energy" },
  "Sahara Lounge": { area: "East Side", latitude: 30.2887, longitude: -97.6867, vibe: "global rhythm fever dream" }
};

export function inferArea(venueName: string): Area {
  const override = VENUE_OVERRIDES[venueName];
  if (override) return override.area;
  const name = venueName.toLowerCase();
  const hasAny = (terms: string[]) => terms.some((term) => name.includes(term));
  if (hasAny(["round rock", "pflugerville", "lakeway", "cedar park", "dripping", "bee cave", "buda", "kyle", "georgetown", "leander", "hutto", "san marcos", "wimberley", "spicewood,", "volente", "luckenbach", "gruene", "new braunfels"])) return "Burbs";
  if (hasAny(["east", "e 6th", "e. 6th", "manor", "cesar chavez", "riverside", "airport", "springdale", "govalle", "webberville", "white horse", "hotel vegas", "volstead", "sahara", "lost well", "blue owl", "fiesta gardens", "buzz mill"])) return "East Side";
  if (hasAny(["downtown", "rainey", "red river", "congress", "w 4th", "west 4th", "w 6th", "west 6th", "4th street", "6th street", "waller creek", "mohawk", "parish", "elephant room", "acl live", "3ten", "antone", "paramount", "stateside", "firehouse", "neon grotto", "flamingo cantina", "swan dive"])) return "Downtown";
  if (hasAny(["zilker", "barton", "south lamar", "s lamar", "long center", "mozart", "patrizi's (west)"])) return "Barton/Zilker";
  if (hasAny(["south", "s congress", "south congress", "s 1st", "south 1st", "slaughter", "menchaca", "manchaca", "stassney", "saxon", "continental", "c-boy", "sam's town", "far out", "sagebrush", "broken spoke", "guero", "abgb", "bouldin", "highball"])) return "South Austin";
  if (hasAny(["north", "burnet", "brentwood", "north loop", "crestview", "domain", "little longhorn", "kick butt", "haute spot"])) return "North Austin";
  return "Central";
}

export function neighborhoodPersonality(area: Area) {
  return AREA_PERSONALITY[area];
}

function textFor(event: Pick<EventItem, "title" | "byline" | "category" | "venueName">) {
  return `${event.title} ${event.byline ?? ""} ${event.category} ${event.venueName}`.toLowerCase();
}

export function deriveVibeTags(event: Pick<EventItem, "title" | "byline" | "category" | "venueName" | "isFree" | "popularityScore" | "attendeeCount" | "startDateTime">): VibeTag[] {
  const text = textFor(event);
  const hour = new Date(event.startDateTime).getHours();
  const tags: VibeTag[] = [];
  if (event.isFree) tags.push("Free");
  if (event.popularityScore >= 35 || event.attendeeCount >= 18) tags.push("Popular");
  if (/drag|burlesque|cult|immersive|karaoke|oddit|weird|themed|terror|psych|zodiac/.test(text)) tags.push("Weird Austin");
  if (/yoga|fitness|run|walk|market|outdoor|garden|springs|wellness|brunch/.test(text)) tags.push("Wellness");
  if (/patio|brewery|yard|outdoor|garden|springs|park/.test(text)) tags.push("Outdoors", "Patio");
  if (/comedy|stand-up|improv/.test(text)) tags.push("Comedy");
  if (/dj|dance|party|club|disco|rave|salsa|latin night/.test(text)) tags.push("Dancing", "Social");
  if (/music|band|concert|jazz|blues|songwriter|singer|live/.test(text)) tags.push("Live Music");
  if (/coffee|listening|book|literary|art|film|jazz|acoustic|gallery/.test(text) || hour < 20) tags.push("Low-Key");
  if (hour >= 21) tags.push("Late Night");
  if (/music|comedy|art|film|jazz|wine|dinner|theatre|theater/.test(text) && !/trivia|network|kids|camp/.test(text) && hour >= 17) tags.push("Date Night");
  if (event.popularityScore < 12 && event.attendeeCount <= 5) tags.push("Under the Radar");
  if (!tags.length) tags.push("Social");
  return uniq(tags).slice(0, 5);
}

export function scoreEvent(event: Pick<EventItem, "title" | "byline" | "category" | "venueName" | "isFree" | "popularityScore" | "attendeeCount" | "tastemakerCount" | "startDateTime" | "area" | "vibeTags">) {
  const text = textFor(event);
  const hour = new Date(event.startDateTime).getHours();
  const has = (tag: VibeTag) => event.vibeTags.includes(tag);
  const popular = clamp(event.popularityScore + event.attendeeCount * 1.4 + event.tastemakerCount * 7, 0, 100);
  const weird = clamp((has("Weird Austin") ? 58 : 0) + (/experimental|odd|cult|drag|burlesque/.test(text) ? 22 : 0) + event.tastemakerCount * 4, 0, 100);
  const dateNight = clamp((has("Date Night") ? 55 : 0) + (has("Low-Key") ? 10 : 0) + (hour >= 18 && hour <= 21 ? 18 : 0), 0, 100);
  const social = clamp((has("Social") ? 48 : 0) + (has("Dancing") ? 22 : 0) + event.attendeeCount * 1.7 + (hour >= 21 ? 12 : 0), 0, 100);
  const lowKey = clamp((has("Low-Key") ? 54 : 0) + (event.attendeeCount < 8 ? 16 : 0) + (hour < 21 ? 14 : 0), 0, 100);
  const wellness = clamp((has("Wellness") ? 70 : 0) + (has("Outdoors") ? 12 : 0), 0, 100);
  const nearby = event.area === "East Side" || event.area === "Downtown" || event.area === "Central" ? 72 : 52;
  const smart = clamp(popular * 0.3 + social * 0.18 + dateNight * 0.16 + weird * 0.12 + nearby * 0.12 + (event.isFree ? 9 : 0) + (event.tastemakerCount * 3), 0, 100);
  return { smart, popular, weird, dateNight, social, lowKey, wellness, nearby };
}

export function chooseForMove(events: EventItem[], intent: MoveIntent) {
  const weights: Record<string, (event: EventItem) => number> = {
    "Main Character Night": (e) => e.scores.popular + e.scores.social + (e.vibeTags.includes("Dancing") ? 20 : 0),
    "Touch Grass": (e) => e.scores.wellness + (e.vibeTags.includes("Outdoors") ? 30 : 0),
    "Cheap Thrills": (e) => (e.isFree ? 70 : 0) + e.scores.smart,
    "Date Without Trying Too Hard": (e) => e.scores.dateNight + e.scores.lowKey,
    "East Side Energy": (e) => (e.area === "East Side" ? 80 : 0) + e.scores.social,
    "Avoid Staying Home": (e) => e.scores.smart + e.scores.popular,
    "One Drink Turns Into Four": (e) => e.scores.social + (e.vibeTags.includes("Late Night") ? 28 : 0),
    "Soft Night": (e) => e.scores.lowKey + e.scores.dateNight,
    "Weird Austin": (e) => e.scores.weird + e.scores.social * 0.25,
    "Actually Worth It": (e) => e.scores.smart + e.scores.popular + e.tastemakerCount * 5
  };
  const energyBonus = (event: EventItem) => {
    if (intent.energy === "chaos") return event.scores.social + (event.vibeTags.includes("Late Night") ? 30 : 0);
    if (intent.energy === "soft") return event.scores.lowKey + event.scores.dateNight * 0.25;
    return event.scores.smart;
  };
  const companyBonus = (event: EventItem) => {
    if (intent.company === "date") return event.scores.dateNight;
    if (intent.company === "friends") return event.scores.social;
    return event.scores.lowKey + event.scores.weird * 0.2;
  };
  const base = weights[intent.vibe] ?? weights["Actually Worth It"];
  return [...events]
    .sort((a, b) => base(b) + energyBonus(b) * 0.25 + companyBonus(b) * 0.2 - (base(a) + energyBonus(a) * 0.25 + companyBonus(a) * 0.2))
    .slice(0, 3);
}

export function enrichVenue(id: string, name: string, events: EventItem[]): VenueItem {
  const area = inferArea(name);
  const override = VENUE_OVERRIDES[name];
  const venueEvents = events.filter((event) => event.venueId === id);
  const bestImage = venueEvents.find((event) => event.imageUrl)?.imageUrl;
  const popularityScore = Math.round(venueEvents.reduce((sum, event) => sum + event.popularityScore, 0) / Math.max(venueEvents.length, 1));
  const tags = uniq(venueEvents.flatMap((event) => event.vibeTags));
  const vibe = override?.vibe ?? venueVibeFromTags(tags, area);
  return {
    id,
    name,
    area,
    neighborhoodPersonality: neighborhoodPersonality(area),
    vibe,
    imageUrl: bestImage,
    upcomingEventIds: venueEvents.map((event) => event.id),
    upcomingCount: venueEvents.length,
    popularityScore,
    latitude: override?.latitude,
    longitude: override?.longitude,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Austin TX`)}`
  };
}

function venueVibeFromTags(tags: VibeTag[], area: Area) {
  if (tags.includes("Dancing")) return "dance-floor gravitational pull";
  if (tags.includes("Live Music")) return "live music with a pulse";
  if (tags.includes("Comedy")) return "laughs without overplanning";
  if (tags.includes("Wellness")) return "reset button energy";
  if (tags.includes("Patio")) return "patio weather friendly";
  if (tags.includes("Weird Austin")) return "beautifully unserious Austin";
  return AREA_PERSONALITY[area].toLowerCase();
}
