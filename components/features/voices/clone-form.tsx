"use client";

import { useState, type FormEvent } from "react";
import { describeError } from "@/lib/platform-errors";
import { cloneVoice, type Voice } from "@/lib/voices";
import { LanguageChecks, ProviderSelect, VoiceResult } from "./voice-fields";

const SAMPLE = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+$/;
const statements = {
  self: "I am the speaker, and I agree to have my voice cloned and used by Voice Labs agents.",
  authorized: "I have the speaker’s permission to clone their voice and to use it in Voice Labs agents.",
};

/** Clone a voice from a recording the Platform can reach. Consent is required and recorded with the voice. */
export function CloneForm() {
  const [name, setName] = useState("");
  const [languages, setLanguages] = useState(["en", "ru"]);
  const [provider, setProvider] = useState("");
  const [sample, setSample] = useState("");
  const [method, setMethod] = useState<"self" | "authorized">("self");
  const [subject, setSubject] = useState("");
  const [statement, setStatement] = useState(statements.self);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Voice | null>(null);

  function chooseMethod(next: "self" | "authorized") {
    // Keep the wording in step with the choice unless the person has edited it.
    if (statement === statements[method]) setStatement(statements[next]);
    setMethod(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the voice a name.");
    if (languages.length === 0) return setError("Choose at least one language.");
    if (sample.length > 1024 || !SAMPLE.test(sample.trim())) return setError("The sample must be a link such as https://… or s3://… (no spaces).");
    if (!subject.trim()) return setError("Enter the name of the person whose voice this is.");
    if (!confirmed) return setError("Consent is required to clone a voice. Confirm it before saving.");
    setError("");
    setSaving(true);
    try {
      setSaved(await cloneVoice({
        name: name.trim(),
        languages,
        tts_provider_id: provider || null,
        sample_reference: sample.trim(),
        consent: { confirmed: true, subject_name: subject.trim(), statement: statement.trim() || statements[method], method },
      }));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSaving(false);
    }
  }

  if (saved) return <VoiceResult voice={saved} onAnother={() => { setSaved(null); setName(""); setSample(""); setConfirmed(false); }} />;

  return <form className="ws-form" onSubmit={submit} noValidate>
    <section className="form-section">
      <h2>The voice</h2>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Aigerim (support)" maxLength={200} /></label>
      <LanguageChecks value={languages} onChange={setLanguages} />
      <ProviderSelect value={provider} onChange={setProvider} />
    </section>
    <section className="form-section">
      <h2>Sample</h2>
      <label>Link to a clean recording
        <input type="url" inputMode="url" value={sample} onChange={(event) => setSample(event.target.value)} placeholder="https://files.example.com/sample.wav" />
        <span className="field-hint">A clear recording with one speaker and little background noise. The Platform stores the link, not the audio.</span>
      </label>
    </section>
    <section className="form-section">
      <h2>Consent</h2>
      <div className="ws-consent">
        <fieldset className="chip-fieldset"><legend>Whose voice is this?</legend>
          <label className="check-option"><input type="radio" name="method" checked={method === "self"} onChange={() => chooseMethod("self")} />My own voice</label>
          <label className="check-option"><input type="radio" name="method" checked={method === "authorized"} onChange={() => chooseMethod("authorized")} />Someone who has given permission</label>
        </fieldset>
        <label>Speaker’s full name<input value={subject} onChange={(event) => setSubject(event.target.value)} autoComplete="name" /></label>
        <label>Consent statement<textarea rows={3} value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
        <label className="check-option"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I confirm this consent is real and recorded with the voice. Cloning a voice without it is not allowed.</label>
      </div>
    </section>
    {error && <p className="notice" data-tone="error" role="alert">{error}</p>}
    <div className="ws-form-actions">
      <button type="submit" disabled={saving || !confirmed}>{saving ? "Saving…" : "Clone voice"}</button>
      {!confirmed && <span className="field-hint">Tick the consent box to continue.</span>}
    </div>
  </form>;
}
