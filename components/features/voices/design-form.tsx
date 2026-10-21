"use client";

import { useState, type FormEvent } from "react";
import { describeError } from "@/lib/platform-errors";
import { designVoice, type Voice } from "@/lib/voices";
import { LanguageChecks, ProviderSelect, VoiceResult } from "./voice-fields";

const MAX_PROMPT = 2000;

function Slider({ label, low, high, value, onChange }: Readonly<{ label: string; low: string; high: string; value: number; onChange: (next: number) => void }>) {
  const id = `slider-${label.toLowerCase()}`;
  return <div className="ws-range">
    <div className="ws-range-top"><label htmlFor={id}>{label}</label><output htmlFor={id}>{Math.round(value * 100)}%</output></div>
    <input id={id} type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    <small><span>{low}</span><span>{high}</span></small>
  </div>;
}

/** Describe a voice in words and set its energy, warmth and speed. A provider creates it later. */
export function DesignForm() {
  const [name, setName] = useState("");
  const [languages, setLanguages] = useState(["en", "ru"]);
  const [provider, setProvider] = useState("");
  const [prompt, setPrompt] = useState("");
  const [energy, setEnergy] = useState(0.5);
  const [warmth, setWarmth] = useState(0.5);
  const [speed, setSpeed] = useState(0.5);
  const [style, setStyle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Voice | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the voice a name.");
    if (!prompt.trim()) return setError("Describe the voice you want.");
    if (languages.length === 0) return setError("Choose at least one language.");
    setError("");
    setSaving(true);
    try {
      setSaved(await designVoice({
        name: name.trim(),
        languages,
        tts_provider_id: provider || null,
        design_prompt: prompt.trim(),
        style: { energy, warmth, speed, ...(style.trim() ? { style: style.trim() } : {}) },
      }));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSaving(false);
    }
  }

  if (saved) return <VoiceResult voice={saved} onAnother={() => { setSaved(null); setName(""); setPrompt(""); }} />;

  return <form className="ws-form" onSubmit={submit} noValidate>
    <section className="form-section">
      <h2>The voice</h2>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Calm narrator" maxLength={200} /></label>
      <LanguageChecks value={languages} onChange={setLanguages} />
      <ProviderSelect value={provider} onChange={setProvider} />
    </section>
    <section className="form-section">
      <h2>Describe it</h2>
      <label>What should it sound like?
        <textarea rows={4} value={prompt} maxLength={MAX_PROMPT} onChange={(event) => setPrompt(event.target.value)} placeholder="A calm, low female voice. Unhurried, friendly, clear on numbers." />
        <span className="field-hint">{prompt.length} / {MAX_PROMPT}</span>
      </label>
    </section>
    <section className="form-section">
      <h2>Style</h2>
      <Slider label="Energy" low="Calm" high="Lively" value={energy} onChange={setEnergy} />
      <Slider label="Warmth" low="Neutral" high="Warm" value={warmth} onChange={setWarmth} />
      <Slider label="Speed" low="Slow" high="Fast" value={speed} onChange={setSpeed} />
      <label>Style label (optional)<input value={style} maxLength={50} onChange={(event) => setStyle(event.target.value)} placeholder="e.g. narrator" /></label>
    </section>
    {error && <p className="notice" data-tone="error" role="alert">{error}</p>}
    <div className="ws-form-actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : "Design voice"}</button></div>
  </form>;
}
