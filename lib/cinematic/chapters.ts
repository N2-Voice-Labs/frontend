/**
 * The eight chapters of the landing film, in order. `length` is the scroll distance of the chapter in
 * viewport heights (scaled down on small screens in cinematic.css). The canvas visuals are registered
 * in the same order in components/cinematic/stage.tsx.
 */
export const CHAPTERS = [
  { id: "silence", label: "Silence", length: 3 },
  { id: "distance", label: "Distance", length: 3 },
  { id: "bridge", label: "Bridge", length: 3.5 },
  { id: "conversation", label: "Conversation", length: 5 },
  { id: "engine", label: "Engine", length: 4 },
  { id: "world", label: "World", length: 3.5 },
  { id: "reality", label: "Reality", length: 2.5 },
  { id: "future", label: "Future", length: 4 },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

export const chapterIndex = (id: ChapterId) => CHAPTERS.findIndex((c) => c.id === id);

/** "01".."08" */
export const chapterNumber = (index: number) => String(index + 1).padStart(2, "0");
