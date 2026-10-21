"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState, type ChangeEvent } from "react";
import { AgentOrb } from "@/components/features/agents/agent-orb";
import { agentHue, languageLabel } from "@/lib/agent-view";
import { languageName } from "@/lib/languages";
import { getProviders, saveAgent, type Agent, type ProviderConfig } from "@/lib/platform";
import { getVoices, type Voice } from "@/lib/voices";

type AgentFormProps = {
  initialAgent?: Agent;
  onSaved: (agent: Agent) => void;
};

const languageOptions = [
  { id: "en", label: "English" },
  { id: "ru", label: "Russian" },
];

const promptTemplates = [
  { label: "Concise support", text: "You are a concise, friendly support agent. Answer in one or two short sentences. If you are unsure, say so and offer to connect the caller with a person." },
  { label: "Friendly concierge", text: "You are a warm concierge. Greet the caller, ask how you can help, and keep answers brief and natural for speech. Offer one clear next step at the end." },
  { label: "Bilingual EN/RU", text: "You are a bilingual assistant for English and Russian speakers. Reply in the language the caller used most recently, and switch smoothly when they do. Keep sentences short and easy to say out loud." },
];

const runtimeProviders: Record<ProviderConfig["kind"], string[]> = {
  stt: ["deepgram"],
  llm: ["openai", "openai-compatible"],
  tts: ["cartesia"],
};

