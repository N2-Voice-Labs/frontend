"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState } from "./call-states";
import { Icon } from "./icons";
import { LevelMeter } from "./level-meter";
import { createLevelSampler, LevelStore, type LevelSampler } from "./level-store";

export type MicStatus = "idle" | "asking" | "ready" | "error";

/** Maps getUserMedia failures to what the person should do next (UX spec §4.1 [E]). */
export function describeMicError(cause: unknown): string {
  const name = cause instanceof DOMException ? cause.name : cause instanceof Error ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access was blocked. Allow it from the lock icon in the address bar, then try again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No microphone was found. Connect one and try again.";
  if (name === "NotReadableError") return "Your microphone is busy in another app. Close it there and try again.";
  return cause instanceof Error && cause.message ? cause.message : "The microphone couldn’t start. Try again.";
}

/**
 * Microphone check for setup and join: asks for permission, lists inputs, and shows a live level so
 * the person sees "We hear you" before the call. The probe stream is stopped before the call starts
 * (`release()`), keeping the existing "probe before session" invariant; LiveKit opens its own track.
 */
export function useMicCheck() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [heard, setHeard] = useState(false);
  const levels = useMemo(() => new LevelStore(), []);
  const stream = useRef<MediaStream | null>(null);
  const sampler = useRef<LevelSampler | null>(null);
  const context = useRef<AudioContext | null>(null);

  const release = useCallback(() => {
    sampler.current?.dispose();
    sampler.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    levels.reset();
  }, [levels]);

  const request = useCallback(async (requested?: string) => {
    release();
    // Create/resume the AudioContext now, synchronously inside the click; after the await below the
    // gesture is gone and iOS would leave it suspended.
    const Ctor = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!context.current && Ctor) {
      try { context.current = new Ctor(); } catch { context.current = null; }
    }
    if (context.current?.state === "suspended") void context.current.resume().catch(() => undefined);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Microphone access is unavailable here. Open Voice Labs over HTTPS (or localhost) in a current browser.");
      return false;
    }
    setStatus("asking");
    setError("");
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: requested ? { deviceId: { exact: requested } } : true });
      stream.current = next;
      const track = next.getAudioTracks()[0];
      const settingsId = track?.getSettings?.().deviceId ?? requested ?? "";
      setDeviceId(settingsId);
      try {
        const all = await navigator.mediaDevices.enumerateDevices?.();
        setDevices((all ?? []).filter((device) => device.kind === "audioinput" && device.deviceId));
      } catch {
        setDevices([]);
      }
      if (track) {
        sampler.current = createLevelSampler(track, context.current, (level) => {
          levels.set("self", level);
          if (level > 0.12) setHeard(true);
        }, { tailMs: Number.POSITIVE_INFINITY });
        sampler.current?.start();
      }
      setStatus("ready");
      return true;
    } catch (cause) {
      setStatus("error");
      setError(describeMicError(cause));
      return false;
    }
  }, [levels, release]);

  useEffect(() => () => {
    release();
    void context.current?.close().catch(() => undefined);
    context.current = null;
  }, [release]);

  return { status, error, devices, deviceId, heard, levels, request, release, selectDevice: (id: string) => void request(id) };
}

export type MicCheckState = ReturnType<typeof useMicCheck>;

export function MicCheck({ mic, idPrefix, onReady }: { mic: MicCheckState; idPrefix: string; onReady?: () => void }) {
  const { status, error, devices, deviceId, heard, levels } = mic;
  // The "Check microphone" button unmounts when pressed; move focus to the result on purpose
  // instead of letting it fall to <body> (accessibility audit S1).
  const resultRef = useRef<HTMLParagraphElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const askingRef = useRef<HTMLParagraphElement>(null);
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === status) return;
    const was = previous.current;
    previous.current = status;
    if (status === "asking" && document.activeElement === document.body) {
      askingRef.current?.focus();
    } else if (status === "ready" && (was === "asking" || was === "idle")) {
      resultRef.current?.focus();
      onReady?.();
    } else if (status === "error") {
      retryRef.current?.focus();
    }
  }, [status, onReady]);
  return (
    <fieldset className="mic-check" aria-describedby={error ? `${idPrefix}-mic-error` : undefined}>
      <legend>Microphone</legend>
      {status === "idle" && (
        <button id={`${idPrefix}-mic-check`} type="button" className="call-btn" data-variant="secondary" onClick={() => void mic.request()}>
          <Icon name="mic" /> Check microphone
        </button>
      )}
      {status === "asking" && <p className="call-hint" ref={askingRef} tabIndex={-1}>Allow microphone access in your browser…</p>}
      {status === "ready" && (
        <>
          {devices.length > 1 && (
            <div className="call-field">
              <label htmlFor={`${idPrefix}-mic`}>Input</label>
              <select id={`${idPrefix}-mic`} value={deviceId} onChange={(event) => mic.selectDevice(event.target.value)}>
                {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
              </select>
            </div>
          )}
          <p className="mic-level" ref={resultRef} tabIndex={-1}>
            <LevelMeter store={levels} source="self" tone="self" active />
            <span data-heard={heard ? "true" : "false"}>{heard ? <><Icon name="check" /> We hear you</> : "Say something to test it"}</span>
          </p>
        </>
      )}
      {status === "error" && (
        <ErrorState id={`${idPrefix}-mic-error`} title="Microphone not available" action={<button ref={retryRef} type="button" className="call-btn" data-variant="secondary" data-size="sm" onClick={() => void mic.request()}>Try again</button>}>
          {error}
        </ErrorState>
      )}
    </fieldset>
  );
}
