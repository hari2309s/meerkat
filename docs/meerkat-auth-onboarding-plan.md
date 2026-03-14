# Meerkat — Auth & Onboarding Improvement Plan

> **Goal:** Make auth and onboarding feel effortless for normal users — solo, family, and friends —
> without compromising the zero-knowledge, post-apocalyptic privacy model.
> The mnemonic stays. The architecture stays. The _experience_ of it changes.

---

## The Core Tension

The current flow is technically correct and philosophically honest.
The problem is that it front-loads anxiety. A new user hits:

> _"I cannot recover my account without it."_

...before they've experienced a single moment of value. That's the wrong order.
The fix is not to weaken the message — it's to **sequence the trust-building better**.

---

## 1. Signup Flow

### Current Problem

The mnemonic is shown immediately after the user decides to sign up.
They haven't seen the product. They haven't felt why it matters.
The responsibility feels like a burden before it feels like a gift.

### Proposed Changes

#### Step 1 — Intent Screen (New)

Before generating the mnemonic, show a single warm screen in the form area before rendering the keys:

```
Meerkat works differently.

No email. No password. No way for us to see your data.
Instead, you get a Key — 12 words that are yours alone.

We'll help you save it safely.

[ I'm ready → ]
```

This reframes what's about to happen. The user opts into the model
consciously rather than stumbling into it.

#### Step 2 — Key Generation Screen (Revised)

Currently: blurred mnemonic + "Reveal and Copy" + checkbox.

Revise to:

- Show the 12 words in a larger, more readable format — word cards,
  not a dense text block
- Replace "Reveal and Copy" with a **guided save flow**:

```
How would you like to save your Key?

[ 📋 Copy to clipboard ]
[ 📄 Download as text file ]
[ 🔐 View to write down ]
```

Let the user pick the method that suits them. After they complete one:

```
✓ Key saved. You're protected.
```

- Then show the acknowledgement checkbox — but rephrase it:

```
☐  I've saved my Key. I know Meerkat can't recover it for me,
    and that means nobody else can access my den either.
```

The second clause turns the limitation into the reason it's powerful.
The user is acknowledging a _feature_, not accepting a _risk_.

#### Step 3 — First Den (New)

After signup, don't drop the user on a blank dashboard.
Take them directly into their personal "For You" den with a single
pre-created burrow called **"My first note"** containing:

```
Welcome to your den. 🦦

This is your private space. Everything here is encrypted on your
device before it goes anywhere. Not even Meerkat can read it.

Your Key is saved. You're good. Start writing.
```

They land somewhere warm. They write something immediately.
The product earns the trust the signup flow asked for.

---

## 2. Login Flow

### Current Problem

Users returning after time away must re-enter their 12-word mnemonic.
For a non-technical user this is friction every session until the
PWA install + localStorage vault kicks in.

### Proposed Changes

#### Persist Gracefully

The `vault_mnemonic` in localStorage is already the right call for UX.
Make it more explicit during onboarding:

```
On this device, you'll stay logged in automatically.
On a new device, you'll need your Key.
```

This sets the expectation correctly. Users won't be surprised when
they switch devices and need the mnemonic again.

#### Login Screen UX

Current: plain mnemonic input.

Revise to:

- Larger word input with **individual word fields** (12 boxes) rather
  than one textarea — reduces typo errors and makes it feel guided
- Real-time BIP39 validation per word with subtle green/red feedback
  as they type each word — catches mistakes early
- A gentle hint: _"Words are from a standard list. Check spelling if
  a word shows red."_

#### "Lost your Key?" Path

Currently there is none — which is architecturally correct.
But silence feels like abandonment to a confused user.

Add a compassionate dead-end:

```
Lost your Key?

Unfortunately Meerkat can't recover your account — that's what
makes it truly private. No backdoor means no breach.

You can create a new account and start fresh.

[ Create new account ]
```

This transforms "we can't help you" into "here's why that protects you"
and gives a forward path rather than a wall.

---

## 3. Family & Friends Invite Flow

### Current Problem

The invite modal is beautifully designed but the journey _after_ copying
the link is undocumented. A non-technical family member receives a URL,
taps it, and needs to know what to do next.

### Proposed Changes

#### Invite Landing Page (New)

When a recipient opens an invite link, show a warm welcome screen
before any auth:

```
[Meerkat logo + meerkat illustration]

[Name] has invited you to their den.

Meerkat is a private space for your people.
No ads. No data harvesting. Yours forever.

[ Accept invite → ]
```

Then walk them through a simplified signup — same mnemonic model,
same guided save flow, but the copy acknowledges they were invited:

```
You're joining [Name]'s den.
First, let's set up your Key.
```

#### Post-Accept Experience

After accepting, land them directly in the shared den — not the
dashboard. They should immediately see the collaborative space they
were invited to. First experience = being _with_ someone, not
navigating alone.

---

## 4. PWA Install Prompt

### Current Problem

The PWA capability exists but there's no guided prompt to install it.
Most users don't know to look for "Add to Home Screen."

### Proposed Change

After the user's **second login** (not first — let them settle in),
show a gentle nudge:

```
Install Meerkat for the best experience.

Works offline. Feels like a native app.
Your Key stays securely on this device.

[ Install ]   [ Maybe later ]
```

Trigger the native PWA install prompt on tap.
This converts browser users to installed users — better retention,
better offline experience, less dependency on the browser staying open.

---

## 5. Onboarding Checklist (Optional Enhancement)

For users who want guidance, a lightweight first-run checklist
inside the "For You" den:

```
Getting started                          2 / 5 done

✓  Key saved safely
✓  First note created
☐  Try a voice note
☐  Create a second burrow
☐  Invite someone to a den
```

No pressure. Dismissible. But gives curious users a path to discover
features organically rather than all at once.

---

## 6. Copy Changes Summary

| Current                                  | Revised                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "I cannot recover my account without it" | "I've saved my Key. I know Meerkat can't recover it — and that means nobody else can access my den either." |
| "Reveal and Copy"                        | Guided save options: copy / download / write down                                                           |
| "Encrypted, local, yours forever"        | Keep — it's perfect                                                                                         |
| "No burrows yet" empty state             | Keep — it's perfect                                                                                         |
| Silent "Lost Key" dead end               | Compassionate explanation + "create new account" path                                                       |

---

## 7. What Does NOT Change

- The mnemonic model — stays exactly as is
- BIP39 word generation — untouched
- Zero-knowledge architecture — untouched
- No OAuth, no email, no password reset — never
- "Nobody sees your den" — stays as the north star

The privacy model is the product. These changes are about
making the _door_ easier to walk through — not changing what's
inside.

---

## Priority Order

1. **Invite landing page** — highest impact, unblocks family/friends use case
2. **Guided Key save flow** — reduces signup abandonment immediately
3. **Intent screen before mnemonic** — reframes anxiety as empowerment
4. **Login word-by-word input** — reduces returning user friction
5. **PWA install prompt** — improves retention after first session
6. **Lost Key compassionate path** — reduces support confusion
7. **First-run checklist** — nice to have, not urgent

---

_The goal is simple: the first time someone uses Meerkat,
they should feel looked after — not tested._
