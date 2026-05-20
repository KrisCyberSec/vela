// Anonymous daily-prompt "Circle" surface. Currently in preview mode
// because the Firebase community backend (community.js) isn't live yet —
// anything that would be a lie (answer counts, sample replies, share
// button) is hidden behind the COMMUNITY_PREVIEW flag. Today's prompt
// text and the privacy footer stay visible. Function is still named
// CommunityScreen so the App.jsx tab wiring is unchanged. Flip the
// preview flag in the same commit that wires LIVE_COMMUNITY to the
// backend.

import { useState } from "react";

import { UIIcon } from "../components/icons";

export default function CommunityScreen() {
  // Renamed conceptually to "Circle" in the redesign — anonymous daily-prompt
  // model. Kept function name CommunityScreen so App.jsx wiring is unchanged.
  // Real backend integration is still gated by LIVE_COMMUNITY (community.js);
  // this is the visual shell that lights up once we flip the flag.

  // Preview mode: backend isn't live yet, so we hide everything that would
  // be a lie if the user took it at face value (answer counts, "12 reading
  // now" pulse, the sample replies feed, past prompts, the share-as-no-op
  // button). The prompt-of-the-day text and the privacy footer stay —
  // those are honest. Flip to false in the same commit that wires
  // community.js to the backend.
  const COMMUNITY_PREVIEW = true;

  const [reactions, setReactions] = useState({ 0: true });
  const [saved, setSaved] = useState({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const isFirst = JSON.parse(localStorage.getItem("vela_circle_first_visit") || "true");
  const [showFirst, setShowFirst] = useState(isFirst);

  function dismissFirst() {
    localStorage.setItem("vela_circle_first_visit", "false");
    setShowFirst(false);
  }

  const toggle = (i) => setReactions((r) => ({ ...r, [i]: !r[i] }));
  const toggleSave = (i) => setSaved((s) => ({ ...s, [i]: !s[i] }));

  // Hardcoded sample data — real prompt + replies come from the Firebase
  // backend (community.js) once LIVE_COMMUNITY is enabled.
  const promptToday = {
    // Date renders live so we never ship "TODAY'S PROMPT · APR 30"
    // sitting under the May 1 calendar header. Once LIVE_COMMUNITY is on,
    // this comes from the backend along with the prompt itself.
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    text: <>What's one thing you've stopped <em>apologizing for</em> since perimenopause began?</>,
    plain: "What's one thing you've stopped apologizing for since perimenopause began?",
    answered: 247,
    reading: 12,
  };

  const replies = [
    {
      avatar: "M", tone: "a", who: "Anonymous", age: "52 · post-meno", when: "2h",
      body: "What helped most was naming it out loud at work. Not as an apology. Just \"I'm in a hot flash, give me 30 seconds.\" The first time felt impossible. The fifth time felt like nothing.",
      hearts: 47, echoed: 12, featured: true,
    },
    {
      avatar: "R", tone: "b", who: "Anonymous", age: "48 · perimeno", when: "4h",
      body: "Honestly? Letting go of the version of me who could push through anything on four hours of sleep. She was great. She's also retired now.",
      hearts: 31, echoed: 8,
    },
    {
      avatar: "J", tone: "c", who: "Anonymous", age: "46 · perimeno", when: "6h",
      body: "Magnesium glycinate at bedtime. Walked into my doctor's office with three months of Vela data and got an actual conversation instead of a shrug. Both helped.",
      hearts: 28, echoed: 5,
    },
    {
      avatar: "K", tone: "d", who: "Anonymous", age: "51 · post-meno", when: "Yesterday",
      body: "I stopped fighting the brain fog and started working with it. Heavy thinking before noon, admin in the afternoon, walks at 4. I'm more productive now than I was at 40, just on a different rhythm.",
      hearts: 22, echoed: 4,
    },
  ];

  const past = [
    { d: "29", m: "Apr", q: "What's something you've grieved that surprised you?", replies: 142 },
    { d: "28", m: "Apr", q: "When did you first realize this was perimenopause and not stress?", replies: 98 },
    { d: "27", m: "Apr", q: "What does your partner / family understand now that they didn't a year ago?", replies: 67 },
  ];

  return (
    <div className="screen active">
      <section className="cir-greeting">
        <h1>The <em>circle.</em></h1>
        <p className="meta">Anonymous, no DMs, no follower counts. Just the question and the answers.</p>
      </section>

      {showFirst && (
        <section className="cir-first-welcome">
          <div className="cir-first-eye"><UIIcon name="Sparkle" size={12} /> First time here</div>
          <h3>You don't have to <em>say anything yet.</em></h3>
          <p>{COMMUNITY_PREVIEW
            ? "The circle opens later this season. Until then, the prompt below is real. Sit with it. Sharing and replies will turn on when we flip the switch."
            : "Most people read for a week before they answer. That's fine. The prompt below is today's. There will be a new one tomorrow."}</p>
          <div className="cir-first-rules">
            <span><UIIcon name="Eye" size={12} /> Anonymous by default</span>
            <span><UIIcon name="Lock" size={12} /> No replies, no DMs</span>
            <span><UIIcon name="CheckCircle" size={12} /> Delete anytime</span>
          </div>
          <button
            type="button"
            onClick={dismissFirst}
            style={{ marginTop: 12, background: "transparent", border: "none", color: "var(--clay-dark)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 4, textDecoration: "underline" }}
          >
            Got it. Show me the prompt
          </button>
        </section>
      )}

      {/* Today's prompt */}
      <section className="cir-prompt" aria-label="Today's prompt">
        <span className="eye"><span className="dot" /> Today's prompt · {promptToday.date}</span>
        <h2>{promptToday.text}</h2>
        {!COMMUNITY_PREVIEW && (
          <div className="cir-prompt-meta">
            <span><strong style={{ color: "var(--ink)", fontWeight: 600 }}>{promptToday.answered}</strong> have answered</span>
            <span className="dot">·</span>
            <span className="live"><span className="pulse" /> {promptToday.reading} reading now</span>
          </div>
        )}
        {COMMUNITY_PREVIEW ? (
          <button
            type="button"
            className="cir-share-btn"
            disabled
            style={{ opacity: 0.5, cursor: "not-allowed" }}
            aria-disabled="true"
          >
            <UIIcon name="Lock" size={14} />
            Sharing opens when the circle launches
          </button>
        ) : (
          <button type="button" className="cir-share-btn" onClick={() => setComposeOpen(true)}>
            <UIIcon name="Sparkle" size={14} />
            Share your answer
            <span className="anon">· anonymous</span>
          </button>
        )}
      </section>

      {/* Replies — hidden in preview because the sample replies aren't
          real users. Once LIVE_COMMUNITY ships, this renders the real
          feed from community.js. */}
      {!COMMUNITY_PREVIEW && (
        <>
          <div className="cir-section-label">
            <span>Answers</span>
            <span className="filter-chip">
              <UIIcon name="ArrowUp" size={11} /> Most echoed
            </span>
          </div>

          {replies.map((r, i) => (
        <article key={i} className={`cir-reply${r.featured ? " featured" : ""}`}>
          <div className="cir-reply-head">
            <span className={`cir-avatar ${r.tone}`}>{r.avatar}</span>
            <span className="who">{r.who}</span>
            <span className="age">· {r.age}</span>
            <span className="when">{r.when}</span>
          </div>
          <p className="cir-reply-body">{r.body}</p>
          <div className="cir-reply-foot">
            <button
              type="button"
              className={`react${reactions[i] ? " on" : ""}`}
              onClick={() => toggle(i)}
              aria-pressed={!!reactions[i]}
            >
              <UIIcon name="Heart" size={12} weight={reactions[i] ? "fill" : "duotone"} />
              <span>{r.hearts + (reactions[i] ? 1 : 0)}</span>
            </button>
            <span style={{ color: "var(--ink-light)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <UIIcon name="ChatCircle" size={12} /> {r.echoed} echoed
            </span>
            <button
              type="button"
              className={`save${saved[i] ? " on" : ""}`}
              onClick={() => toggleSave(i)}
              aria-pressed={!!saved[i]}
            >
              <UIIcon name="Star" size={13} weight={saved[i] ? "fill" : "duotone"} />
            </button>
          </div>
        </article>
          ))}

          {/* Past prompts — also gated; the dates and answer counts here
              are sample data, not historical posts. */}
          <div className="cir-section-label"><span>Past prompts</span></div>
          <div className="cir-past">
            {past.map((p) => (
              <button key={p.d} type="button" className="cir-past-row">
                <div className="day">
                  <div className="num">{p.d}</div>
                  <div className="mo">{p.m}</div>
                </div>
                <div className="body">
                  <div className="q">{p.q}</div>
                  <div className="stats">{p.replies} answers</div>
                </div>
                <span className="arrow">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Privacy footer */}
      <div className="cir-privacy">
        <span className="ico"><UIIcon name="Lock" size={14} /></span>
        <div className="body">
          <strong>Always anonymous</strong>
          No usernames, no profiles, no photos. We strip metadata before posting. You can delete your answer anytime.
        </div>
      </div>

      {/* Compose sheet */}
      {composeOpen && (
        <>
          <div className="dd-scrim show" onClick={() => setComposeOpen(false)} />
          <aside className="dd-sheet show" role="dialog" aria-modal="true" aria-label="Compose answer">
            <div className="dd-handle" />
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.3 }}>
              {promptToday.text}
            </p>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Take your time. There's no word count."
              style={{ width: "100%", minHeight: 110, border: "1px solid var(--border)", borderRadius: 14, padding: 12, fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink)", resize: "none", outline: "none", lineHeight: 1.5, background: "var(--card-bg)" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--sage-dark)", fontWeight: 500 }}>
                <UIIcon name="Lock" size={12} /> Posting anonymously
              </span>
              <button
                type="button"
                disabled={draft.trim().length < 8}
                onClick={() => { setDraft(""); setComposeOpen(false); }}
                style={{ padding: "11px 18px", borderRadius: 12, background: "var(--clay)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: draft.trim().length < 8 ? "not-allowed" : "pointer", opacity: draft.trim().length < 8 ? 0.4 : 1, fontFamily: "inherit" }}
              >
                Share
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
