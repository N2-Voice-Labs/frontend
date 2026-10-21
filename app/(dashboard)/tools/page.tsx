"use client";

import { useState, type FormEvent } from "react";
import { Badge, Empty, Notice, PageHead, SoonNote } from "@/components/features/workspace/ui";
import { describeError } from "@/lib/platform-errors";
import { createTool, getTools, TOOL_NAME, updateTool, type Tool } from "@/lib/tools";
import { useResource } from "@/lib/use-resource";

const blankSchema = '{\n  "type": "object",\n  "properties": {}\n}';

function parseObject(text: string, label: string): { value?: Record<string, unknown>; error?: string } {
  if (!text.trim()) return { value: {} };
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { error: `${label} must be a JSON object.` };
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: `${label} is not valid JSON.` };
  }
}

export default function Tools() {
  const tools = useResource(getTools);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"http" | "builtin">("http");
  const [schema, setSchema] = useState(blankSchema);
  const [config, setConfig] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!TOOL_NAME.test(name)) return setError("Use lowercase letters, numbers and underscores, starting with a letter (e.g. check_availability).");
    if (!description.trim()) return setError("Describe what the tool does so the agent knows when to use it.");
    const input = parseObject(schema, "Input schema");
    if (input.error) return setError(input.error);
    if (input.value?.type !== "object") return setError('The input schema must have "type": "object".');
    const configuration = parseObject(config, "Configuration");
    if (configuration.error) return setError(configuration.error);
    setBusy(true);
    setError("");
    try {
      await createTool({ name, description: description.trim(), tool_type: type, input_schema: input.value, configuration: configuration.value });
      setName(""); setDescription(""); setConfig(""); setSchema(blankSchema); setOpen(false);
      await tools.reload();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(tool: Tool) {
    setError("");
    try {
      await updateTool(tool.id, { enabled: !tool.enabled });
      await tools.reload();
    } catch (cause) {
      setError(describeError(cause));
    }
  }

  const list = tools.data ?? [];
  return <main className="page-shell dash-main">
    <PageHead eyebrow="Workspace / Tools" title="Tools" intro="Things an agent can do during a call. Assign them to an agent from its page."
      action={<button className="button-link button-dark" data-bare type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Add a tool <span aria-hidden="true">+</span></button>} />
    {tools.error && <Notice tone="error">Could not load tools: {tools.error}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}

    {open && <form className="ws-form" style={{ marginBottom: 24 }} onSubmit={add} noValidate>
      <section className="form-section">
        <h2>New tool</h2>
        <div className="ws-two">
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="check_availability" maxLength={64} /></label>
          <label>Type<select value={type} onChange={(event) => setType(event.target.value as "http" | "builtin")}><option value="http">HTTP request</option><option value="builtin">Built-in</option></select></label>
        </div>
        <label>What it does<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Look up free appointment slots for a date." /></label>
        <label>Input schema (JSON)<textarea rows={5} value={schema} onChange={(event) => setSchema(event.target.value)} spellCheck={false} /></label>
        <label>Configuration (JSON, optional)<textarea rows={3} value={config} onChange={(event) => setConfig(event.target.value)} spellCheck={false} placeholder='{"url": "https://api.example.com/slots"}' />
          <span className="field-hint">Never put keys, passwords or tokens here; the Platform rejects them. Use a secret reference instead.</span></label>
      </section>
      <div className="ws-form-actions"><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save tool"}</button><button data-bare className="mini-action" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>}

    {tools.loading ? <p role="status">Loading tools…</p> : list.length === 0 && !tools.error ? (
      <Empty title="No tools yet">Add a tool, then assign it to an agent.</Empty>
    ) : (
      <ul className="ws-list">
        {list.map((tool) => <li className="ws-row" key={tool.id}>
          <div className="ws-row-main"><strong><code>{tool.name}</code></strong><small>{tool.description}</small></div>
          <div className="ws-row-side">
            <Badge>{tool.tool_type === "builtin" ? "Built-in" : "HTTP"}</Badge>
            <Badge tone={tool.enabled ? "good" : "neutral"}>{tool.enabled ? "Enabled" : "Disabled"}</Badge>
            <button data-bare className="mini-action" type="button" onClick={() => void toggle(tool)}>{tool.enabled ? "Disable" : "Enable"}</button>
          </div>
        </li>)}
      </ul>
    )}
    <SoonNote capability="toolExecution" />
  </main>;
}
