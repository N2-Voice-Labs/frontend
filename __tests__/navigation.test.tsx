import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DashboardHeader } from "@/components/features/agents/dashboard-header";
import { CallNav } from "@/components/features/call/call-nav";

const nav = vi.hoisted(() => ({ pathname: "/conversations" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

afterEach(cleanup);

test("Call comes first, Analytics reads Usage, agent tools sit under More, and Start a call is the primary action", () => {
  render(<DashboardHeader />);
  const primary = screen.getByRole("navigation", { name: "Workspace navigation" });
  const labels = within(primary).getAllByRole("link").map((link) => link.textContent);
  expect(labels.slice(0, 5)).toEqual(["Call", "Conversations", "Agents", "Voices", "Usage"]);
  expect(within(primary).getByRole("link", { name: "Usage" }).getAttribute("href")).toBe("/usage");
  expect(within(primary).getByText(/More/).closest("details")).not.toBeNull();
  expect(screen.getByRole("link", { name: "Start a call" }).getAttribute("href")).toBe("/call");
});

test("the menu sheet is a dialog with grouped links that only exist while it is open", () => {
  render(<DashboardHeader />);
  expect(screen.queryByRole("navigation", { name: "Menu navigation" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  const sheet = screen.getByRole("dialog", { name: "Menu" });
  for (const group of ["Communicate", "Build", "Account"]) expect(within(sheet).getByText(group)).toBeTruthy();
  expect(within(sheet).getByRole("link", { name: "Conversations" }).getAttribute("aria-current")).toBe("page");
  expect(within(sheet).getByRole("link", { name: "Start a call" }).getAttribute("href")).toBe("/call");
  fireEvent.click(within(sheet).getByRole("button", { name: "Close menu" }));
  expect(screen.queryByRole("navigation", { name: "Menu navigation" })).toBeNull();
});

test("on /call the header hides its own Start a call button", () => {
  nav.pathname = "/call";
  render(<DashboardHeader />);
  expect(screen.queryByRole("link", { name: "Start a call" })).toBeNull();
  nav.pathname = "/conversations";
});

test("the call page header links to every workspace section, with Call marked current", () => {
  nav.pathname = "/call";
  render(<CallNav />);
  const primary = screen.getByRole("navigation", { name: "Workspace navigation" });
  const labels = within(primary).getAllByRole("link").map((link) => link.textContent);
  expect(labels.slice(0, 5)).toEqual(["Call", "Conversations", "Agents", "Voices", "Usage"]);
  expect(within(primary).getByRole("link", { name: "Call" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Voice Labs home" }).getAttribute("href")).toBe("/");
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  expect(within(screen.getByRole("dialog", { name: "Menu" })).getByRole("link", { name: "Agents" }).getAttribute("href")).toBe("/agents");
  nav.pathname = "/conversations";
});
