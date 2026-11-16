import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { INTAKES, NOTICES, groupNotices, nextDeadline, scheduleStatus } from "@/lib/portal-content";

const nav = vi.hoisted(() => ({ pathname: "/inha/dates" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/portal", () => ({ sendDemoChat: vi.fn(), startDemoSession: vi.fn(), createHandoff: vi.fn(), STAFF_LANGUAGE: "ko" }));
vi.mock("@/lib/platform", () => ({ getMessages: vi.fn(), getConversation: vi.fn(), endVoiceSession: vi.fn() }));

import { AssistantDock } from "@/components/features/portal/assistant-dock";
import { PortalHeader } from "@/components/features/portal/portal-chrome";
import { AskChips } from "@/components/features/portal/portal-page";
import { DocumentsChecklist, ProgramsExplorer } from "@/components/features/portal/portal-widgets";
import { Mascot } from "@/components/features/portal/mascot";

beforeEach(() => { localStorage.clear(); Element.prototype.scrollIntoView = vi.fn() as unknown as Element["scrollIntoView"]; });
afterEach(cleanup);

const spring = INTAKES[0];
const step = (id: string) => spring.steps.find((s) => s.id === id)!;
const today = new Date("2026-11-16T12:00:00+09:00");

test("schedule status on 16 Nov 2026: Spring applications closed, results upcoming", () => {
  expect(scheduleStatus(step("apply"), today)).toBe("closed");
  expect(scheduleStatus(step("docs"), today)).toBe("closed");
  expect(scheduleStatus(step("result"), today)).toBe("upcoming");
  expect(scheduleStatus(step("apply"), new Date("2026-10-15T00:00:00+09:00"))).toBe("open");
  expect(scheduleStatus(step("result"), new Date("2026-12-22T14:00:00+09:00"))).toBe("done");
});

test("next deadline is the Spring 2027 results, then Fall opens", () => {
  const next = nextDeadline(INTAKES, today)!;
  expect(next.step.id).toBe("result");
  expect(next.kind).toBe("on");
  const later = nextDeadline(INTAKES, new Date("2027-02-01T00:00:00+09:00"))!;
  expect(later.intake.id).toBe("fall-2027");
  expect(later.kind).toBe("opens");
  expect(nextDeadline(INTAKES, new Date("2028-01-01T00:00:00Z"))).toBeNull();
});

test("notices split into upcoming (soonest first), earlier (newest first) and general", () => {
  const g = groupNotices(NOTICES, today);
  expect(g.upcoming.map((n) => n.date)).toEqual(["2026-12-22T14:00:00+09:00", "2027-04-14T10:00:00+09:00"]);
  expect(g.past[0].date).toBe("2026-11-12T17:00:00+09:00");
  expect(g.general.length).toBeGreaterThan(0);
});

test("the tab bar marks the current section", () => {
  nav.pathname = "/inha/dates";
  render(<PortalHeader />);
  expect(screen.getByRole("link", { name: "Dates" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("link", { name: "Notices" }).getAttribute("href")).toBe("/inha/notices");
});

test("an Ask chip opens the assistant drawer with the question filled in", async () => {
  const { container } = render(<AssistantDock><AskChips questions={["How much is undergraduate tuition for engineering per semester?"]} /></AssistantDock>);
  const dock = container.querySelector(".portal-dock")!;
  expect(dock.getAttribute("data-open")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "How much is undergraduate tuition for engineering per semester?" }));
  expect(dock.getAttribute("data-open")).toBe("true");
  expect(screen.getByRole("tab", { name: "Chat" }).getAttribute("aria-selected")).toBe("true");
  await waitFor(() => expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).value).toBe("How much is undergraduate tuition for engineering per semester?"));
});

test("the document checklist remembers ticks and switches between freshman and transfer", () => {
  const { unmount } = render(<AssistantDock><DocumentsChecklist /></AssistantDock>);
  fireEvent.click(screen.getByRole("checkbox", { name: /Passport copies/ }));
  expect(screen.getByText(/1 of \d+ ready/)).toBeTruthy();
  expect(screen.getByText(/High school diploma/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
  expect(screen.getByText(/University diploma/)).toBeTruthy();
  expect(screen.queryByText(/High school diploma/)).toBeNull();
  unmount();
  render(<AssistantDock><DocumentsChecklist /></AssistantDock>);
  expect((screen.getByRole("checkbox", { name: /Passport copies/ }) as HTMLInputElement).checked).toBe(true);
});

test("the checklist still works when storage is blocked", () => {
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  render(<AssistantDock><DocumentsChecklist /></AssistantDock>);
  fireEvent.click(screen.getByRole("checkbox", { name: /Passport copies/ }));
  expect((screen.getByRole("checkbox", { name: /Passport copies/ }) as HTMLInputElement).checked).toBe(true);
  get.mockRestore(); set.mockRestore();
});

test("programs filter by search and by college", () => {
  render(<AssistantDock><ProgramsExplorer /></AssistantDock>);
  fireEvent.change(screen.getByLabelText("Search majors"), { target: { value: "computer" } });
  expect(screen.getByText("Computer Engineering")).toBeTruthy();
  expect(screen.queryByText("Nursing", { selector: "li" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Search majors"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Nursing" }));
  expect(screen.getByText("Nursing", { selector: "li" })).toBeTruthy();
  expect(screen.queryByText("Computer Engineering")).toBeNull();
});

test("the drawer closes with Escape and the launcher comes back", () => {
  const { container } = render(<AssistantDock><p>page</p></AssistantDock>);
  fireEvent.click(screen.getByRole("button", { name: /Ask the assistant/ }));
  expect(container.querySelector(".portal-dock")!.getAttribute("data-open")).toBe("true");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(container.querySelector(".portal-dock")!.getAttribute("data-open")).toBe("false");
  expect(screen.getByRole("button", { name: /Ask the assistant/ })).toBeTruthy();
});

test("a sticker with speech renders the line as text and keeps the picture decorative", () => {
  const { container } = render(<Mascot pose="clock" width={320} speech={<>Next up: results</>} />);
  expect(screen.getByText("Next up: results").tagName).toBe("FIGCAPTION");
  const img = container.querySelector("img")!;
  expect(img.getAttribute("aria-hidden")).toBe("true");
  expect(img.getAttribute("srcset")).toContain("clock-960.webp 960w");
});
