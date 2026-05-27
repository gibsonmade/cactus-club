import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SHEET_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRedKu92U5eyqypEeXdxP129uIV1r9twjsPr22GVf0G1U8waejG4yJUqDvGyZMl7JVwV-iX_ej0mgE0/pub";

const CSV_URLS = {
  events: `${SHEET_BASE}?gid=0&single=true&output=csv`,
  evergreenVenues: `${SHEET_BASE}?gid=876399214&single=true&output=csv`,
  evergreenEvents: `${SHEET_BASE}?gid=1947903743&single=true&output=csv`
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "public", "data");

const AREAS = {
  Downtown: "Downtown but worth it",
  "East Side": "East Side energy",
  Central: "Classic Austin orbit",
  "Barton/Zilker": "Touch grass territory",
  "South Austin": "South Austin dive energy",
  "North Austin": "North side sleeper hit",
  Burbs: "Worth the drive if the mood is right"
};

const VENUE_OVERRIDES = {
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
  "Alamo Drafthouse South Lamar": { area: "Barton/Zilker", latitude: 30.2554, longitude: -97.7633, vibe: "movie night with standards" },
  "Hole in the Wall": { area: "Central", latitude: 30.2866, longitude: -97.7414, vibe: "campus-adjacent music cave" },
  "Austin Public Library Spicewood Springs": { area: "North Austin", vibe: "North Austin library orbit" },
  "Krause's Cafe & Biergarten": { area: "Burbs", vibe: "New Braunfels day trip energy" },
  "The Little Longhorn Saloon": { area: "North Austin", latitude: 30.3317, longitude: -97.7246, vibe: "chicken-shit bingo energy" },
  "Sahara Lounge": { area: "East Side", latitude: 30.2887, longitude: -97.6867, vibe: "global rhythm fever dream" }
};

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  const [headers, ...records] = rows;
  const normalizedHeaders = headers.map((header) => header.replace(/^\uFEFF/, "").trim());
  return records.map((record) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, record[index] ?? ""])));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value) {
  return String(value).toLowerCase() === "true";
}

function inferArea(venueName) {
  const override = VENUE_OVERRIDES[venueName];
  if (override) return override.area;
  const name = venueName.toLowerCase();
  const hasAny = (terms) => terms.some((term) => name.includes(term));
  if (hasAny(["round rock", "pflugerville", "lakeway", "cedar park", "dripping", "bee cave", "buda", "kyle", "georgetown", "leander", "hutto", "san marcos", "wimberley", "spicewood,", "volente", "luckenbach", "gruene", "new braunfels"])) return "Burbs";
  if (hasAny(["east", "e 6th", "e. 6th", "manor", "cesar chavez", "riverside", "airport", "springdale", "govalle", "webberville", "white horse", "hotel vegas", "volstead", "sahara", "lost well", "blue owl", "fiesta gardens", "buzz mill"])) return "East Side";
  if (hasAny(["downtown", "rainey", "red river", "congress", "w 4th", "west 4th", "w 6th", "west 6th", "4th street", "6th street", "waller creek", "mohawk", "parish", "elephant room", "acl live", "3ten", "antone", "paramount", "stateside", "firehouse", "neon grotto", "flamingo cantina", "swan dive"])) return "Downtown";
  if (hasAny(["zilker", "barton", "south lamar", "s lamar", "long center", "mozart", "patrizi's (west)"])) return "Barton/Zilker";
  if (hasAny(["south", "s congress", "south congress", "s 1st", "south 1st", "slaughter", "menchaca", "manchaca", "stassney", "saxon", "continental", "c-boy", "sam's town", "far out", "sagebrush", "broken spoke", "guero", "abgb", "bouldin", "highball"])) return "South Austin";
  if (hasAny(["north", "burnet", "brentwood", "north loop", "crestview", "domain", "little longhorn", "kick butt", "haute spot"])) return "North Austin";
  return "Central";
}

