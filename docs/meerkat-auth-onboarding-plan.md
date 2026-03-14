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

Before generating the mnemonic, show a single warm screen:

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

## 3. Invite Flow — All Four Types

The invite modal is beautifully designed. The four access types —
House-sit, Come Over, Peek, Letterbox — are intuitive and warm.
But each type creates a **different recipient experience** that needs
its own guidance, both for the _sender_ and the _recipient_.

Right now the journey after copying the link is undocumented.
A non-technical family member receives a URL, taps it, and is on their own.

---

### 3.1 — Invite Landing Page (All Types)

Every invite link should land on a warm, contextual welcome screen
_before_ any auth is required. The recipient needs to understand
what they're walking into before being asked to do anything.

```
[Meerkat logo + meerkat illustration]

[Name] has invited you to their den.

[Access type badge — e.g. 🏠 House-sit]
[One line description of what this means]

Meerkat is a private space for your people.
No ads. No data collection. Yours forever.

[ Accept invite → ]
```

The access type badge is critical — it tells the recipient
_what kind of welcome this is_ before they commit to signing up.

---

### 3.2 — Guidance Per Invite Type

Each type needs different copy on both sides — what the **sender sees**
when choosing it, and what the **recipient sees** when accepting it.

---

#### 🏠 House-sit

_Full access, offline capable. Best for trusted members._

**Sender guidance** (shown in modal, below the option):

```
Best for: family members, long-term collaborators, people you fully trust.
They can read, write, and work offline. Treat this like giving someone
a key to your home.
Key duration: set to No expiry for permanent members, or 1 year to review annually.
```

**Recipient landing screen:**

```
[Name] has given you full access to their den.

🏠 House-sit access means you can read, write, and work
even when you're offline. You're a trusted member here.

This access [expires in 30 days / never expires].

[ Set up your Key and enter → ]
```

**Post-accept:** Land directly in the shared den, Burrows tab open,
ready to read and write immediately.

---

#### 👋 Come Over

_Real-time read & write. Live sessions only._

**Sender guidance:**

```
Best for: working together right now — a shared writing session,
a family catch-up, a quick collaboration.
Access ends when the session ends. Nothing persists after they leave.
Key duration: 7 days is usually enough — they'll use it once or twice.
```

**Recipient landing screen:**

```
[Name] has invited you to collaborate live.

👋 Come Over access means you can read and write together
in real-time, right now. When the session ends, so does access.

This is a live invitation — [Name] is waiting.

[ Join the session → ]
```

**Post-accept:** Land directly in the shared den, Chat tab open,
presence indicator showing the host is live. Immediate sense of
arriving somewhere someone is already waiting.

**Important UX note:** If the recipient taps the link when the host
is offline, show a gentle holding screen:

```
[Name] isn't hosting right now.

Come Over access only works when [Name] is active in the den.
Try again when they're around, or ask them to send a new invite.
```

---

#### 👀 Peek

_Read-only access to shared notes. No changes._

**Sender guidance:**

```
Best for: sharing notes with someone who just needs to read —
a family member checking the holiday plan, a friend reviewing
something you wrote. They can't change anything.
Key duration: set an expiry that matches how long you want them to have access.
```

**Recipient landing screen:**

```
[Name] has shared their notes with you.

👀 Peek access means you can read everything in this den,
but you won't be able to make changes. It's like being handed
a notebook to read.

This access expires [date / never].

[ View the den → ]
```

**Post-accept:** Land directly in Burrows, read-only mode clearly
indicated — subtle visual treatment (slightly muted UI, no edit
cursors, a small "read only" badge in the header). No confusion
about why they can't type.

**Important UX note:** Peek recipients may not need a full Meerkat
account if they're just reading. Consider a lightweight
**guest view** — no mnemonic required, session-scoped access,
with a gentle prompt to create an account if they want to come back.
This dramatically lowers the barrier for casual sharing.

---

#### 📬 Letterbox

_Drop messages when you're not home. Works offline._

This is the most nuanced invite type and the one most likely to
confuse recipients without guidance. The concept of asynchronous
encrypted drops is unfamiliar.

**Sender guidance:**

```
Best for: someone who wants to leave you messages when you're not around —
like dropping a note through your door. You'll collect them next time
you're in the den. Works even when neither of you is online at the same time.
Key duration: longer durations make sense here — 90 days or 1 year.
```

