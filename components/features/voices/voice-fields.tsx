"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Badge, SoonNote } from "@/components/features/workspace/ui";
import { languageOptions } from "@/lib/languages";
import { getProviders } from "@/lib/platform";
import { useResource } from "@/lib/use-resource";
import { creationSteps, voiceStatusInfo } from "@/lib/voice-view";
import type { Voice } from "@/lib/voices";

export function LanguageChecks({ value, onChange }: Readonly<{ value: string[]; onChange: (next: string[]) => void }>) {
  return <fieldset className="chip-fieldset"><legend>Languages</legend>
    {languageOptions.map(({ id, label }) => <label className="check-option" key={id}>
      <input type="checkbox" checked={value.includes(id)} onChange={() => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])} />{label}
    </label>)}
  </fieldset>;
}

/** Optional: which text-to-speech provider should create the voice. Empty uses the Platform default. */
export function ProviderSelect({ value, onChange }: Readonly<{ value: string; onChange: (next: string) => void }>) {
  const load = useCallback(() => getProviders(), []);
  const providers = useResource(load);
  const options = (providers.data ?? []).filter((provider) => provider.kind === "tts" && provider.enabled);
  return <label>Voice provider (optional)
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Use the default</option>
      {options.map((provider) => <option key={provider.id} value={provider.id}>{provider.provider}</option>)}
    </select>
    {providers.error && <span className="field-hint">Providers unavailable right now; the default will be used.</span>}
  </label>;
}

/** Shown after a clone or design request is saved: what happens next, and a way back. */
export function VoiceResult({ voice, onAnother }: Readonly<{ voice: Voice; onAnother: () => void }>) {
  const info = voiceStatusInfo[voice.status];
  return <section className="panel ws-card" aria-live="polite" aria-label="Voice saved">
    <div className="ws-card-top"><h2>{voice.name} is saved</h2><Badge tone={info.tone}>{info.label}</Badge></div>
    <p>{info.hint} You can use it on an agent once it is ready.</p>
    <ol className="ws-steps">
      {creationSteps(voice).map((step) => <li key={step.label} data-done={step.done} data-current={step.current}>{step.label}</li>)}
    </ol>
    <SoonNote capability="providerCloning" />
    <div className="ws-card-foot">
      <Link className="mini-action primary" href="/voices">Back to the library</Link>
      <button data-bare className="mini-action" type="button" onClick={onAnother}>Add another</button>
    </div>
  </section>;
}
