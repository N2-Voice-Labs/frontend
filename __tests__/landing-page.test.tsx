import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingPage } from "@/components/landing/landing-page";

describe("landing page", () => {
  it("renders every section in order", () => {
    const { container } = render(<LandingPage />);
    expect([...container.querySelectorAll("main > section")].map((s) => s.id)).toEqual(["top", "signal", "bridge", "languages", "workspace", "latency", "start"]);
  });

  it("uses one verb for the demo and links the workspace routes", () => {
    render(<LandingPage />);
    expect(screen.queryByText(/Try live voice|Talk to it here|Try it live/)).toBeNull();
    expect(screen.getAllByRole("link", { name: "Speak to it" }).every((a) => a.getAttribute("href") === "#top")).toBe(true);
    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("/call");
    expect(screen.getByRole("link", { name: "Open workspace" }).getAttribute("href")).toBe("/agents");
    expect(screen.getByRole("link", { name: "Product" }).getAttribute("href")).toBe("#workspace");
  });

  it("marks Korean and Russian text with lang", () => {
    const { container } = render(<LandingPage />);
    const text = (lang: string) => [...container.querySelectorAll(`[lang="${lang}"]`)].map((el) => el.textContent);
    expect(text("ko")).toContain("내일 오전 10시에 본사에서 만날 수 있을까요?");
    expect(text("ko")).toContain("체류 허가");
    expect(text("ru")).toContain("Мне нужно узнать");
    expect(text("ru")).toContain("вид на жительство");
  });

  it("keeps a single 'illustrative' footer note and placeholder latency values", () => {
    render(<LandingPage />);
    expect(screen.getAllByText("Conversation examples are illustrative.")).toHaveLength(1);
    expect(screen.getAllByText("[p50 ms]")).toHaveLength(5);
  });

  it("product showcase: tabs, window switch and path", () => {
    render(<LandingPage />);
    const [flow, gallery, translate] = screen.getAllByRole("tab");
    expect(flow.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("workflow")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next area" }));
    expect(gallery.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("agent-gallery")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous area" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous area" }));
    expect(translate.getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1); // the others are hidden, not unmounted
  });

  it("agent gallery filters and searches", () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Next area" }));
    const panel = document.querySelector(".ag-grid")!;
    expect(panel.querySelectorAll("article")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Booking" }));
    expect([...panel.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["Front desk", "Hotel desk"]);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search agents" }), { target: { value: "ko" } });
    expect([...panel.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["Interpreter", "Visa desk", "Hotel desk"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search agents" }), { target: { value: "zzz" } });
    expect(screen.getByText("No agents match that search.")).toBeTruthy();
  });

  it("live translate: scenarios are a radio group and play a labelled text preview without samples", () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Previous area" }));
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    fireEvent.keyDown(radios[0], { key: "ArrowRight" });
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios[1]);
    expect(screen.getByText("Ready: Clinic intake")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByText("Text preview: Clinic intake")).toBeTruthy();
  });

  it("has a mobile menu that closes on Escape and after choosing a link", () => {
    render(<LandingPage />);
    const button = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const sheet = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(sheet.hidden).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(sheet.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.click(within(sheet).getByRole("link", { name: "Languages" }));
    expect(sheet.hidden).toBe(true);
  });

  it("has a single ending: no pilot card in the footer", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector(".foot-card")).toBeNull();
    expect(screen.getAllByText("Hear it", { exact: false })).toHaveLength(1);
  });

  it("theme toggle carries both icons; CSS shows the sun in dark mode", () => {
    const { container } = render(<LandingPage />);
    const toggle = container.querySelector(".nav .icon-btn")!;
    expect(toggle.querySelector(".theme-moon")).toBeTruthy();
    expect(toggle.querySelector(".theme-sun")).toBeTruthy();
  });

  it("footer never renders dead # links", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector('footer a[href="#"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Agents" }).getAttribute("href")).toBe("/agents");
  });
});
