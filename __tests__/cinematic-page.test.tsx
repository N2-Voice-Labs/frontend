import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CinematicPage } from "@/components/cinematic/cinematic-page";
import { EVENTS, MEMORIES, UTTERANCES, WORDS, wordAt } from "@/components/scenes/conversation/conversation-data";
import { level, stateAt, ticks } from "@/components/scenes/reality/conversation-engine";
import { EVENTS as CALL, SCRIPT } from "@/components/scenes/reality/conversation-events";
import { CHAPTERS } from "@/lib/cinematic/chapters";
import { director, setPosition, subscribeDirector } from "@/lib/cinematic/director";
import { range, window01 } from "@/lib/cinematic/visual";

describe("cinematic landing page", () => {
  it("renders the eight chapters in story order", () => {
    const { container } = render(<CinematicPage />);
    expect([...container.querySelectorAll("main > section")].map((s) => s.id)).toEqual(CHAPTERS.map((c) => c.id));
    expect(CHAPTERS.map((c) => c.id)).toEqual(["silence", "distance", "bridge", "conversation", "engine", "world", "reality", "future"]);
  });

  it("tells the story in words, readable without motion", () => {
    render(<CinematicPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("We speak differently.");
    for (const text of [
      "But conversation should feel natural.",
      "Language should not become a wall.",
      "Conversation is more than translation.",
      "Serious engineering, out of sight.",
      "One runtime. Many conversations.",
      "One voice infrastructure.",
      "Many conversations.",
      "Same runtime underneath.",
      "Two languages. One conversation.",
      "Natural conversation.",
      "A voice should never need a translation to be heard.",
    ]) expect(screen.getAllByText((_, el) => el?.classList.contains("ct") === true && el.textContent === text).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Voice Labs" })).toHaveLength(3);
    // The tagline returns four times: the name (03), the runtime (05), the proof (07) and the end (08).
    const tags = screen.getAllByText("Real-time voice infrastructure for a multilingual world.");
    expect(tags).toHaveLength(4);
    expect(tags.map((el) => el.closest("section")?.id)).toEqual(["bridge", "engine", "reality", "future"]);
  });

  it("has a chapter indicator that links every chapter", () => {
    render(<CinematicPage />);
    const nav = screen.getByRole("navigation", { name: "Chapters" });
    const links = [...nav.querySelectorAll("ol a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(CHAPTERS.map((c) => `#${c.id}`));
    // jsdom has no layout, so which chapter is current is arbitrary here; exactly one is.
    expect(links.filter((a) => a.getAttribute("aria-current") === "step")).toHaveLength(1);
  });

  it("ends with the demo and the stack as calls to action", () => {
    render(<CinematicPage />);
    expect(screen.getByRole("link", { name: "Experience Voice Labs" }).getAttribute("href")).toBe("#reality");
    expect(screen.getByRole("link", { name: "Explore the stack" }).getAttribute("href")).toBe("#engine");
    expect(screen.getByRole("button", { name: "Speak to it" })).toBeTruthy();
  });

  it("marks non-English text with lang", () => {
    const { container } = render(<CinematicPage />);
    const ko = [...container.querySelectorAll('[lang="ko"]')].map((el) => el.textContent);
    expect(ko).toContain("내일 오전에 회의 가능할까요?");
    expect(ko).toContain("안녕하세요");
    expect(container.querySelector('[lang="ru"]')?.textContent).toBe("привет");
  });

  it("sound is opt-in", () => {
    render(<CinematicPage />);
    const sound = screen.getByRole("button", { name: /Sound off/ });
    expect(sound.getAttribute("aria-pressed")).toBe("false");
    expect(() => fireEvent.click(sound)).not.toThrow();
  });
});

describe("film logic", () => {
  it("director reports position and chapter", () => {
    setPosition(0);
    const seen: number[] = [];
    const off = subscribeDirector((_, chapter) => seen.push(chapter));
    setPosition(3.5);
    setPosition(7.99);
    setPosition(8);
    off();
    expect(seen).toEqual([0, 3, 7, 7]);
    expect(director.chapter).toBe(7);
    setPosition(0);
  });

  it("range and window ease between their edges", () => {
    expect(range(0, 0.2, 0.4)).toBe(0);
    expect(range(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    expect(range(1, 0.2, 0.4)).toBe(1);
    expect(window01(0.5, 0.2, 0.8)).toBe(1);
    expect(window01(0.95, 0.2, 0.8)).toBe(0);
  });

  it("the conversation is ordered, the barge-in cuts the voice and context refers back", () => {
    for (let i = 1; i < EVENTS.length; i++) expect(EVENTS[i].at).toBeGreaterThan(EVENTS[i - 1].at);
    for (const u of UTTERANCES) expect(u.end).toBeGreaterThan(u.start);
    const cut = UTTERANCES.filter((u) => u.interrupted);
    expect(cut).toHaveLength(1);
    const interrupt = EVENTS.find((e) => e.type === "interruption")!;
    expect(cut[0].end).toBe(interrupt.at);
    const context = EVENTS.find((e) => e.type === "context")!;
    const memory = MEMORIES.find((m) => m.id === context.ref)!;
    expect(memory).toBeTruthy();
    expect(memory.at).toBeLessThan(context.at);
    expect(UTTERANCES.find((u) => u.id === memory.from)!.end).toBeLessThanOrEqual(context.at);
    for (const w of WORDS) expect(wordAt(w)).toBeGreaterThan(0);
  });

  it("the reality call is one event stream: ordered, interrupted, code-switched, carrying context", () => {
    for (let i = 1; i < CALL.length; i++) expect(CALL[i].startTime).toBeGreaterThanOrEqual(CALL[i - 1].startTime);
    for (const u of SCRIPT) expect(u.end).toBeGreaterThan(u.start);
    // Every human line is followed by Voice Labs speaking to the other person, in their language (unless cut).
    for (const u of SCRIPT.filter((x) => x.source === "human" && !x.cut)) {
      const v = SCRIPT.find((x) => x.source === "voice" && x.side !== u.side && x.start >= u.end);
      expect(v?.lang).not.toBe(u.lang);
    }
    const cut = SCRIPT.find((u) => u.cut && u.source === "human")!;
    expect(CALL.find((e) => e.type === "interruption")?.ref).toBe(cut.id);
    // At the barge-in the cut voice stops and the other side takes over.
    expect(level(cut, cut.end + 0.01)).toBe(0);
    expect(stateAt(cut.end + 0.05).markers.map((m) => m.kind)).toContain("INTERRUPTION");
    const sw = SCRIPT.find((u) => u.parts)!;
    expect(stateAt(sw.end - 0.05).minji.langs).toBe("KO → EN → KO");
    const ctx = SCRIPT.find((u) => u.context)!;
    expect(SCRIPT.find((u) => u.id === ctx.context)!.end).toBeLessThan(ctx.start);
    expect(stateAt(ctx.start + 0.5).context?.from).toBe(ctx.context);
    // The middle fades as the conversation becomes natural; the timeline has marks, never numbers.
    expect(stateAt(30).presence).toBeLessThan(stateAt(2).presence);
    expect(new Set(ticks().map((k) => k.kind))).toEqual(new Set(["turn", "first", "end"]));
  });
});