**Recipient landing screen:**

```
[Name] has set up a Letterbox for you.

📬 You can leave [Name] encrypted messages even when they're
not online. They'll collect them next time they open their den.

Think of it as a private drop box — your messages go straight
to [Name] and nowhere else.

This access expires [date].

[ Set up your Key and start dropping → ]
```

**Post-accept:** Land in the Chat tab with a simple composer and
clear indication of the async nature:

```
Leave a message for [Name].
They'll see it next time they're in their den. 📬
```

No presence indicator. No "waiting for visitors." Just a calm,
quiet composer that makes asynchronous communication feel intentional
rather than broken.

---

### 3.3 — Sender Experience Improvements

The invite modal currently shows the four types clearly but doesn't
give the sender enough confidence that they're choosing the right one.

Add a **recommendation hint** based on context:

```
Creating a den called "Family"?
→ House-sit recommended for members who'll be here regularly.

Wanting to share your holiday notes?
→ Peek is perfect — they can read, you stay in control.

Working on something together right now?
→ Come Over for live collaboration.

Want someone to reach you privately?
→ Letterbox lets them message you anytime.
```

These don't need to be intrusive — a subtle contextual suggestion
below the access type selector is enough.

Also: after sending an invite, show a **what happens next** summary:

```
Invite sent. Here's what [friend@example.com] will see:

→ An email with your invite link
→ A welcome screen explaining House-sit access
→ A guided Key setup (takes 2 minutes)
→ They'll land directly in your den

You'll see them appear here when they join. 🦦
```

This closes the loop for the sender — they know what their friend
will experience and feel confident the invitation was meaningful.

---

### 3.4 — Existing User Accepting an Invite

If someone already has a Meerkat account and taps an invite link,
the flow should be seamless — no new Key setup, just confirmation:

```
[Name] has invited you to their den.

🏠 House-sit access — full read & write.

You're already signed in as [display name].

[ Accept and enter den → ]   [ Sign in as someone else ]
```

One tap. No friction. This is the most common repeat-use case
(established users getting invited to new dens) and it should
feel instant.

---

### 3.5 — Expired or Invalid Invite Links

Currently an expired or invalid link likely shows a generic error.
It needs a compassionate response:

```
This invite has expired.

Invite links have a limited life to keep your den secure.

Ask [Name] to send you a fresh invite — it only takes them
a few seconds.
```

If the den name or host name is recoverable from the link metadata,
show it. Knowing _whose_ invite expired is more helpful than a
generic "link invalid" message.

---

### 3.6 — Key Duration Guidance

The key duration selector (7 days / 30 days / 90 days / 1 year /
No expiry) is powerful but senders often won't know what to choose.

Add subtle guidance beneath the selector based on the access type:

| Access Type | Suggested Duration  | Reason shown to sender                        |
| ----------- | ------------------- | --------------------------------------------- |
| House-sit   | No expiry or 1 year | Permanent members shouldn't need to re-accept |
| Come Over   | 7 days              | Single session use — short is cleaner         |
| Peek        | 30–90 days          | Match how long the content stays relevant     |
| Letterbox   | 90 days or 1 year   | Async communication needs longevity           |

Not prescriptive — just a nudge in the right direction.

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

1. **Invite landing page** _(all types)_ — highest impact, unblocks family/friends use case
2. **Per-type recipient screens** — Come Over, Peek, Letterbox each need their own landing
3. **Existing user invite acceptance** — one-tap flow for users already signed in
4. **Guided Key save flow** — reduces signup abandonment ✓ _shipped_
5. **Intent screen before mnemonic** — reframes anxiety as empowerment ✓ _shipped_
6. **First den with welcome note** — warm landing after signup ✓ _shipped_
7. **Login word-by-word input** — reduces returning user friction
8. **Come Over offline holding screen** — prevents confusion when host is away
9. **Peek guest view** — removes mnemonic barrier for casual read-only sharing
10. **Expired link compassionate path** — replaces generic error
11. **Key duration guidance** — nudges senders toward sensible expiry choices
12. **Sender "what happens next" summary** — closes the loop after sending
13. **PWA install prompt** — improves retention after first session
14. **Lost Key compassionate path** — reduces support confusion
15. **First-run checklist** — nice to have, not urgent

---

_The goal is simple: the first time someone uses Meerkat,
they should feel looked after — not tested._
