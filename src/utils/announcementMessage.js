// ─────────────────────────────────────────────────────────────────────────────
// THE PAYOUT ANNOUNCEMENT MESSAGE — ONE DEFINITION, TWO SURFACES
//
// Extracted here in Admin Brand Retirement Phase 4. The templates and the
// resolver previously existed as TWO INDEPENDENT COPIES — one in
// referrer/AnnouncementPopup.jsx and one in admin/AdminSettingsNotifications.jsx
// (a third lived in AdminAnnouncementSettings.jsx until Phase 1 deleted it as an
// orphan).
//
// ⚠ THE DUPLICATION WAS NOT COSMETIC; IT SHIPPED A DEFECT. C/DL-3b Phase 6C
// added the [Company] token to all three copies of the STRING and wired the
// substitution into only ONE of the resolvers. The result reached production:
// the referrer saw "part of the Acme Roofing family" while the admin preview
// whose entire purpose is to show what the referrer sees showed
// "part of the [Company] family". Nothing failed, nothing logged, and the
// literal sweep passed — the token is not a tenant's name.
//
// CLAUDE.md's rule is the fix: duplicate logic in more than one file is
// extracted to a shared utility. With one definition there is no second copy to
// forget, and the next token added is added once.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two built-in announcement templates.
 *
 * Tokens are resolved by resolveMessage below. [First Name], [Amount] and
 * [Referred Name] are admin-facing tokens documented in the custom-message
 * editor; [Company] is NOT — it resolves from the contractor's own branding and
 * an admin cannot type it meaningfully.
 *
 * ⚠ [Amount] CARRIES ITS OWN CURRENCY SYMBOL — never write '$[Amount]'.
 * Both presets did, while the substitution below already supplied one, so every
 * announcement rendered "$$500" from c5c0617 (2026-03-29) until this was fixed —
 * about four and a half months, referrer-facing the whole time.
 *
 * The literal was removed from the TEMPLATES rather than the '$' from the
 * formatter, because the editor's helper text documents the token as [Amount]:
 * an admin following that instruction expects the symbol to come with it, and
 * stripping it from the formatter would have silently un-signed every custom
 * message already written against the documented contract. These two strings
 * were also the only place the broken form was on display, so admins copying
 * what they saw in the preview were being taught to reproduce it.
 */
export const PRESET_MESSAGES = {
  preset_1: "Great news — your [Amount] payout for referring [Referred Name] has been approved and is on its way! We appreciate you so much.",
  preset_2: "Your cashout request of [Amount] for referring [Referred Name] has been approved. Thank you for being part of the [Company] family.",
};

/**
 * Resolves the configured template into the message a referrer actually reads.
 *
 * @param {{mode: string, custom_message?: string}} settings - announcement
 *        settings as stored; `mode` is 'preset_1' | 'preset_2' | 'custom'.
 * @param {string} referrerFirstName - substituted into [First Name] and into the
 *        locked opener of a custom message.
 * @param {number|string} amount - the payout, formatted with thousands
 *        separators into [Amount].
 * @param {string} referredName - substituted into [Referred Name].
 * @param {string} [companyName] - the contractor's own name, from the branding
 *        context. Falls back to an EMPTY STRING rather than to a platform name:
 *        an identity-bearing value gets no default, and "part of the RoofMiles
 *        family" would name the wrong company entirely.
 * @returns {string} the fully substituted message.
 */
export function resolveMessage(settings, referrerFirstName, amount, referredName, companyName) {
  let template = '';
  if (settings.mode === 'custom' && settings.custom_message) {
    template = `Hey ${referrerFirstName}, ${settings.custom_message}`;
  } else {
    template = PRESET_MESSAGES[settings.mode] || PRESET_MESSAGES.preset_1;
  }
  return template
    .replace(/\[First Name\]/g, referrerFirstName)
    // THE CURRENCY SYMBOL IS OWNED HERE, and only here. See the warning on
    // PRESET_MESSAGES: a template that also writes one produces '$$500'.
    .replace(/\[Amount\]/g, `$${parseFloat(amount).toLocaleString()}`)
    .replace(/\[Referred Name\]/g, referredName)
    // ⚠ PASSED IN, NOT CLOSED OVER. This function is MODULE-LEVEL. C/DL-3b Phase
    // 6C referenced `branding` here directly — a binding that only exists inside
    // the component — so every render of a [Company] template threw a
    // ReferenceError. It SHIPPED: the sweep proved the literal was gone, and no
    // test rendered the component, so nothing observed that it no longer ran.
    // Any future value this resolver needs arrives as an argument.
    .replace(/\[Company\]/g, companyName || '');
}