function uniq(items) {
  return Array.from(new Set(items));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deriveVibeTags(event) {
  const text = `${event.title} ${event.byline ?? ""} ${event.category} ${event.venueName}`.toLowerCase();
  const hour = new Date(event.startDateTime).getHours();
  const tags = [];
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

function scoreEvent(event) {
  const text = `${event.title} ${event.byline ?? ""} ${event.category} ${event.venueName}`.toLowerCase();
  const hour = new Date(event.startDateTime).getHours();
  const has = (tag) => event.vibeTags.includes(tag);
  const popular = clamp(event.popularityScore + event.attendeeCount * 1.4 + event.tastemakerCount * 7, 0, 100);
  const weird = clamp((has("Weird Austin") ? 58 : 0) + (/experimental|odd|cult|drag|burlesque/.test(text) ? 22 : 0) + event.tastemakerCount * 4, 0, 100);
  const dateNight = clamp((has("Date Night") ? 55 : 0) + (has("Low-Key") ? 10 : 0) + (hour >= 18 && hour <= 21 ? 18 : 0), 0, 100);
  const social = clamp((has("Social") ? 48 : 0) + (has("Dancing") ? 22 : 0) + event.attendeeCount * 1.7 + (hour >= 21 ? 12 : 0), 0, 100);
  const lowKey = clamp((has("Low-Key") ? 54 : 0) + (event.attendeeCount < 8 ? 16 : 0) + (hour < 21 ? 14 : 0), 0, 100);
  const wellness = clamp((has("Wellness") ? 70 : 0) + (has("Outdoors") ? 12 : 0), 0, 100);
  const nearby = event.area === "East Side" || event.area === "Downtown" || event.area === "Central" ? 72 : 52;
  const smart = clamp(popular * 0.3 + social * 0.18 + dateNight * 0.16 + weird * 0.12 + nearby * 0.12 + (event.isFree ? 9 : 0) + event.tastemakerCount * 3, 0, 100);
  return { smart, popular, weird, dateNight, social, lowKey, wellness, nearby };
}

function normalize(row) {
  const startDateTime = row.start_datetime;
  const start = new Date(startDateTime);
  if (!row.source_event_id || !row.title || !row.venue_id || !row.venue_name || !Number.isFinite(start.getTime())) return null;
  const area = inferArea(row.venue_name);
  const event = {
    id: row.source_event_id,
    source: row.source || "unknown",
    title: row.title.trim(),
    byline: row.byline || undefined,
    category: row.category || "variety other",
    eventUrl: row.event_url || undefined,
    imageUrl: row.image_url || undefined,
    startDateTime,
    endDateTime: row.end_datetime || undefined,
    date: row.date || startDateTime.slice(0, 10),
    timeText: row.time_text || "",
    isRecurring: bool(row.is_recurring),
    recurrenceLabel: row.recurrence_label || undefined,
    isFree: bool(row.is_free) || /(^|[^a-z])free([^a-z]|$)/i.test(row.recurrence_label || ""),
    ticketUrl: row.ticket_url || undefined,
    venueId: row.venue_id,
    venueName: row.venue_name,
    area,
    neighborhoodPersonality: AREAS[area],
    popularityScore: number(row.popularity_score),
    attendeeCount: number(row.attendee_count),
    tastemakerCount: number(row.tastemaker_count),
    vibeTags: [],
    scores: { smart: 0, popular: 0, weird: 0, dateNight: 0, social: 0, lowKey: 0, wellness: 0, nearby: 0 }
  };
  event.vibeTags = deriveVibeTags(event);
  event.scores = scoreEvent(event);
  return event;
}

function normalizeEvergreenVenue(row, evergreenEventsByVenue) {
  if (!row.venue_id || !row.venue_name) return null;
  const area = inferArea(`${row.venue_name} ${row.street ?? ""} ${row.zip ?? ""}`);
  const latitude = number(row.latitude);
  const longitude = number(row.longitude);
  const evergreenEvents = evergreenEventsByVenue.get(row.venue_id) ?? [];
  const tags = uniq(evergreenEvents.flatMap((event) => event.vibeTags));
  const vibe = evergreenVenueVibe(row.venue_name, tags, area);
  return {
    id: row.venue_id,
    name: row.venue_name.trim(),
    source: "evergreen",
    area,
    neighborhoodPersonality: AREAS[area],
    vibe,
    imageUrl: row.venue_pic || undefined,
    venueUrl: row.venue_url || undefined,
    address: [row.street, row.city, row.state, row.zip].filter(Boolean).join(", ") || undefined,
    upcomingEventIds: [],
    upcomingCount: 0,
    evergreenEventIds: evergreenEvents.map((event) => event.id),
    evergreenCount: evergreenEvents.length,
    popularityScore: Math.max(14, evergreenEvents.length * 8),
    latitude: latitude || undefined,
    longitude: longitude || undefined,
    mapUrl: row.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.venue_name} Austin TX`)}`
  };
}

function normalizeEvergreenEvent(row) {
  const id = row.source_event_id || row.ource_event_id;
  if (!id || !row.title || !row.venue_id || !row.venue_name) return null;
  return {
    id,
    source: "evergreen",
    title: row.title.trim(),
    category: row.category || "Anytime",
    venueId: row.venue_id,
    venueName: row.venue_name,
    vibeTags: row.vibe_tags
      ? row.vibe_tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : []
  };
}

function evergreenVenueVibe(name, tags, area) {
  const text = `${name} ${tags.join(" ")}`.toLowerCase();
  if (/coffee|journal|reading|creative|book/.test(text)) return "easy hangout energy";
  if (/patio|drinks|food|beer|tacos/.test(text)) return "casual drinks without a plan";
  if (/park|trail|springs|greenbelt|outdoor|touch-grass|picnic/.test(text)) return "touch grass default";
  if (/date-night|golden-hour|sunset/.test(text)) return "low-pressure date move";
  if (/social|groups|after-work/.test(text)) return "bring whoever texted back";
  return AREAS[area].toLowerCase();
}

function mergeVenueCollections(eventVenues, evergreenVenues) {
  const byId = new Map(eventVenues.map((venue) => [venue.id, venue]));
  for (const evergreenVenue of evergreenVenues) {
    const existing = byId.get(evergreenVenue.id);
    if (existing) {
      byId.set(evergreenVenue.id, {
        ...existing,
        source: existing.source ?? "events",
        venueUrl: evergreenVenue.venueUrl ?? existing.venueUrl,
        address: evergreenVenue.address ?? existing.address,
        evergreenEventIds: evergreenVenue.evergreenEventIds,
        evergreenCount: evergreenVenue.evergreenCount,
        latitude: existing.latitude ?? evergreenVenue.latitude,
        longitude: existing.longitude ?? evergreenVenue.longitude,
        mapUrl: existing.mapUrl || evergreenVenue.mapUrl
      });
    } else {
      byId.set(evergreenVenue.id, evergreenVenue);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aTotal = a.upcomingCount + (a.evergreenCount ?? 0);
    const bTotal = b.upcomingCount + (b.evergreenCount ?? 0);
    return bTotal - aTotal || b.popularityScore - a.popularityScore;
  });
}

function eventEndTime(event) {
  const start = new Date(event.startDateTime).getTime();
  const end = event.endDateTime ? new Date(event.endDateTime).getTime() : start + 4 * 60 * 60 * 1000;
  return Number.isFinite(end) ? end : start;
}

function venueVibeFromTags(tags, area) {
  if (tags.includes("Dancing")) return "dance-floor gravitational pull";
  if (tags.includes("Live Music")) return "live music with a pulse";
  if (tags.includes("Comedy")) return "laughs without overplanning";
  if (tags.includes("Wellness")) return "reset button energy";
  if (tags.includes("Patio")) return "patio weather friendly";
  if (tags.includes("Weird Austin")) return "beautifully unserious Austin";
  return AREAS[area].toLowerCase();
}

function deriveVenues(events) {
  const byVenue = new Map();
  for (const event of events) {
    const list = byVenue.get(event.venueId) ?? [];
    list.push(event);
    byVenue.set(event.venueId, list);
  }
  return Array.from(byVenue.entries())
    .map(([id, venueEvents]) => {
      const name = venueEvents[0].venueName;
      const area = inferArea(name);
      const override = VENUE_OVERRIDES[name];
      const tags = uniq(venueEvents.flatMap((event) => event.vibeTags));
      const popularityScore = Math.round(venueEvents.reduce((sum, event) => sum + event.popularityScore, 0) / Math.max(venueEvents.length, 1));
      return {
        id,
        name,
        area,
        neighborhoodPersonality: AREAS[area],
        vibe: override?.vibe ?? venueVibeFromTags(tags, area),
        imageUrl: venueEvents.find((event) => event.imageUrl)?.imageUrl,
        upcomingEventIds: venueEvents.map((event) => event.id),
        upcomingCount: venueEvents.length,
        popularityScore,
        latitude: override?.latitude,
        longitude: override?.longitude,
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Austin TX`)}`
      };
    })
    .sort((a, b) => b.upcomingCount - a.upcomingCount || b.popularityScore - a.popularityScore);
}

async function main() {
  const [eventsResponse, evergreenVenuesResponse, evergreenEventsResponse] = await Promise.all([
    fetch(CSV_URLS.events),
    fetch(CSV_URLS.evergreenVenues),
    fetch(CSV_URLS.evergreenEvents)
  ]);
  if (!eventsResponse.ok) throw new Error(`CSV fetch failed: ${eventsResponse.status} ${eventsResponse.statusText}`);
  if (!evergreenVenuesResponse.ok) throw new Error(`Evergreen venues fetch failed: ${evergreenVenuesResponse.status} ${evergreenVenuesResponse.statusText}`);
  if (!evergreenEventsResponse.ok) throw new Error(`Evergreen events fetch failed: ${evergreenEventsResponse.status} ${evergreenEventsResponse.statusText}`);
  const [csv, evergreenVenuesCsv, evergreenEventsCsv] = await Promise.all([
    eventsResponse.text(),
    evergreenVenuesResponse.text(),
    evergreenEventsResponse.text()
  ]);
  const rows = parseCsv(csv);
  const evergreenEventRows = parseCsv(evergreenEventsCsv);
  const evergreenEvents = evergreenEventRows.map(normalizeEvergreenEvent).filter(Boolean);
  const evergreenEventsByVenue = new Map();
  for (const event of evergreenEvents) {
    const list = evergreenEventsByVenue.get(event.venueId) ?? [];
    list.push(event);
    evergreenEventsByVenue.set(event.venueId, list);
  }
  const evergreenVenueRows = parseCsv(evergreenVenuesCsv);
  const evergreenVenues = evergreenVenueRows
    .map((row) => normalizeEvergreenVenue(row, evergreenEventsByVenue))
    .filter(Boolean);
  const importedAt = new Date();
  const events = rows
    .map(normalize)
    .filter(Boolean)
    .filter((event) => eventEndTime(event) >= importedAt.getTime())
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  const venues = mergeVenueCollections(deriveVenues(events), evergreenVenues);
  const report = {
    importedAt: importedAt.toISOString(),
    source: CSV_URLS.events,
    sourceRows: rows.length,
    upcomingEvents: events.length,
    evergreenVenues: evergreenVenues.length,
    evergreenEvents: evergreenEvents.length,
    venues: venues.length,
    firstEventDate: events[0]?.startDateTime,
    lastEventDate: events.at(-1)?.startDateTime
  };

  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "events.json"), `${JSON.stringify(events, null, 2)}\n`);
  await writeFile(join(dataDir, "venues.json"), `${JSON.stringify(venues, null, 2)}\n`);
  await writeFile(join(dataDir, "evergreen-venues.json"), `${JSON.stringify(evergreenVenues, null, 2)}\n`);
  await writeFile(join(dataDir, "evergreen-events.json"), `${JSON.stringify(evergreenEvents, null, 2)}\n`);
  await writeFile(join(dataDir, "import-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Imported ${events.length} upcoming events, ${evergreenEvents.length} evergreen moves, and ${venues.length} venues.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
