// Ask Vela quality eval. Runs every applicable fixture × question pair
// through the same Claude Haiku 4.5 path the live function uses, then
// grades each response with Claude Sonnet against an 8-criteria rubric.
// Writes a markdown report.
//
// Usage: ANTHROPIC_API_KEY=... node scripts/eval-ask-vela/run.js
// Or:    node scripts/eval-ask-vela/run.js  (reads /Users/kristopher/Vela/.env.local)

const fs = require("fs");
const path = require("path");
const { fixtures } = require("./fixtures");
const { questions } = require("./questions");
const { CRITERIA, judgeResponse, JUDGE_MODEL } = require("./judge");
const {
  MODEL,
  MAX_TOKENS,
  SYSTEM_PROMPT,
  buildUserMessage,
} = require("../../netlify/functions/_lib/ask-vela-prompt");

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
  console.log(`Judge model: ${JUDGE_MODEL}`);

  const results = [];
  let i = 0;
  for (const { fixture, question } of allPairs) {
    i++;
    process.stdout.write(`[${i}/${allPairs.length}] ${fixture.id} · ${question.id}... `);
    try {
      const { response, usage } = await callAskVela({
        question: question.text,
        profile: fixture.profile,
        summary: fixture.summary,
      });
      const judge = await judgeResponse({
        apiKey,
        question: question.text,
        profile: fixture.profile,
        summary: fixture.summary,
        response,
      });
      const fails = Object.entries(judge.grades).filter(([, v]) => v.verdict === "FAIL").length;
      console.log(fails === 0 ? "ok" : `${fails} fail${fails === 1 ? "" : "s"}`);
      results.push({
        fixture: fixture.id,
        fixtureLabel: fixture.label,
        stage: fixture.profile.stage,
        question: question.id,
        questionText: question.text,
        intent: question.intent,
        focus: question.focus || [],
        response,
        grades: judge.grades,
        usage: { ask: usage, judge: judge.judgeUsage },
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

  // ─── report ─────────────────────────────────────────────────────────
  const reportPath = path.join(__dirname, "report.md");
  const md = renderReport(results);
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`\nReport written: ${reportPath}`);

  // Quick summary to stdout
  const totalCriteria = results.reduce((s, r) => s + (r.grades ? Object.keys(r.grades).length : 0), 0);
  const totalPasses = results.reduce((s, r) => s + (r.grades ? Object.values(r.grades).filter(g => g.verdict === "PASS").length : 0), 0);
  const totalFails = results.reduce((s, r) => s + (r.grades ? Object.values(r.grades).filter(g => g.verdict === "FAIL").length : 0), 0);
  console.log(`Summary: ${totalPasses} pass, ${totalFails} fail, ${totalCriteria - totalPasses - totalFails} N/A across ${totalCriteria} grades on ${results.length} runs.`);
}

// ───── report renderer ─────────────────────────────────────────────────
function renderReport(results) {
  const lines = [];
  const date = new Date().toISOString().slice(0, 10);
  lines.push(`# Ask Vela Quality Eval — ${date}`);
  lines.push("");
  lines.push(`Assistant model: \`${MODEL}\``);
  lines.push(`Judge model: \`${JUDGE_MODEL}\``);
  lines.push(`Total runs: **${results.length}**`);
  lines.push("");

  // Failure aggregation by criterion
  const failsByCriterion = {};
  for (const r of results) {
    if (!r.grades) continue;
    for (const [cid, g] of Object.entries(r.grades)) {
      if (g.verdict === "FAIL") {
        if (!failsByCriterion[cid]) failsByCriterion[cid] = [];
        failsByCriterion[cid].push({ fixture: r.fixture, question: r.question, reason: g.reason });
      }
    }
  }

  lines.push("## Failures by criterion");
  lines.push("");
  if (Object.keys(failsByCriterion).length === 0) {
    lines.push("_No failures detected._");
  } else {
    for (const cid of Object.keys(CRITERIA)) {
      const fails = failsByCriterion[cid] || [];
      if (fails.length === 0) continue;
      lines.push(`### ${cid} — ${CRITERIA[cid].name} (${fails.length} fail${fails.length === 1 ? "" : "s"})`);
      lines.push("");
      for (const f of fails) {
        lines.push(`- \`${f.fixture}\` / \`${f.question}\` — ${f.reason}`);
      }
      lines.push("");
    }
  }

  // Failure transcripts (only failed runs, full detail)
  lines.push("## Failed runs (full transcripts)");
  lines.push("");
  const failedRuns = results.filter((r) => r.grades && Object.values(r.grades).some((g) => g.verdict === "FAIL"));
  if (failedRuns.length === 0) {
    lines.push("_No runs had any failed criterion._");
  } else {
    for (const r of failedRuns) {
      lines.push(`### \`${r.fixture}\` × \`${r.question}\``);
      lines.push("");
      lines.push(`**Stage:** ${r.stage} · **Intent:** ${r.intent}`);
      lines.push("");
      lines.push(`**Question:** ${r.questionText}`);
      lines.push("");
      lines.push(`**Response:**`);
      lines.push("```");
      lines.push(r.response);
      lines.push("```");
      lines.push("");
      lines.push(`**Grades:**`);
      for (const [cid, g] of Object.entries(r.grades)) {
        const icon = g.verdict === "PASS" ? "✓" : g.verdict === "FAIL" ? "✗" : "—";
        lines.push(`- ${icon} ${cid} (${CRITERIA[cid].name}): ${g.verdict} — ${g.reason}`);
      }
      lines.push("");
    }
  }

  // Errors (if any)
  const errors = results.filter((r) => r.error);
  if (errors.length) {
    lines.push("## Errors");
    lines.push("");
    for (const e of errors) {
      lines.push(`- \`${e.fixture}\` / \`${e.question}\`: ${e.error}`);
    }
    lines.push("");
  }

  // Pass-only summary (collapsed)
  lines.push("## All runs (one-line)");
  lines.push("");
  lines.push("| Fixture | Question | Pass / Fail / N/A |");
  lines.push("|---|---|---|");
  for (const r of results) {
    if (!r.grades) {
      lines.push(`| \`${r.fixture}\` | \`${r.question}\` | ERROR |`);
      continue;
    }
    const counts = { PASS: 0, FAIL: 0, "N/A": 0 };
    for (const g of Object.values(r.grades)) counts[g.verdict] = (counts[g.verdict] || 0) + 1;
    lines.push(`| \`${r.fixture}\` | \`${r.question}\` | ${counts.PASS} / ${counts.FAIL} / ${counts["N/A"]} |`);
  }

  return lines.join("\n") + "\n";
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
