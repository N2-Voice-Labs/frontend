import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DashboardHeader } from "@/components/features/agents/dashboard-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/agents/a1" }));

afterEach(cleanup);

test("the brand takes you home, there is no separate public-site link, and the current section is marked", () => {
  render(<DashboardHeader />);
  expect(screen.getByRole("link", { name: "Voice Labs home" }).getAttribute("href")).toBe("/");
  expect(screen.queryByText(/Public site/)).toBeNull();
  expect(screen.getByRole("link", { name: "Agents" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Conversations" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("switch", { name: "Dark theme" })).toBeTruthy();
});
