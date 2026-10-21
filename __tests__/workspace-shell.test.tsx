import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";

let pathname = "/voices/clone";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(() => {
  document.documentElement.removeAttribute("data-vl-theme");
  window.localStorage.clear();
});

describe("workspace nav", () => {
  it("marks the current section, including sub-pages", () => {
    pathname = "/voices/clone";
    render(<WorkspaceNav />);
    const nav = screen.getByRole("navigation", { name: "Workspace" });
    expect(within(nav).getByRole("link", { name: "Voices" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Usage" }).getAttribute("href")).toBe("/usage");
  });

  it("groups Campaigns, Knowledge and Tools under More", () => {
    pathname = "/knowledge";
    render(<WorkspaceNav />);
    const more = screen.getByText("More").closest("details")!;
    expect(screen.getByText("More").getAttribute("aria-current")).toBe("page");
    expect(within(more).getAllByRole("link", { hidden: true }).map((a) => a.textContent)).toEqual(["Campaigns", "Knowledge", "Tools"]);
  });

  it("Search focuses the page's search field, or opens the command palette", () => {
    pathname = "/conversations";
    const opened = vi.fn();
    window.addEventListener("voice-labs:open-palette", opened);
    const { unmount } = render(<WorkspaceNav />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(opened).toHaveBeenCalledTimes(1);
    unmount();
    window.removeEventListener("voice-labs:open-palette", opened);

    render(<><WorkspaceNav /><input id="workspace-search" aria-label="field" /></>);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "field" }));
  });

  it("keeps its buttons out of the previous app's global button styles", () => {
    pathname = "/call";
    const { container } = render(<WorkspaceNav />);
    expect([...container.querySelectorAll("button")].every((b) => b.hasAttribute("data-bare"))).toBe(true);
  });
});

describe("theme toggle", () => {
  it("switches theme, saves the choice and labels what a click does", () => {
    document.documentElement.setAttribute("data-vl-theme", "light");
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Switch to dark theme" });
    fireEvent.click(button);
    expect(document.documentElement.getAttribute("data-vl-theme")).toBe("dark");
    expect(window.localStorage.getItem("vl-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
  });
});
