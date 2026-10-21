"use client";

import { useState } from "react";
import { Notice } from "@/components/features/workspace/ui";
import { languageName } from "@/lib/languages";
import { describeError } from "@/lib/platform-errors";
import { createAgentFromTemplate, getAgentTemplates, type AgentTemplate } from "@/lib/templates";
import { useResource } from "@/lib/use-resource";

/** Six ready-made personas. Choosing one creates the agent in a single call; everything stays editable. */
export function TemplatePicker({ onCreated }: Readonly<{ onCreated: (agentId: string) => void }>) {
  const templates = useResource(getAgentTemplates);
  const [chosen, setChosen] = useState<AgentTemplate | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (templates.loading) return null;
  if (templates.error || !templates.data?.length) return <p className="field-hint">Templates are unavailable right now. You can still create an agent below.</p>;

  function choose(template: AgentTemplate) {
    setChosen(template);
    setName(template.name);
    setError("");
  }

  async function create() {
    if (!chosen) return;
    setBusy(true);
    setError("");
    try {
      const created = await createAgentFromTemplate(chosen.key, { name: name.trim() || undefined });
      onCreated(created.id);
    } catch (cause) {
      setError(describeError(cause));
      setBusy(false);
    }
  }

  return <section className="ws-section" aria-labelledby="templates-title">
    <div className="ws-section-head"><h2 id="templates-title">Start from a template</h2></div>
    <ul className="tpl-grid">
      {templates.data.map((template) => <li key={template.key}>
        <button className="tpl" data-bare type="button" aria-pressed={chosen?.key === template.key} onClick={() => choose(template)}>
          <strong>{template.name}</strong>
          <span>{template.description}</span>
          <small>{template.enabled_languages.map(languageName).join(" · ")}</small>
        </button>
      </li>)}
    </ul>
    {chosen && <div className="panel ws-card" aria-live="polite">
      <h3>{chosen.name}</h3>
      <p>{chosen.description}</p>
      <label>Name for the new agent<input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} /></label>
      {chosen.suggested_tools.length > 0 && <p className="field-hint">Suggested tools: {chosen.suggested_tools.join(", ")}. Add them from the agent’s page once it exists.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="ws-actions">
        <button type="button" disabled={busy || !name.trim()} onClick={() => void create()}>{busy ? "Creating…" : "Create from template"}</button>
        <button data-bare className="mini-action" type="button" onClick={() => setChosen(null)}>Cancel</button>
      </div>
    </div>}
    <p className="field-hint">Or set everything up yourself below.</p>
  </section>;
}
