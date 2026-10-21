import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Conversations from "@/app/(dashboard)/conversations/page";
import { getConversations } from "@/lib/platform";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/platform", () => ({ getConversations: vi.fn() }));

afterEach(cleanup);

test("does not present a failed conversation request as an empty history", async () => {
  vi.mocked(getConversations).mockRejectedValue(new Error("Platform API is unavailable."));

  render(<Conversations />);

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/No conversations yet/)).toBeNull();
});
