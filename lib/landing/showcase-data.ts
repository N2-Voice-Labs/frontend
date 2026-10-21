export type GalleryCategory = "translation" | "support" | "booking";

/**
 * Sample agents for the landing gallery. `id` is the public demo slug: the play button starts a real
 * session with it, and the server only accepts slugs listed in DEMO_AGENTS.
 */
export const GALLERY_AGENTS: readonly { id: string; name: string; role: string; langs: string[]; cat: GalleryCategory }[] = [
  { id: "concierge", name: "Concierge", role: "Travel and stays", langs: ["EN", "RU"], cat: "support" },
  { id: "interpreter", name: "Interpreter", role: "Two-way translation", langs: ["KO", "EN", "RU"], cat: "translation" },
  { id: "front-desk", name: "Front desk", role: "Appointments", langs: ["EN", "RU"], cat: "booking" },
  { id: "visa-desk", name: "Visa desk", role: "Document questions", langs: ["KO", "EN"], cat: "translation" },
  { id: "clinic-intake", name: "Clinic intake", role: "Patient check-in", langs: ["RU", "EN"], cat: "translation" },
  { id: "support-line", name: "Support line", role: "Order questions", langs: ["EN", "RU"], cat: "support" },
  { id: "hotel-desk", name: "Hotel desk", role: "Late check-in", langs: ["EN", "KO"], cat: "booking" },
  { id: "studio-guide", name: "Studio guide", role: "Product walkthrough", langs: ["EN"], cat: "support" },
];

export const GALLERY_FILTERS: readonly { id: GalleryCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "translation", label: "Translation" },
  { id: "support", label: "Support" },
  { id: "booking", label: "Booking" },
];

export type Scene = { id: string; init: string; title: string; meta: string; srcLang: string; dstLang: string; src: string; dst: string; dur: number };

export const SCENES: readonly Scene[] = [
  { id: "visa", init: "V", title: "Visa office", meta: "Korean → English / Balanced", srcLang: "ko", dstLang: "en",
    src: "내일 오전 10시에 본사에서 만날 수 있을까요?", dst: "Could we meet at the main office tomorrow at 10 a.m.?", dur: 4 },
  { id: "clinic", init: "C", title: "Clinic intake", meta: "Russian → English / Accurate", srcLang: "ru", dstLang: "en",
    src: "У меня с утра болит голова.", dst: "I've had a headache since this morning.", dur: 3 },
  { id: "hotel", init: "H", title: "Hotel desk", meta: "English → Korean / Instant", srcLang: "en", dstLang: "ko",
    src: "I'll arrive after midnight. Can you hold the room?", dst: "자정 넘어서 도착하는데, 방을 잡아 두실 수 있을까요?", dur: 4 },
];

/**
 * Recorded clips of real translations, by scene id, e.g. { visa: "/audio/visa-ko-en.mp3" }.
 * Without a clip the player shows a labelled text preview instead. Never add a stand-in voice here.
 */
export const SAMPLES: Partial<Record<string, string>> = {};