export function AgentForm({ initialAgent, onSaved }: AgentFormProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [providerError, setProviderError] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesError, setVoicesError] = useState(false);
  const [voiceProfileId, setVoiceProfileId] = useState(initialAgent?.voice_profile_id ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState({
    name: initialAgent?.name ?? "",
    description: initialAgent?.description ?? "",
    prompt: initialAgent?.system_prompt ?? "",
  });
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [languages, setLanguages] = useState(initialAgent?.enabled_languages ?? ["en", "ru"]);
  const [providerIds, setProviderIds] = useState({
    stt: initialAgent?.stt_provider_id ?? "",
    llm: initialAgent?.llm_provider_id ?? "",
    tts: initialAgent?.tts_provider_id ?? "",
  });

  useEffect(() => {
    let active = true;
    getProviders().then((items) => {
      if (active) setProviders(items);
    }).catch((cause: unknown) => {
      if (active) setProviderError(cause instanceof Error ? cause.message : "Could not load providers");
    });
    return () => { active = false; };
  }, []);

  // The voice picker lists voices that are ready; a failure only hides the picker's choices.
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => getVoices({ status: "ready" })).then((items) => {
      if (active) setVoices(items);
    }).catch(() => {
      if (active) setVoicesError(true);
    });
    return () => { active = false; };
  }, []);

  // Warn before a reload or tab close throws away edits (in-app links are not intercepted).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function trackDraft(event: ChangeEvent<HTMLFormElement>) {
    const field = event.target as unknown as { name: string; value: string };
    setDirty(true);
    if (field.name === "name") setDraft((current) => ({ ...current, name: field.value }));
    else if (field.name === "description") setDraft((current) => ({ ...current, description: field.value }));
    else if (field.name === "system_prompt") setDraft((current) => ({ ...current, prompt: field.value }));
  }

  function applyTemplate(text: string) {
    const area = promptRef.current;
    if (!area) return;
    const next = area.value.trim() ? `${area.value.trimEnd()}\n\n${text}` : text;
    area.value = next;
    setDraft((current) => ({ ...current, prompt: next }));
    setDirty(true);
    area.focus();
  }

  function toggleLanguage(language: string) {
    setLanguages((current) => current.includes(language)
      ? current.filter((item) => item !== language)
      : [...current, language]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (languages.length === 0) {
      setError("Choose at least one supported language.");
      return;
    }
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const data: Partial<Agent> & Pick<Agent, "name"> = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? ""),
      system_prompt: String(form.get("system_prompt") ?? ""),
      enabled_languages: languages,
      voice_id: String(form.get("voice_id") ?? "").trim() || null,
    };
    const selectedVoice = voiceProfileId || null;
    if (initialAgent ? selectedVoice !== (initialAgent.voice_profile_id ?? null) : selectedVoice) data.voice_profile_id = selectedVoice;
    for (const kind of ["stt", "llm", "tts"] as const) {
      const field = `${kind}_provider_id` as const;
      const selected = providerIds[kind] || null;
      if (!initialAgent || selected !== initialAgent[field]) data[field] = selected;
    }
    try {
      const saved = await saveAgent(data, initialAgent?.id);
      setDirty(false);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save agent");
    } finally {
      setSaving(false);
    }
  }

  function providerSelect(kind: ProviderConfig["kind"], label: string) {
    const value = providerIds[kind];
    const options = providers.filter((provider) => provider.kind === kind);
    const current = providers.find((provider) => provider.id === value);
    const currentIsSupported = current && runtimeProviders[kind].includes(current.provider);
    const chosen = providers.find((provider) => provider.id === value);
    return <div className="provider-card" data-custom={Boolean(value)}>
      <span className="provider-card-kind">{kind.toUpperCase()}<em>{value ? (chosen?.provider ?? "custom") : "runtime default"}</em></span>
      <label>{label}
      <select aria-label={label} name={kind} value={value} onChange={(event) => setProviderIds((ids) => ({ ...ids, [kind]: event.target.value }))}>
        <option value="">Use runtime default</option>
        {current && (!current.enabled || !currentIsSupported) && <option value={current.id} disabled>{current.provider} ({current.enabled ? "not supported by Runtime" : "disabled"})</option>}
        {options.filter((provider) => provider.enabled && runtimeProviders[kind].includes(provider.provider)).map((provider) => <option key={provider.id} value={provider.id}>{provider.provider}</option>)}
        {options.filter((provider) => provider.enabled && !runtimeProviders[kind].includes(provider.provider) && provider.id !== current?.id).map((provider) => <option key={provider.id} value={provider.id} disabled>{provider.provider} (not supported by Runtime)</option>)}
      </select>
    </label></div>;
  }

  const promptWords = draft.prompt.trim() ? draft.prompt.trim().split(/\s+/).length : 0;
  const previewHue = agentHue(initialAgent?.id ?? (draft.name.trim() || "new agent"));
  const providerName = (kind: ProviderConfig["kind"]) => {
    const id = providerIds[kind];
    return id ? providers.find((provider) => provider.id === id)?.provider ?? "Custom provider" : "Runtime default";
  };

  return <div className="form-layout">
    <form className="form-stack agent-form" onSubmit={submit} onChange={trackDraft}>
      <section className="form-section">
        <h2>Basics</h2>
        <label>Agent name<input aria-label="Agent name" name="name" required defaultValue={initialAgent?.name ?? ""} placeholder="e.g. Immigration guide" /></label>
        <label>Description<textarea name="description" rows={2} defaultValue={initialAgent?.description ?? ""} placeholder="One line on what this agent is for" /></label>
        <label>System prompt<textarea ref={promptRef} name="system_prompt" rows={6} defaultValue={initialAgent?.system_prompt ?? ""} placeholder="How should the agent behave and sound?" /></label>
        <div className="template-row" role="group" aria-label="Prompt starting points">
          <span>Start from</span>
          {promptTemplates.map((template) => <button className="chip" data-bare type="button" key={template.label} onClick={() => applyTemplate(template.text)}>{template.label}</button>)}
        </div>
      </section>
      <section className="form-section">
        <h2>Languages and voice</h2>
        <fieldset className="chip-fieldset"><legend>Supported languages</legend>
          {languageOptions.map(({ id, label }) => <label className="check-option" key={id}><input type="checkbox" checked={languages.includes(id)} onChange={() => toggleLanguage(id)} />{label}</label>)}
        </fieldset>
        <div className="ws-voice-pick">
          <label>Voice
            <select aria-label="Voice" name="voice_profile_id" value={voiceProfileId} onChange={(event) => { setVoiceProfileId(event.target.value); setDirty(true); }}>
              <option value="">Use the default voice</option>
              {voiceProfileId && !voices.some((voice) => voice.id === voiceProfileId) && <option value={voiceProfileId} disabled>Current voice (not ready)</option>}
              {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.languages.map(languageName).join(", ")}</option>)}
            </select>
          </label>
          <span className="field-hint">{voicesError ? "Voices are unavailable right now. Other settings can still be saved." : voices.length === 0 ? "No ready voices yet." : "Shared voices from your library."} <Link href="/voices">Manage voices</Link></span>
        </div>
        <label>Voice ID<input name="voice_id" defaultValue={initialAgent?.voice_id ?? ""} /></label>
      </section>
      <section className="form-section">
        <h2>Providers</h2>
        <fieldset><legend>Runtime providers</legend>
          <p className="field-hint">Leave a provider on its runtime default unless you want to override it for this agent.</p>
          <div className="provider-grid">
            {providerSelect("stt", "Speech-to-text provider")}
            {providerSelect("llm", "Language model provider")}
            {providerSelect("tts", "Text-to-speech provider")}
          </div>
          {providerError && <p className="field-hint" role="status">Provider choices unavailable: {providerError}. Other agent settings can still be saved.</p>}
          {!providerError && providers.length === 0 && <p className="field-hint">No providers configured yet; runtime defaults will be used.</p>}
        </fieldset>
      </section>
      {error && <p role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={saving}>{saving ? "Saving…" : initialAgent ? "Save changes" : "Create agent"}</button>
        {dirty && !saving && <span className="form-dirty">Unsaved changes</span>}
      </div>
    </form>

    <aside className="form-preview" aria-label="Live preview">
      <p className="form-preview-label">Live preview</p>
      <div className="form-preview-card">
        <AgentOrb hue={previewHue} size={72} />
        <strong className="form-preview-name">{draft.name.trim() || "Untitled agent"}</strong>
        <p className="form-preview-desc">{draft.description.trim() || "Your description appears here."}</p>
        <div className="agent-meta">
          {languages.length === 0 ? <span className="lang-chip is-empty">No language</span> : languages.map((language) => <span className="lang-chip" key={language}>{languageLabel(language)}</span>)}
        </div>
        <dl className="form-preview-specs">
          <div><dt>Speech</dt><dd data-custom={Boolean(providerIds.stt)}>{providerName("stt")}</dd></div>
          <div><dt>Language</dt><dd data-custom={Boolean(providerIds.llm)}>{providerName("llm")}</dd></div>
          <div><dt>Voice</dt><dd data-custom={Boolean(providerIds.tts)}>{providerName("tts")}</dd></div>
          <div><dt>Speaker</dt><dd data-custom={Boolean(voiceProfileId)}>{voices.find((voice) => voice.id === voiceProfileId)?.name ?? (voiceProfileId ? "Selected voice" : "Default voice")}</dd></div>
        </dl>
        <p className="form-preview-prompt">{promptWords === 0 ? "No system prompt yet" : `${promptWords} words · ${draft.prompt.length} characters of instructions`}</p>
      </div>
    </aside>
  </div>;
}
