# Video Shop — Live Video Consultation

> **Intern Project Brief.** This is a competitive build. Multiple teams are building the same
> specification. The strongest implementation wins. Read this entire document before writing
> any code.

---

## 1. What you are building

A web application for **live video consultations between a customer and an in-store consultant**.

The core idea: a customer browsing a website clicks a button, agrees to the terms, and is put
through to a real consultant who appears **live on video**. Think of it as the video equivalent
of walking up to a help desk — except the customer never has to install anything, and the
consultant works from a normal browser.

There is one product rule that defines this whole project:

> **The customer sees and hears the consultant. The consultant does *not* see the customer.**

Video flows **one way** (consultant → customer). Audio and chat are two-way. This sounds like a
small detail. It is not. It changes how you set up every single media connection, and "we
accidentally sent the customer's camera to the consultant" is the kind of bug that loses points.

This is a real, non-trivial engineering problem. Real-time media is hard: a call that looks fine
on your laptop on `localhost` can fail completely between two real networks. A large part of how
you will be judged is simply **whether calls actually connect — reliably, and in the right
direction.**

---

## 2. Tech stack

| Layer | Technology | Choice |
|-------|-----------|--------|
| Backend | **Java + Spring Boot** | Fixed — required for all teams |
| Real-time signaling | **WebSocket (Spring)** | Fixed — part of the backend |
| Media transport | **WebRTC (browser APIs)** | Fixed — it's the whole point |
| Frontend | **React or Angular** (or another mainstream JS/TS framework) | Your team's choice |
| Database | PostgreSQL, MySQL, H2, etc. | Your team's choice |
| STUN / TURN | Public STUN for dev (e.g. Google's); TURN is a stretch goal | Your team's choice |
| Blob storage (file transfer / recording) | Local filesystem or object storage | Your team's choice |

The backend is fixed so all teams can be compared fairly. The frontend is your call — pick the
one your team is strongest in and be ready to justify it.

---

## 3. Core requirements

These are the **must-have** features. Aim to have all of them working by the end of the sprint.

### 3.1 Customer entry & consent
- A **"Start video call"** button on a simple demo page (a fake product/tariff page is fine).
- A mandatory **terms & conditions consent gate** — a pop-up with a checkbox the customer must
  tick *before* any camera, microphone, or connection is started.
- **Capture the source** — record *where* the call was started from (which page/button). This
  feeds reporting later, so design for it now rather than bolting it on.

### 3.2 Waiting room & queue
- After consent, the customer lands in a **waiting room** with a clear "connecting you to a
  consultant…" state (a placeholder/looping "store" stream or a simple holding screen is fine).
- The customer is placed in a **queue** and connected when a consultant becomes available.

### 3.3 The call — one-way video, two-way audio
- The **consultant's** camera and microphone stream to the customer.
- The customer **sees and hears** the consultant live, in a `<video>` element.
- The consultant receives **no customer video.** (Customer microphone is optional — decide and
  document whether the consultant can hear the customer; two-way audio is the natural choice.)
- Being deliberate about **media direction** is a core requirement, not an afterthought — see §4.

### 3.4 In-call tools
- **Two-way text chat** during the call.
- **One-way file transfer** — the customer can send a file to the consultant. *Not* the reverse.
- **Screen sharing** between consultant and customer.

### 3.5 Agent console & routing
- Consultant **login**.
- **Availability** status (online / busy / offline).
- A view of **waiting customers**; the consultant can **answer or decline**.
- **End call.**
- Basic **routing** — an incoming customer is directed to an available consultant (skill/group
  routing is welcome but a simple "next available" is acceptable for core).

### 3.6 Admin & reporting
- A **log of every call**: consultant, start time, duration, source page, answered/missed.
- A view of **current, past, and missed** calls, plus **how many consultants are logged in /
  available**.
- **Export to CSV.**
- Basic metrics: calls per day, **speed of answer** (time from request to pickup).

### 3.7 Basic UX
- Clear states everywhere ("Waiting for a consultant…", "Consultant is connecting…", "Call
  ended").
- Handle **camera/microphone permission denial** without crashing.
- A **"no consultant available"** fallback — send the customer to a short contact form.
- The app should not hang or white-screen on a failed connection.

---

## 4. The hard part: real-time media with WebRTC

This is where teams will separate. Read this section slowly.

**The goal:** two browsers exchange live media directly, with your server only helping them find
each other. The consultant's video reaches the customer; nothing reaches the consultant that
shouldn't.

**The mental model you must internalize:**

1. Your **server is a *signaling broker*, not the media path.** For a 1:1 call, audio/video flow
   **peer-to-peer** between the two browsers. Your Java backend passes small text messages back
   and forth so the peers can negotiate — it never carries the video itself.
2. The negotiation flow: the consultant's browser calls **`getUserMedia`** (camera + mic) →
   creates an **SDP offer** → sends it through your **WebSocket** to the customer → the customer
   answers with an **SDP answer** → both sides trade **ICE candidates** → **STUN** helps them
   discover their public addresses through NAT → media connects → you attach the remote stream to
   a `<video>` element.
3. **⚠️ The directionality trap.** Because video is one-way, only the consultant publishes a
   video track. The customer is **receive-only**. Set this up explicitly — control the
   transceiver directions (`sendrecv` vs `sendonly` / `recvonly`) or simply never add the
   customer's video track to the connection. The naive "copy a WebRTC tutorial" approach sends
   *both* cameras and silently breaks the core product rule. How cleanly you enforce one-way
   video is a key differentiator.
4. **Signaling design is yours to invent.** Think through: rooms/sessions, who is the caller and
   who is the callee, what happens while a customer is queued *before* a consultant is assigned,
   how you (re)negotiate when a consultant picks up, and — critically — **cleanup on hangup**.
   Connections you forget to tear down become "ghost calls" that corrupt your availability and
   reporting.

**Do not:**
- Route media through your Java server. That's an SFU/MCU and is explicitly out of scope — keep
  it peer-to-peer.
- Assume `localhost` behaves like the real internet. Two tabs on one machine always connect;
  two real networks often won't without **TURN** (a relay for when P2P is blocked). Getting a
  cross-network call working is a stretch goal — but *know* this is why it fails.
- Ignore the unhappy paths: denied camera/mic permissions, ICE connection failure, a consultant
  who never answers.
- Leave peer connections dangling after a call ends.

You do **not** have to follow any particular signaling protocol. If your team has a clean,
well-reasoned design, document it in **`ARCHITECTURE.md`** and defend it. That document — your
signaling protocol, your media flow, and *why* your one-way setup is correct — is part of your
score. Originality with sound reasoning scores well.

---

## 5. Suggested build order (milestones)

You have limited time. Build in this order so you always have something working to demo.

1. **Project skeleton** — Spring Boot backend runs, frontend runs, they talk to each other; a
   WebSocket "echo" endpoint works.
2. **Signaling channel** — two browser tabs can exchange messages through the server via a shared
   room/session.
3. **Bare one-way 1:1 call** — get the consultant's video showing in a second tab, over *your*
   signaling, with the customer receive-only. **Prove media connects before adding any product
   features.**
4. **Entry, consent & waiting room** — the customer journey: button → T&C gate → waiting room →
   queue → connected.
5. **Agent console & routing** — consultant login, availability, see/answer/decline waiting
   customers, end call.
6. **In-call tools** — two-way chat, one-way file transfer, screen sharing.
7. **Admin & reporting** — call log, current/past/missed views, CSV export, basic metrics.
8. **Polish** — permission handling, error states, basic reconnection, the "no consultant"
   fallback.
9. **Stretch goals** — only after everything above works.

> **Tip:** Get step 3 rock-solid before step 4. Debugging a broken product flow *and* a broken
> media connection at the same time is miserable. Make the call connect first; build on top of it
> once it's stable.

---

## 6. Stretch goals (for extra credit)

Attempt these **only after every core requirement works.**

- **On-screen pointer & screen-share annotation** — the consultant points at / draws on the
  shared screen.
- **Panoramic / store live feed** — ingest an IP camera (RTSP/RTMP) and show it as the waiting
  screen. Genuinely hard: it involves transcoding to something a browser can play.
- **Multi-camera switching** mid-call (e.g. swap between a webcam and a "product" camera).
- **Call transfer** — consultant → consultant, or desktop ↔ mobile.
- **Call recording** — server-side recording of calls, with a retention policy.
- **Personal / campaign links** — generate QR / SMS / email links (with expiry) that drop a
  customer straight into a queue or to a specific consultant.
- **Post-call satisfaction survey.**
- **Caller blacklist** — block unwanted callers.
- **TURN server** — make calls work between two genuinely different networks, not just on
  `localhost`.
- **PWA / mobile consultant view.**
- **Adaptive quality** — degrade video gracefully on a weak connection while protecting audio.

---

## 7. How you will be judged

| Criterion | Weight | What we look for |
|-----------|--------|------------------|
| **Real-time media correctness** | 35% | Do calls actually connect, reliably? Is video genuinely **one-way** (consultant → customer only)? Clean session lifecycle — no ghost calls? Does it handle permission denial and ICE failure? |
| **Functionality** | 25% | Do entry/consent/queue, agent console/routing, in-call tools, and admin/reporting all work end-to-end? |
| **Code quality** | 15% | Structure, readability, tests, sensible commits, clean Git history. |
| **UX & polish** | 15% | Is it usable? Clear states? Does it handle errors gracefully instead of hanging? |
| **Design defense** | 10% | Can your team explain your signaling protocol and media architecture, and the tradeoffs you made? |

A call that **always connects** beats a beautiful UI that drops every other call. Spend your
effort accordingly.

---

## 8. Working agreement & logistics

- **Daily standup** — 15 minutes each morning. Say what you did, what you're doing, and what's
  blocking you.
- **Git hygiene** — work on branches, open pull requests, review each other's code before
  merging. **No direct commits to `main`** without a review.
- **Ask early** — if you are stuck for more than ~30 minutes, ask your covering mentor. Being
  stuck silently helps no one.
- **Document as you go** — your `README.md` (how to run it) and `ARCHITECTURE.md` (how signaling
  and media work) are part of your deliverable, not an afterthought.

---

## 9. Deliverables

By the end of the sprint, your repo should contain:

1. The working application (backend + frontend).
2. A **`README.md`** with clear setup instructions — how to run the backend, the frontend, and
   any database setup. A reviewer should be able to clone and run it. (Note where to allow
   camera/mic permissions and that two browser tabs are the easy way to test.)
3. An **`ARCHITECTURE.md`** explaining your signaling protocol, your media flow, and *why* your
   one-way video setup is correct.
4. A short list of what's done, what's partial, and what you'd do with more time.

---

Good luck. Build something a customer would actually want to call.
