// Ask Vela response harness. Runs every applicable fixture × question pair
// through the live system prompt + summary-builder path, captures the
// model's response, and writes a transcripts-only markdown file. The
// human (the user, or me reviewing) reads transcripts.md and grades.
//
// No programmatic LLM-as-judge — that approach was burning money on
// Sonnet calls without explicit consent. The judge.js module stays in
// git in case it's wanted later.
//
// Usage:
//   node scripts/eval-ask-vela/run.js
//                                  → uses MODEL from _lib/ask-vela-prompt.js
//   ASK_VELA_MODEL=claude-sonnet-4-6 node scripts/eval-ask-vela/run.js
//                                  → run with a different assistant model
//   Reads /Users/kristopher/Vela/.env.local for ANTHROPIC_API_KEY.

const fs = require("fs");
const path = require("path");
const { fixtures } = require("./fixtures");
const { questions } = require("./questions");
const promptLib = require("../../netlify/functions/_lib/ask-vela-prompt");
const { MAX_TOKENS, SYSTEM_PROMPT, buildUserMessage } = promptLib;
const MODEL = process.env.ASK_VELA_MODEL || promptLib.MODEL;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// ───── env ─────────────────────────────────────────────────────────────
function loadEnv() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envPath = "/Users/kristopher/Vela/.env.local";
  try {
    const txt = fs.readFileSync(envPath, "utf8");
    const m = txt.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* missing file is fine */ }
  return null;
}

const apiKey = loadEnv();
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY. Set in env or add to /Users/kristopher/Vela/.env.local");
  process.exit(1);
}

// ───── runner ──────────────────────────────────────────────────────────
async function callAskVela({ question, profile, summary }) {
  const userMessage = buildUserMessage(question, summary, profile);
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ask Vela call failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    response: data.content?.[0]?.text || "",
    usage: data.usage,
    userMessage,
  };
}

function pairs() {
  const out = [];
  for (const q of questions) {
    const apply = q.appliesTo || fixtures.map((f) => f.id);
    for (const fid of apply) {
      const fixture = fixtures.find((f) => f.id === fid);
      if (!fixture) {
        console.warn(`Skipping unknown fixture id: ${fid} (in question ${q.id})`);
        continue;
      }
      out.push({ fixture, question: q });
    }
  }
  return out;
}

// ───── main ────────────────────────────────────────────────────────────
async function main() {
  const allPairs = pairs();
  console.log(`Eval starting: ${fixtures.length} fixtures × ${questions.length} questions = ${allPairs.length} runs`);
  console.log(`Assistant model: ${MODEL}`);
  console.log(`(no programmatic judge — transcripts only, graded manually)`);

  const results = [];
  let i = 0;
  let totalIn = 0, totalOut = 0;
  for (const { fixture, question } of allPairs) {
    i++;
    process.stdout.write(`[${i}/${allPairs.length}] ${fixture.id} · ${question.id}... `);
    try {
      const { response, usage } = await callAskVela({
        question: question.text,
        profile: fixture.profile,
        summary: fixture.summary,
      });
      console.log("ok");
      totalIn += usage?.input_tokens || 0;
      totalOut += usage?.output_tokens || 0;
      results.push({
        fixture: fixture.id,
        fixtureLabel: fixture.label,
        stage: fixture.profile.stage,
        question: question.id,
        questionText: question.text,
        intent: question.intent,
        focus: question.focus || [],
        response,
        usage,
      });
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({
        fixture: fixture.id,
        question: question.id,
        questionText: question.text,
        error: err.message,
      });
    }
  }

  // ─── transcripts ──────────────────────────────────────────────────
  const outName = `transcripts-${MODEL.replace(/[^a-z0-9]+/gi, "-")}.md`;
  const outPath = path.join(__dirname, outName);
  fs.writeFileSync(outPath, renderTranscripts(results), "utf8");
  console.log(`\nTranscripts written: ${outPath}`);
  console.log(`Total tokens: ${totalIn} in / ${totalOut} out`);
}

// ───── renderer ────────────────────────────────────────────────────────
function renderTranscripts(results) {
  const lines = [];
  const date = new Date().toISOString().slice(0, 10);
  lines.push(`# Ask Vela Response Transcripts — ${date}`);
  lines.push("");
  lines.push(`Assistant model: \`${MODEL}\``);
  lines.push(`Total runs: **${results.length}**`);
  lines.push("");
  lines.push("Each entry below has the question, the user's stage and intent,");
  lines.push("and the model's response. No programmatic grading — read and grade manually.");
  lines.push("");

  for (const r of results) {
    lines.push(`## \`${r.fixture}\` × \`${r.question}\``);
    lines.push("");
    if (r.error) {
      lines.push(`**ERROR:** ${r.error}`);
      lines.push("");
      continue;
    }
    lines.push(`**Stage:** ${r.stage} · **Intent:** ${r.intent}`);
    lines.push("");
    lines.push(`**Question:** ${r.questionText}`);
    lines.push("");
    lines.push(`**Response:**`);
    lines.push("```");
    lines.push(r.response);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
