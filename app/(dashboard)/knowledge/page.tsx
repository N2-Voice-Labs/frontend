"use client";

import { useState, type FormEvent } from "react";
import { Badge, Empty, Notice, PageHead, SoonNote, formatDate } from "@/components/features/workspace/ui";
import { createDocument, getDocuments, MAX_CONTENT_CHARS, updateDocument, type KnowledgeDocument } from "@/lib/knowledge";
import { describeError } from "@/lib/platform-errors";
import { useResource } from "@/lib/use-resource";

export default function Knowledge() {
  const documents = useResource(getDocuments);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Give the document a title.");
    if (!content.trim()) return setError("Paste the document’s text.");
    if (content.length > MAX_CONTENT_CHARS) return setError(`That is too long. The limit is ${MAX_CONTENT_CHARS.toLocaleString()} characters.`);
    setBusy(true);
    setError("");
    try {
      await createDocument({ title: title.trim(), source: source.trim(), content });
      setTitle(""); setSource(""); setContent(""); setOpen(false);
      await documents.reload();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(doc: KnowledgeDocument) {
    setError("");
    try {
      await updateDocument(doc.id, { enabled: !doc.enabled });
      await documents.reload();
    } catch (cause) {
      setError(describeError(cause));
    }
  }

  const list = documents.data ?? [];
  return <main className="page-shell dash-main">
    <PageHead eyebrow="Workspace / Knowledge" title="Knowledge" intro="Documents your agents should know about. Assign them to an agent from its page."
      action={<button className="button-link button-dark" data-bare type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Add a document <span aria-hidden="true">+</span></button>} />
    {documents.error && <Notice tone="error">Could not load documents: {documents.error}</Notice>}
    {error && <Notice tone="error">{error}</Notice>}

    {open && <form className="ws-form" style={{ marginBottom: 24 }} onSubmit={add} noValidate>
      <section className="form-section">
        <h2>New document</h2>
        <div className="ws-two">
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} placeholder="Opening hours and locations" /></label>
          <label>Source (optional)<input value={source} onChange={(event) => setSource(event.target.value)} maxLength={1024} placeholder="https://example.com/hours" /></label>
        </div>
        <label>Text<textarea rows={8} value={content} onChange={(event) => setContent(event.target.value)} />
          <span className="field-hint">{content.length.toLocaleString()} / {MAX_CONTENT_CHARS.toLocaleString()} characters</span></label>
      </section>
      <div className="ws-form-actions"><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save document"}</button><button data-bare className="mini-action" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>}

    {documents.loading ? <p role="status">Loading documents…</p> : list.length === 0 && !documents.error ? (
      <Empty title="No documents yet">Add a document, then assign it to an agent.</Empty>
    ) : (
      <ul className="ws-list">
        {list.map((doc) => <li className="ws-row" key={doc.id}>
          <div className="ws-row-main"><strong>{doc.title}</strong><small>{doc.content_length.toLocaleString()} characters · version {doc.version} · updated {formatDate(doc.updated_at)}{doc.source ? ` · ${doc.source}` : ""}</small></div>
          <div className="ws-row-side">
            <Badge tone={doc.enabled ? "good" : "neutral"}>{doc.enabled ? "Enabled" : "Disabled"}</Badge>
            <button data-bare className="mini-action" type="button" onClick={() => void toggle(doc)}>{doc.enabled ? "Disable" : "Enable"}</button>
          </div>
        </li>)}
      </ul>
    )}
    <SoonNote capability="knowledgeSearch" />
  </main>;
}
