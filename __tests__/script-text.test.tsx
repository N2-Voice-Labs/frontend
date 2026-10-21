import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { isMixedScript, ScriptText, splitByScript } from "@/components/features/conversations/script-text";

test("single-script text stays one plain segment", () => {
  expect(splitByScript("Can you help me find a quieter time?")).toEqual([{ text: "Can you help me find a quieter time?", script: null }]);
  expect(splitByScript("Мне нужна помощь")).toHaveLength(1);
  expect(isMixedScript("Hello 123!")).toBe(false);
});

test("a switch between Cyrillic and Latin produces tinted runs that rebuild the original text", () => {
  const text = "Мне нужно узнать what documents I need for my visa.";
  const segments = splitByScript(text);
  expect(segments.map((segment) => segment.script)).toEqual(["cyrillic", "latin"]);
  expect(segments.map((segment) => segment.text).join("")).toBe(text);
  expect(isMixedScript(text)).toBe(true);
});

test("ScriptText renders plain text for one script and tinted spans for mixed text", () => {
  const plain = render(<p><ScriptText text="private transcript from A" /></p>);
  expect(plain.container.querySelectorAll(".seg")).toHaveLength(0);
  expect(plain.getByText("private transcript from A")).toBeTruthy();

  const mixed = render(<p><ScriptText text="Мне нужна appointment" /></p>);
  expect(mixed.container.querySelectorAll(".seg-cyrillic")).toHaveLength(1);
  expect(mixed.container.querySelectorAll(".seg-latin")).toHaveLength(1);
});
