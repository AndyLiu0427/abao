# 阿寶 Abao

**Before the money moves, family knows.**

Abao is a personal AI companion for your parents. It chats with them every day, and the moment money comes up, it brings the real family in.

Built at c0mpiled-18 Taipei (YC RFS: AI for the Aging Population).

**Live:** https://abao.vercel.app

## The insight

Scammers win with two moves: they **pretend to be someone you trust**, and they **isolate you** ("don't tell Dad", "this investigation is confidential"). Fake investment "teachers" go further and simply keep a lonely senior company for weeks.

So Abao does not stop at "AI says this looks like a scam". It **breaks the isolation**: before money moves, it pulls the real person into the conversation. The AI's judgement is only the trigger. A real family member's one tap is what protects the parent.

## How it works

1. **Parent opens Abao** (a PWA: install from a link, no app store, no account) and says how the family calls them.
2. **Parent invites family** with a link or QR code. A family member opens it, types their name, done.
3. **Abao chats** like a caring grandchild, by text, voice or photo, and remembers what it is told.
4. **When money risk shows up**, the agent acts on its own:
   - "Mom, I changed my number, I need NT$50,000" → Abao asks the real son: **是我 / 不是我**. One tap, and the parent's screen turns red ("那不是本人，不要匯款") or green, read aloud.
   - Investment "teacher" with guaranteed returns → Abao tells the parent it is checking with family, and gives the family member a **"I'm calling her now"** button.
   - "Prosecutor's office: your account is frozen" → Abao never dials the number in the message. It shows 165 (Taiwan anti-fraud hotline) and 110.
5. If anything fails, the app falls back to "don't send money, call 165". The screen never breaks.

Abao is transparent: it only involves family when money is at risk, and it always tells the parent first.

## Agent design

One Claude tool-use loop (`lib/agent.ts`, max 5 turns) with four tools:

| Tool | What it does |
|---|---|
| `record_check` | Stores the analysis of a suspicious message (risk, claimed identity, red flags) |
| `ask_family_member` | Sends a real family member a one-tap question (`is_it_you`) or a heads-up (`heads_up`) |
| `get_official_contact` | Shows official numbers; never a number from the message |
| `remember_fact` | Long-term family memory, fed back into the system prompt |

The family member's answer does not go through the model. It is written straight into the parent's chat as a proactive message, so the warning arrives within the 2-second poll.

## Stack

Next.js (App Router) · Tailwind · Claude API (`claude-fable-5-2`, vision + tool use, server-side refusal fallback) · Upstash Redis · Web Speech API (voice in, read-aloud out) · PWA manifest + service worker · Vercel.

## Run it

```bash
npm install
ANTHROPIC_API_KEY=... npm run dev
```

Without Upstash env vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) it uses in-memory storage, which is fine locally but not on serverless. `GET /api/health` shows which storage and whether the API key is set. `MOCK_AI=1` runs a scripted model for UI work without a key.

Try it alone on one device: open `/` as the parent, tap ＋家人, open the invite link in another tab as the family member.
