// Relative time engine for matchday plan scheduling

export interface PhaseDefinition {
  phaseKey: string;
  label: string;
  description: string;
  anchorType: "relative_start" | "relative_end" | "absolute";
  startOffsetMinutes: number;  // relative to event_start (negative = before)
  endOffsetMinutes: number;    // relative to anchor (negative = before)
  endAnchorType?: "relative_start" | "relative_end";
  suggestedContent: string[];
  color: string;
}

export const MATCHDAY_PHASES: PhaseDefinition[] = [
  {
    phaseKey: "pre_match",
    label: "Pre-match",
    description: "Build anticipation before the event",
    anchorType: "relative_start",
    startOffsetMinutes: -1440, // T-24h
    endOffsetMinutes: -180,    // T-3h
    endAnchorType: "relative_start",
    suggestedContent: [
      "Match poster", "Squad announcement", "Match info", "Previous results",
      "Player to watch", "Fan poll", "Travel content", "Sponsor activation",
    ],
    color: "#3B82F6",
  },
  {
    phaseKey: "arrival",
    label: "Arrival & Warm-up",
    description: "Team arrival, preparation and build-up",
    anchorType: "relative_start",
    startOffsetMinutes: -90,  // T-90m
    endOffsetMinutes: -15,    // T-15m
    endAnchorType: "relative_start",
    suggestedContent: [
      "Team arrival", "Stadium arrival", "Dressing room", "Equipment prep",
      "Warm-up photos", "Warm-up video", "Starting lineup", "Behind the scenes",
    ],
    color: "#8B5CF6",
  },
  {
    phaseKey: "live",
    label: "Live Event",
    description: "Real-time content during the event",
    anchorType: "relative_start",
    startOffsetMinutes: 0,    // Event start
    endOffsetMinutes: 0,      // Event end
    endAnchorType: "relative_end",
    suggestedContent: [
      "Kick-off / Event start", "Live score updates", "Key moments",
      "Half-time update", "Goals / Major actions", "Fan reactions",
      "Sponsor content", "Final moments",
    ],
    color: "#EF4444",
  },
  {
    phaseKey: "post_match",
    label: "Post-match",
    description: "Immediate reaction and celebration content",
    anchorType: "relative_end",
    startOffsetMinutes: 0,    // Event end
    endOffsetMinutes: 180,    // +3h
    endAnchorType: "relative_end",
    suggestedContent: [
      "Final result", "Celebration / Team reaction", "Player reaction",
      "Coach reaction", "Quote graphic", "Press conference",
      "Highlights", "Match gallery", "MVP voting", "Sponsor integration",
    ],
    color: "#F59E0B",
  },
  {
    phaseKey: "next_day",
    label: "Next Day",
    description: "Recap and evergreen content the following day",
    anchorType: "relative_end",
    startOffsetMinutes: 720,  // +12h
    endOffsetMinutes: 1440,   // +24h
    endAnchorType: "relative_end",
    suggestedContent: [
      "Match recap", "Best moments", "Photo dump", "MVP",
      "Behind the scenes", "Tactical recap", "Fan reactions",
      "Next fixture", "Evergreen content",
    ],
    color: "#10B981",
  },
];

// Add offset minutes to an ISO datetime string, return { date: "YYYY-MM-DD", time: "HH:MM" }
export function addMinutesToISO(
  iso: string,
  offsetMinutes: number
): { date: string; time: string } {
  const base = new Date(iso);
  const result = new Date(base.getTime() + offsetMinutes * 60 * 1000);
  const date = result.toISOString().slice(0, 10);
  const time = `${String(result.getUTCHours()).padStart(2, "0")}:${String(result.getUTCMinutes()).padStart(2, "0")}`;
  return { date, time };
}

// Build an ISO datetime from a YYYY-MM-DD date and HH:MM time
export function toISO(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

// Calculate absolute start/end for a phase given event start and end ISO strings
export function resolvePhase(
  phase: PhaseDefinition,
  eventStartISO: string,
  eventEndISO: string
): { startsAt: string; endsAt: string } {
  const startAnchor = phase.anchorType === "relative_end" ? eventEndISO : eventStartISO;
  const endAnchor = (phase.endAnchorType ?? phase.anchorType) === "relative_end" ? eventEndISO : eventStartISO;

  const startResult = addMinutesToISO(startAnchor, phase.startOffsetMinutes);
  const endResult = addMinutesToISO(endAnchor, phase.endOffsetMinutes);

  return {
    startsAt: `${startResult.date}T${startResult.time}:00.000Z`,
    endsAt: `${endResult.date}T${endResult.time}:00.000Z`,
  };
}

// Format an absolute ISO string for display: "Mon 25 Aug · 18:00"
export function formatPhaseTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
