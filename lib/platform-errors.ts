/** Plain-language messages for the Platform's machine-readable error codes (the `detail` field). */
const messages: Record<string, string> = {
  voice_consent_required: "Consent is required to clone a voice. Confirm it before saving.",
  invalid_sample_reference: "The sample must be a link such as https://… or s3://… (no spaces).",
  invalid_tts_provider_id: "That voice provider is not available. Choose another or leave it on the default.",
  invalid_voice_profile_id: "That voice is not available. Choose another from the library.",
  voice_not_found: "That voice no longer exists.",
  invalid_voice_status_transition: "The voice cannot move to that status from where it is.",
  provider_voice_id_required: "A provider voice id is required before a voice can be ready.",
  phone_number_required: "A phone (SIP) deployment needs a phone number.",
  phone_number_only_for_sip: "Only phone (SIP) deployments take a phone number.",
  invalid_agent_id: "That agent is not available.",
  deployment_not_found: "That deployment no longer exists.",
  deployment_archived: "That deployment is archived and can no longer change.",
  deployment_not_active: "The campaign's deployment must be active.",
  deployment_agent_mismatch: "That deployment belongs to a different agent.",
  invalid_deployment_id: "That deployment is not available.",
  campaign_requires_sip_deployment: "Campaigns need a phone (SIP) deployment. Add one to the agent first.",
  campaign_has_no_targets: "Add at least one phone number before scheduling or starting.",
  campaign_not_editable: "This campaign can no longer be edited in its current status.",
  campaign_not_found: "That campaign no longer exists.",
  invalid_campaign_status_transition: "The campaign cannot move to that status from where it is.",
  invalid_timezone: "That timezone is not recognised. Use a name such as Europe/Berlin.",
  invalid_schedule: "The end must be after the start.",
  target_conflict: "Those numbers changed while saving. Try again.",
  tool_name_conflict: "A tool with that name already exists.",
  tool_not_found: "That tool no longer exists.",
  invalid_tool_id: "One of the selected tools is missing or disabled.",
  knowledge_document_not_found: "That document no longer exists.",
  invalid_knowledge_document_id: "One of the selected documents is missing or disabled.",
  invalid_outcome: "That is not a valid outcome.",
  conversation_not_found: "That conversation no longer exists.",
  agent_not_found: "That agent no longer exists.",
  agent_template_not_found: "That template is not available.",
  agent_not_enabled: "The agent must be enabled before it can take calls.",
  // Two-person calls (UX spec §4.1–4.2).
  invalid_interpreter_config: "This language pair can’t be interpreted with the current settings.",
  participants_require_cascaded_interpreter: "This language pair can’t be interpreted with the current settings.",
  invalid_participant_language: "This language pair can’t be interpreted with the current settings.",
  participant_languages_must_differ: "The two people need to speak different languages.",
  participants_not_enabled: "This call can’t take a second person.",
  selected_voice_unavailable: "That voice isn’t ready. Try again with the interpreter’s voice.",
  session_full: "Someone has already been invited to this call.",
  session_not_active: "This call has already ended.",
  voice_session_not_found: "This call no longer exists.",
  runtime_unavailable: "The interpreter isn’t responding right now. Try again in a moment.",
  runtime_auth_not_configured: "The interpreter isn’t set up on this server yet.",
  authentication_required: "This Voice Labs server needs a sign-in key, and calls can’t start without one.",
  forbidden: "This link or session no longer has access to the call.",
};

/** The Platform's machine-readable code (FastAPI `detail`), when the error carries one. */
export function errorCode(cause: unknown): string | null {
  if (!(cause instanceof Error)) return null;
  return /^[a-z][a-z0-9_]+$/.test(cause.message) ? cause.message : null;
}

export function describeError(cause: unknown, fallback = "Something went wrong. Try again."): string {
  if (!(cause instanceof Error)) return fallback;
  if (cause.message.startsWith("Failed to fetch") || cause.message === "fetch failed") return "Can’t reach the Platform. Check that it is running, then try again.";
  return messages[cause.message] ?? (cause.message || fallback);
}
