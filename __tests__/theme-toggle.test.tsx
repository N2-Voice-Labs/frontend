import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { ThemeToggle } from "@/components/features/landing/theme/theme-toggle";
import { THEME_KEY } from "@/components/features/landing/theme/theme";

const theme = () => document.documentElement.getAttribute("data-vl-theme");

function renderInRoot() {
  return render(<div className="marketing-root"><ThemeToggle /></div>);
}

beforeEach(() => { window.localStorage.clear(); document.documentElement.removeAttribute("data-vl-theme"); });
afterEach(() => { cleanup(); window.localStorage.clear(); document.documentElement.removeAttribute("data-vl-theme"); });

test("toggles the marketing theme and remembers the choice", () => {
  renderInRoot();
  const toggle = screen.getByRole("switch", { name: "Dark theme" });

  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  expect(theme()).toBe("dark");
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");

  fireEvent.click(toggle);
  expect(theme()).toBe("light");
  expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
});

test("restores a saved theme on mount", () => {
  window.localStorage.setItem(THEME_KEY, "dark");
  renderInRoot();
  expect(theme()).toBe("dark");
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});
