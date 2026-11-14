import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContactPage from "@/app/(marketing)/(site)/contact/page";
import DemoPage from "@/app/(marketing)/(site)/demo/page";
import DevelopersPage from "@/app/(marketing)/(site)/developers/page";
import ProductsPage from "@/app/(marketing)/(site)/products/page";
import SolutionsPage from "@/app/(marketing)/(site)/solutions/page";

describe("UNAI content pages", () => {
  it("every page has the main navigation and marks itself as current", () => {
    for (const [Page, href] of [[ProductsPage, "/products"], [SolutionsPage, "/solutions"], [DevelopersPage, "/developers"], [DemoPage, "/demo"], [ContactPage, "/contact"]] as const) {
      const { unmount } = render(<Page />);
      const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
      expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/products", "/solutions", "/developers", "/demo", "/contact"]);
      expect(within(nav).getByRole("link", { current: "page" }).getAttribute("href")).toBe(href);
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
      unmount();
    }
  });

  it("presents voice agents as the primary product and APIs as planned", () => {
    render(<ProductsPage />);
    const voice = document.getElementById("voice-agents")!;
    expect(within(voice).getByText("Primary product")).toBeTruthy();
    expect(within(voice).getByText("In the MVP")).toBeTruthy();
    expect(within(document.getElementById("apis")!).getByText("Planned")).toBeTruthy();
    expect(screen.getByText(/regular phone network \(SIP\)/)).toBeTruthy();
  });

  it("never claims other industries are built", () => {
    render(<SolutionsPage />);
    expect(screen.getByText(/None of them is built yet/)).toBeTruthy();
    expect(screen.getAllByText("Planned")).toHaveLength(4);
  });

  it("separates available endpoints from planned commercial access", () => {
    render(<DevelopersPage />);
    expect(screen.getByText("/voice/sessions")).toBeTruthy();
    expect(screen.getByText("/handoffs").closest("tr")!.textContent).toContain("In progress");
    expect(screen.getByText("Self-serve API keys").closest("article")!.textContent).toContain("Planned");
  });

  it("the demo page says it is not an official university service", () => {
    render(<DemoPage />);
    expect(screen.getByText(/not an official Inha University service/)).toBeTruthy();
  });
});
