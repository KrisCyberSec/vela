// Canned-AI engine: deterministic Ask Vela responses for when the
// real Anthropic-backed API is unavailable (free tier, network failure,
// or rate-limit hit). Built from an evidence-based knowledge base
// (NAMS, NHS, Mayo Clinic, Cochrane reviews, Journal of Midlife Health).
//
// Flow: matchQuestion classifies the user's input -> generateResponse
// renders a context-rich answer from the knowledge base + their logs.
// _lastHandler / _lastParam keep one turn of conversation state so
// follow-ups like "what about caffeine?" route back to the same handler.

import { analyzeCorrelations } from "./correlations";
import {
  analyzeSymptomTrend,
  analyzeTriggerImpact,
  analyzeOverallTrend,
  analyzeBestWorstDays,
  analyzeRecentPattern,
  generateDoctorSummary,
} from "./aiAnalysis";
import { generateTalkingPoints } from "./reminders";
import { getJourneyLabel } from "./formatters";
import { getPersonalization } from "./personalization";
import { analyzePatterns } from "./patterns";


export const AI_SYMPTOM_NAMES = [
  "hot flash", "night sweat", "poor sleep", "brain fog", "mood shift", "fatigue",
  "anxiety", "irritability", "depression", "panic attack", "memory lapse",
  "word-finding", "difficulty concentrating", "mood swing", "low motivation",
  "headache", "migraine", "joint pain", "muscle ache", "back pain", "palpitation",
  "chill", "dizziness", "tinnitus", "tingling", "numbness", "restless leg",
  "hair thinning", "hair loss", "dry skin", "breast tenderness", "weight change",
  "weight gain", "vaginal dryness", "vaginal irritation", "low libido", "libido",
  "urinary urgency", "incontinence", "bloating", "nausea", "acid reflux",
  "digestive", "shortness of breath", "dry mouth", "dry eye", "gum problem",
  "crawling skin", "insomnia", "heart palpitation", "memory"
];

export const AI_TRIGGER_NAMES = ["caffeine", "alcohol", "exercise", "sleep", "stress", "sugar", "spicy", "smoking"];

// Conversational context for follow-ups (module-level, persists during session)
let _lastHandler = null;
let _lastParam = null;


export const SYMPTOM_KNOWLEDGE = {
  "hot flash": {
    prevalence: "Up to 80% of women experience hot flashes, making them the most common menopause symptom.",
    science: "Hot flashes are caused by changes in the hypothalamus (your body's thermostat) as estrogen levels fluctuate. The brain briefly misreads your body temperature and triggers a cooling response.",
    strategies: ["Layered clothing and keeping a room cool (68°F/20°C) can reduce frequency.", "Deep slow breathing (6-8 breaths/min) at the onset has been shown to reduce hot flash intensity in clinical trials.", "CBT for hot flashes has strong evidence. It doesn't reduce frequency but significantly reduces how bothersome they feel.", "Regular aerobic exercise improves overall quality of life during menopause. Its direct effect on hot flash frequency is still debated, but many women report benefit."],
    stages: { perimenopause: "Hot flashes often peak in late perimenopause and the first 1-2 years after your final period.", postmenopause: "For most women, hot flashes gradually decrease over 2-5 years, though about 10% experience them for a decade or more.", surgical: "Surgical menopause often causes more sudden and intense hot flashes because estrogen drops rapidly rather than gradually." },
    whenToSeeDoc: "If hot flashes are disrupting sleep or daily life, ask your provider about hormone therapy (HT). It's the most effective treatment, with clinical trials showing up to a 75% reduction in hot flash frequency."
  },
  "night sweat": {
    prevalence: "Night sweats affect up to 75% of menopausal women. They're essentially hot flashes that happen during sleep.",
    science: "Like hot flashes, they're driven by hormonal changes affecting your thermoregulatory center. They tend to be worse in the first half of the night.",
    strategies: ["Moisture-wicking sleepwear and breathable bedding (cotton, bamboo) make a measurable difference.", "Keep bedroom temperature at 65-68°F (18-20°C). Cooler than most people think.", "Avoiding alcohol and spicy foods within 3 hours of bed has been shown to reduce night sweats.", "A cooling pillow or bedside fan directed at the upper body can help."],
    stages: { perimenopause: "Night sweats often increase as you get deeper into perimenopause.", postmenopause: "They typically improve within 2-3 years post-menopause, but everyone's timeline is different.", surgical: "Night sweats may be more intense after surgical menopause and can benefit significantly from HT." },
    whenToSeeDoc: "If night sweats are causing chronic sleep disruption, this is worth discussing. Poor sleep compounds nearly every other menopause symptom."
  },
  "brain fog": {
    prevalence: "About 60% of women report cognitive changes during the menopause transition. You're not imagining it.",
    science: "Estrogen plays a key role in the prefrontal cortex and hippocampus. As levels fluctuate, you may notice word-finding difficulty, forgetfulness, and trouble concentrating. Research shows this is typically temporary.",
    strategies: ["Prioritizing sleep quality has the strongest evidence for improving cognitive function during menopause.", "Regular aerobic exercise increases blood flow to the brain and has been shown to improve cognitive performance.", "Breaking tasks into smaller chunks and using lists/reminders isn't giving up. It's a smart adaptation.", "Omega-3 fatty acids and a Mediterranean-style diet are associated with better cognitive function in midlife women."],
    stages: { perimenopause: "Brain fog tends to be worst during perimenopause when hormones fluctuate most. The good news: research shows cognition typically recovers in postmenopause.", postmenopause: "Most women find cognitive function stabilizes and often improves in postmenopause as hormone levels settle.", surgical: "Cognitive changes after surgical menopause can be more pronounced. Discuss HT timing with your provider." },
    whenToSeeDoc: "If cognitive changes are affecting your work or daily functioning, mention it to your provider. They can rule out other causes (thyroid, B12, sleep apnea) and discuss treatment options."
  },
  "fatigue": {
    prevalence: "Fatigue affects up to 85% of menopausal women. It's one of the most common but least discussed symptoms.",
    science: "Menopause-related fatigue is multifactorial: disrupted sleep, hormonal shifts affecting energy metabolism, and the cumulative toll of other symptoms like night sweats and anxiety.",
    strategies: ["Address sleep quality first. It's the #1 lever for energy. Even small improvements in sleep make a big difference.", "Regular moderate exercise paradoxically increases energy levels. Start with 15-20 minute walks if energy is very low.", "Iron and B12 levels are worth checking. Deficiencies are common in midlife women and easily treated.", "Consistent wake times (even on weekends) help regulate your circadian rhythm and improve energy."],
    stages: { perimenopause: "Fluctuating hormones can cause unpredictable energy crashes. Tracking patterns (like you're doing) helps identify your best times of day.", postmenopause: "Energy often stabilizes in postmenopause. If fatigue persists, thyroid function is worth checking.", surgical: "Post-surgical fatigue can be significant. Your body is recovering from both surgery and sudden hormone changes." },
    whenToSeeDoc: "If fatigue is severe or persistent, ask about thyroid function, iron/ferritin, B12, and vitamin D levels. These are common, treatable contributors."
  },
  "anxiety": {
    prevalence: "Up to 51% of women aged 40-55 experience increased anxiety during the menopause transition, even those with no prior history.",
    science: "Estrogen modulates serotonin and norepinephrine, while progesterone has a calming effect via GABA receptors. As both hormones fluctuate during the menopause transition, anxiety can spike. Even in women with no prior history. This is a physiological response, not a personal failing.",
    strategies: ["Deep breathing exercises (4-7-8 technique: inhale 4s, hold 7s, exhale 8s) activate the parasympathetic nervous system.", "Regular exercise has strong evidence for reducing anxiety. As effective as medication for mild-moderate cases.", "CBT has been shown to be particularly effective for menopause-related anxiety.", "Limiting caffeine can help. Sensitivity often increases during menopause."],
    stages: { perimenopause: "Anxiety often peaks during perimenopause when hormone fluctuations are greatest. It's one of the symptoms most likely to improve with time.", postmenopause: "Many women find anxiety decreases significantly in postmenopause as hormones stabilize.", surgical: "Anxiety after surgical menopause can be intense due to the sudden hormone drop. Don't hesitate to seek support." },
    whenToSeeDoc: "If anxiety is interfering with daily life, relationships, or sleep, talk to your provider. Both HT and targeted medications can be very effective."
  },
  "joint pain": {
    prevalence: "Joint pain affects more than 50% of menopausal women. It's far more common than most people realize.",
    science: "Estrogen has anti-inflammatory properties and helps maintain joint cartilage and synovial fluid. As estrogen declines, joints can become stiffer and more painful, particularly in the hands, knees, and hips.",
    strategies: ["Regular movement. Even gentle stretching and walking. Helps maintain joint lubrication and flexibility.", "Anti-inflammatory foods (fatty fish, berries, leafy greens, turmeric) may help reduce joint inflammation.", "Strength training builds muscle around joints, providing better support and reducing pain.", "Maintaining a healthy weight reduces stress on weight-bearing joints."],
    stages: { perimenopause: "Joint pain often appears in perimenopause and can be one of the first noticeable symptoms.", postmenopause: "For some women, HT can significantly improve joint symptoms. It's worth discussing.", surgical: "Joint symptoms may be more sudden after surgical menopause due to rapid estrogen decline." },
    whenToSeeDoc: "If joint pain is new, persistent, or limiting your activity, see your provider. They can distinguish menopause-related joint changes from other conditions like inflammatory arthritis."
  },
  "poor sleep": {
    prevalence: "Up to 60% of menopausal women report sleep disturbances. It's one of the most impactful symptoms.",
    science: "Estrogen and progesterone both play roles in sleep regulation. Night sweats, anxiety, and changes in melatonin production all contribute to disrupted sleep during menopause.",
    strategies: ["Keep a consistent sleep schedule. Your circadian rhythm becomes more sensitive during menopause.", "Avoid screens 1 hour before bed. Blue light suppresses melatonin, which already decreases with age.", "Cool, dark, quiet bedroom environment. Temperature is especially important during menopause.", "Magnesium glycinate (200-400mg before bed) has evidence for improving sleep quality in midlife women."],
    stages: { perimenopause: "Sleep disruption often worsens as perimenopause progresses, particularly due to night sweats and anxiety.", postmenopause: "Sleep typically improves in later postmenopause, though it may not fully return to pre-menopausal patterns.", surgical: "Sleep disruption after surgical menopause can be significant. HT often helps substantially." },
    whenToSeeDoc: "If sleep issues persist despite good sleep hygiene, discuss with your provider. They can screen for sleep apnea (risk increases after menopause) and discuss treatment options."
  },
  "irritability": {
    prevalence: "Irritability and mood changes affect up to 70% of women during the menopause transition.",
    science: "Estrogen fluctuations affect serotonin, dopamine, and norepinephrine. All key mood regulators. Add sleep disruption and other symptoms on top, and irritability is a natural response.",
    strategies: ["Regular exercise is one of the most effective mood regulators. Even a 20-minute walk can help.", "Mindfulness and stress-reduction techniques have strong evidence for mood management during menopause.", "Adequate sleep is crucial. Irritability and sleep deprivation are closely linked.", "Communicate with family/friends about what you're experiencing. Understanding helps everyone."],
    stages: { perimenopause: "Mood fluctuations tend to be most intense during perimenopause, particularly in the 1-2 years before your final period.", postmenopause: "Most women find mood stabilizes in postmenopause as hormones settle.", surgical: "Mood changes after surgical menopause can be intense. HT may help significantly." },
    whenToSeeDoc: "If irritability is affecting your relationships or quality of life, talk to your provider. Both HT and certain antidepressants (SSRIs/SNRIs) can help."
  },
  "depression": {
    prevalence: "Women are 2-4 times more likely to experience depression during the menopause transition compared to premenopause.",
    science: "Estrogen modulates serotonin receptors and production. The hormonal instability of perimenopause can trigger depressive episodes even in women with no prior history. This is not 'just hormones'. It's a real neurochemical change.",
    strategies: ["Exercise has strong evidence for treating mild-moderate depression. Aim for 150 minutes/week of moderate activity.", "Social connection is protective. Isolation worsens depression. Lean into your support network.", "Sunlight exposure (especially morning light) helps regulate mood-related neurotransmitters.", "CBT and mindfulness-based therapies have strong evidence for menopause-related mood changes."],
    stages: { perimenopause: "Depression risk peaks during the menopause transition, particularly in late perimenopause.", postmenopause: "Depression risk typically decreases in later postmenopause.", surgical: "Risk of depression is elevated after surgical menopause. Proactive treatment planning is important." },
    whenToSeeDoc: "Please reach out to your healthcare provider. Depression during menopause is highly treatable with therapy, medication, or HT. You don't have to push through this alone."
  },
  "palpitation": {
    prevalence: "Heart palpitations affect about 25-40% of menopausal women and are usually harmless, though they can be alarming.",
    science: "Estrogen helps regulate heart rhythm. As levels fluctuate, you may notice your heart racing, skipping beats, or pounding. Often during or after a hot flash.",
    strategies: ["Deep breathing during an episode can help slow your heart rate.", "Reducing caffeine and alcohol can decrease palpitation frequency.", "Regular exercise strengthens your cardiovascular system and can reduce episodes.", "Staying hydrated is important. Dehydration can trigger palpitations."],
    stages: { perimenopause: "Palpitations tend to be most common during perimenopause when hormones fluctuate most.", postmenopause: "They typically decrease as hormone levels stabilize.", surgical: "Palpitations may be more frequent immediately after surgical menopause." },
    whenToSeeDoc: "While menopause-related palpitations are usually benign, any new palpitations should be evaluated by your provider to rule out cardiac causes."
  },
  "headache": {
    prevalence: "About 30-40% of menopausal women experience increased headaches or migraines.",
    science: "Estrogen withdrawal can trigger headaches and migraines. Women who had menstrual migraines are particularly susceptible during perimenopause.",
    strategies: ["Staying hydrated. Dehydration is a common and easily fixable headache trigger.", "Regular sleep schedule helps prevent hormone-related headaches.", "Magnesium supplementation (400mg/day) has evidence for migraine prevention.", "Identify your personal triggers through tracking. That's exactly what you're doing here."],
    stages: { perimenopause: "Headaches often worsen during perimenopause due to fluctuating estrogen.", postmenopause: "Many women. Especially migraine sufferers. Find significant improvement in postmenopause.", surgical: "Headache patterns can change after surgical menopause and may respond well to stable HT." },
    whenToSeeDoc: "If headaches are new, changing in pattern, or not responding to over-the-counter treatment, see your provider."
  },
  "weight change": {
    prevalence: "Women gain an average of 5-8 pounds during the menopause transition, with a shift toward abdominal fat storage.",
    science: "Declining estrogen changes how your body stores fat (more abdominally), reduces metabolic rate by about 50 calories/day, and can increase appetite through hormonal signals.",
    strategies: ["Strength training is especially important. It counteracts the muscle loss that slows metabolism.", "Protein intake (20-30g per meal) helps maintain muscle mass and promotes satiety.", "Focus on body composition rather than scale weight. Muscle weighs more than fat.", "A Mediterranean-style eating pattern has the best evidence for midlife weight management."],
    stages: { perimenopause: "Weight shifts often begin in perimenopause as metabolic changes take effect.", postmenopause: "Metabolic rate continues to decrease, making strength training increasingly important.", surgical: "Rapid hormone changes can accelerate metabolic shifts. Early intervention with exercise helps." },
    whenToSeeDoc: "If you're experiencing rapid or unexplained weight changes, check thyroid function and discuss metabolic health with your provider."
  },
  "low libido": {
    prevalence: "Up to 52% of women report decreased sexual desire during menopause. It's one of the most common but least discussed symptoms.",
    science: "Both estrogen and testosterone decline during menopause, affecting desire, arousal, and physical comfort. Vaginal dryness, fatigue, mood changes, and body image can also contribute.",
    strategies: ["Vaginal moisturizers (used regularly) and lubricants (during intimacy) can address physical discomfort.", "Open communication with your partner about changes reduces pressure and improves connection.", "Regular physical activity boosts body confidence and increases blood flow.", "Pelvic floor exercises can improve sexual function and sensation."],
    stages: { perimenopause: "Desire may fluctuate unpredictably along with hormones.", postmenopause: "Low estrogen and testosterone can reduce desire, but many women find satisfying solutions.", surgical: "Libido changes can be more abrupt after surgical menopause." },
    whenToSeeDoc: "If this is bothering you, discuss with your provider. Local estrogen therapy is very effective and safe for vaginal symptoms, and testosterone therapy may help with desire."
  },
  "vaginal dryness": {
    prevalence: "Up to 50% of postmenopausal women experience vaginal dryness, though many don't report it to their doctor.",
    science: "Estrogen maintains vaginal tissue elasticity, moisture, and pH. As estrogen declines, tissues can become thinner, drier, and more susceptible to irritation and infection.",
    strategies: ["Regular use of vaginal moisturizers (not just lubricants) helps maintain tissue health.", "Sexual activity (including solo) helps maintain blood flow and tissue elasticity.", "Avoid irritating products. Scented soaps, douches, and some laundry detergents.", "Stay well hydrated. It helps all mucous membranes."],
    stages: { perimenopause: "Vaginal changes often begin in late perimenopause.", postmenopause: "Unlike hot flashes, vaginal symptoms typically don't improve on their own and may worsen without treatment.", surgical: "Changes can be more rapid after surgical menopause." },
    whenToSeeDoc: "Local vaginal estrogen therapy is considered safe and highly effective. Even for women who can't take systemic HT. Ask your provider about it."
  },
  "bloating": {
    prevalence: "Bloating and digestive changes are reported by about 40% of menopausal women.",
    science: "Estrogen and progesterone influence gut motility, water retention, and the gut microbiome. Fluctuating hormones can cause bloating, gas, and changes in bowel habits.",
    strategies: ["Eat smaller, more frequent meals rather than large ones.", "Probiotics and fermented foods may help support your changing gut microbiome.", "Stay hydrated and increase fiber gradually. Too much too fast worsens bloating.", "Regular physical activity helps maintain healthy gut motility."],
    stages: { perimenopause: "Bloating often fluctuates with hormonal cycles during perimenopause.", postmenopause: "Digestive symptoms usually stabilize in postmenopause.", surgical: "Digestive changes can occur as the body adjusts to new hormone levels." },
    whenToSeeDoc: "If bloating is persistent, severe, or accompanied by significant changes in bowel habits, see your provider to rule out other causes."
  }
};

// Lookup with fuzzy matching
export function getSymptomKnowledge(symptomName) {
  const lower = symptomName.toLowerCase();
  // Direct match
  if (SYMPTOM_KNOWLEDGE[lower]) return SYMPTOM_KNOWLEDGE[lower];
  // Fuzzy match
  for (const [key, val] of Object.entries(SYMPTOM_KNOWLEDGE)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  // Alias matching
  const aliases = {
    "mood shift": "irritability", "mood swing": "irritability", "insomnia": "poor sleep",
    "memory lapse": "brain fog", "difficulty concentrating": "brain fog", "word-finding": "brain fog",
    "low motivation": "depression", "panic attack": "anxiety", "migraine": "headache",
    "muscle ache": "joint pain", "back pain": "joint pain", "hair thinning": "weight change",
    "dry skin": "weight change", "breast tenderness": "weight change", "weight gain": "weight change",
    "urinary urgency": "vaginal dryness", "incontinence": "vaginal dryness",
    "vaginal irritation": "vaginal dryness", "nausea": "bloating", "acid reflux": "bloating",
    "digestive change": "bloating", "heart palpitation": "palpitation",
    "restless leg": "poor sleep", "tinnitus": null, "tingling": null, "numbness": null,
    "chills": "hot flash", "dry mouth": null, "dry eye": null, "crawling skin": null,
    "shortness of breath": null, "gum problem": null
  };
  for (const [alias, target] of Object.entries(aliases)) {
    if (lower.includes(alias) && target) return SYMPTOM_KNOWLEDGE[target];
  }
  return null;
}

export const TRIGGER_KNOWLEDGE = {
  caffeine: {
    science: "Caffeine is a central nervous system stimulant that can trigger hot flashes by dilating blood vessels. It also blocks adenosine (a sleep-promoting neurotransmitter), worsening sleep issues. Sensitivity to caffeine often increases during menopause.",
    tip: "Try reducing gradually rather than quitting cold turkey. Switching to half-caf or cutting off caffeine by noon may be enough.",
    nuance: "Some studies show caffeine doesn't significantly worsen menopause symptoms for everyone. Your personal data is your best guide."
  },
  alcohol: {
    science: "Alcohol dilates blood vessels (triggering hot flashes), disrupts sleep architecture (you fall asleep faster but sleep quality is worse), and can worsen anxiety and mood instability. Even moderate intake can amplify symptoms.",
    tip: "If you enjoy alcohol, try tracking which types and amounts affect you most. Red wine tends to be more triggering for hot flashes than other types.",
    nuance: "The relationship is dose-dependent. One glass occasionally may be fine, while regular consumption may noticeably worsen symptoms."
  },
  exercise: {
    science: "Regular exercise is one of the strongest evidence-based strategies for managing menopause symptoms. It improves mood (via endorphins), strengthens bones, improves sleep, and helps manage weight. Its direct effect on hot flash frequency is debated, but it significantly improves overall quality of life. The evidence supports 150 minutes/week of moderate aerobic activity plus 2 sessions of strength training.",
    tip: "Consistency matters more than intensity. If you're not exercising regularly, even 10-minute walks are a great starting point.",
    nuance: "Intense exercise close to bedtime can temporarily worsen hot flashes and disrupt sleep. Morning or afternoon sessions tend to be better."
  },
  stress: {
    science: "Stress activates the HPA axis (your stress response system), which interacts with the same brain regions affected by declining estrogen. This can amplify hot flashes, worsen anxiety, disrupt sleep, and increase pain sensitivity. Stress is often the most impactful trigger.",
    tip: "Stress management has some of the strongest evidence for symptom relief: meditation, yoga, CBT, and even regular social connection all help.",
    nuance: "You can't eliminate stress, but your response to it can be modified. Women who practice mindfulness report fewer and less bothersome symptoms."
  },
  sleep: {
    science: "Sleep is a multiplier. Poor sleep worsens nearly every other menopause symptom. It increases pain sensitivity, lowers mood, reduces cognitive function, and even makes hot flashes feel more intense. Prioritizing sleep quality is one of the highest-impact things you can do.",
    tip: "Sleep hygiene matters more during menopause: consistent schedule, cool room, no screens before bed, limit caffeine after noon.",
    nuance: "If you're doing everything right and still sleeping poorly, discuss with your provider. Sleep apnea risk increases after menopause and is often undiagnosed in women."
  }
};

// Stage-specific context generator
export function getStageContext(stage, symptom) {
  const knowledge = getSymptomKnowledge(symptom);
  if (!knowledge || !knowledge.stages) return "";
  const stageKey = stage?.toLowerCase().includes("peri") ? "perimenopause" : stage?.toLowerCase().includes("post") ? "postmenopause" : stage?.toLowerCase().includes("surgical") ? "surgical" : null;
  if (!stageKey || !knowledge.stages[stageKey]) return "";
  return `\n\n📋 ${knowledge.stages[stageKey]}`;
}

export function matchQuestion(input) {
  const lower = input.toLowerCase().trim();

  // ─── Follow-up detection ───
  if (/^(tell me more|more detail|explain|go on|what else|why|elaborate|and\?|more)$/i.test(lower) || /^(what about|how about) (that|this|it)/.test(lower)) {
    if (_lastHandler) return { handler: _lastHandler, param: _lastParam, followUp: true };
  }
  if (/^(compared to|vs|versus) last (month|week)/.test(lower) && _lastHandler) {
    return { handler: _lastHandler, param: _lastParam, timeRange: "month" };
  }

  // ─── Time range detection ───
  let timeRange = null;
  if (/this month|past month|last 30|30 days/.test(lower)) timeRange = "month";
  else if (/last month|previous month/.test(lower)) timeRange = "lastMonth";
  else if (/last week|past week/.test(lower)) timeRange = "week";

  // ─── Compound: "What triggers my [symptom]?" ───
  const triggerForSymptom = lower.match(/(?:trigger|cause|worsen|affect|impact|making).{0,20}(?:my |the )?([\w\s]+?)(?:\?|$)/);
  if (triggerForSymptom) {
    const possibleSymptom = triggerForSymptom[1].trim();
    const matched = AI_SYMPTOM_NAMES.find((s) => possibleSymptom.includes(s) || s.includes(possibleSymptom));
    if (matched && /trigger|cause|worsen|making/.test(lower)) {
      _lastHandler = "symptomTriggers";
      _lastParam = matched;
      return { handler: "symptomTriggers", param: matched, timeRange };
    }
  }

  // ─── Compound: "How does [trigger] affect my [symptom]?" ───
  let foundTrigger = null, foundSymptom = null;
  for (const t of AI_TRIGGER_NAMES) { if (lower.includes(t)) { foundTrigger = t; break; } }
  for (const s of AI_SYMPTOM_NAMES) { if (lower.includes(s)) { foundSymptom = s; break; } }
  if (foundTrigger && foundSymptom) {
    _lastHandler = "triggerSymptom";
    _lastParam = { trigger: foundTrigger, symptom: foundSymptom };
    return { handler: "triggerSymptom", param: { trigger: foundTrigger, symptom: foundSymptom }, timeRange };
  }

  // ─── Single symptom ───
  if (foundSymptom) {
    _lastHandler = "symptomTrend";
    _lastParam = foundSymptom;
    return { handler: "symptomTrend", param: foundSymptom, timeRange };
  }

  // ─── Single trigger ───
  if (foundTrigger) {
    _lastHandler = "triggerImpact";
    _lastParam = foundTrigger;
    return { handler: "triggerImpact", param: foundTrigger, timeRange };
  }

  // ─── Intent patterns ───
  if (/trigger|worst|cause|why|making.*worse|what.*causing/.test(lower)) {
    _lastHandler = "triggers";
    return { handler: "triggers", timeRange };
  }
  if (/better|worse|improv|progress|trend|getting|trajectory/.test(lower)) {
    _lastHandler = "trend";
    return { handler: "trend", timeRange };
  }
  if (/doctor|appointment|visit|tell.*doc|prepare|bring to/.test(lower)) {
    _lastHandler = "doctor";
    return { handler: "doctor" };
  }
  if (/best.*day|worst.*day|day.*week|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(lower)) {
    _lastHandler = "bestWorstDays";
    return { handler: "bestWorstDays" };
  }
  if (/mood|how.*feel|emotion|happy|sad/.test(lower)) {
    _lastHandler = "mood";
    return { handler: "mood", timeRange };
  }
  if (/energy|tired|exhaust|depleted/.test(lower)) {
    _lastHandler = "energy";
    return { handler: "energy", timeRange };
  }
  if (/week|how.*doing|overview|summary|recap/.test(lower)) {
    _lastHandler = "recent";
    return { handler: "recent", timeRange };
  }
  if (/pattern|notice|see|insight|find|connection|correlat/.test(lower)) {
    _lastHandler = "patterns";
    return { handler: "patterns" };
  }
  if (/help|what can|what do you|how do you work|capable/.test(lower)) {
    return { handler: "help" };
  }
  if (/thank|thanks|great|awesome|helpful/.test(lower)) {
    return { handler: "thanks" };
  }

  // ─── Smarter fallback ───
  _lastHandler = "recent";
  return { handler: "recent", timeRange };
}

export function generateResponse(handler, logs, profile) {
  const p = getPersonalization(profile);
  const stage = profile ? getJourneyLabel(profile[0]) : null;
  const concern = p?.topConcernNames?.[0];
  const stageNote = stage ? ` During ${stage.toLowerCase()}, this is quite common.` : "";
  const energyLogs = logs.filter((l) => l.energy !== null && l.energy !== undefined);
  const avgEnergy = energyLogs.length > 0 ? Math.round(energyLogs.slice(0, 14).reduce((s, l) => s + l.energy, 0) / Math.min(energyLogs.length, 14) * 10) / 10 : null;
  const energyNote = avgEnergy !== null ? (avgEnergy <= 1 ? " I also notice your energy has been quite low. That's worth mentioning to your provider." : avgEnergy >= 3 ? " Your energy levels have been looking good, which is a positive sign." : "") : "";

  // Helper: suggest a relevant follow-up question
  const suggestFollowUp = (handler, param) => {
    const followUps = {
      symptomTrend: [`What triggers my ${param}?`, "Am I getting better or worse?", "What should I tell my doctor?"],
      triggerImpact: ["What are my worst triggers?", "Am I getting better or worse?", `How does ${param} affect my mood?`],
      triggers: ["Which day of the week is best for me?", "Am I getting better or worse?", "What should I tell my doctor?"],
      trend: ["What are my worst triggers?", "What patterns do you see?", "What should I tell my doctor?"],
      doctor: ["Am I getting better or worse?", "What patterns do you see?"],
      bestWorstDays: ["What are my worst triggers?", "How am I doing this week?"],
      patterns: ["Am I getting better or worse?", "What should I tell my doctor?"],
      mood: ["What are my worst triggers?", "Am I getting better or worse?"],
      energy: ["How is my sleep affecting me?", "Am I getting better or worse?"],
      recent: ["What patterns do you see?", "Am I getting better or worse?", "What should I tell my doctor?"],
      symptomTriggers: ["Am I getting better or worse?", "What should I tell my doctor?"],
      triggerSymptom: [`How is my ${param?.symptom || "symptom"} trending?`, "What are my worst triggers?"],
    };
    const options = followUps[handler] || followUps.recent;
    return `\n\n💬 Try asking: "${options[Math.floor(Math.random() * options.length)]}"`;
  };

  // ─── NEW: Help handler ───
  if (handler.handler === "help") {
    return `I analyze your logged data to help you understand your patterns. Here's what I can help with:\n\n• Ask about any symptom. "How are my hot flashes?"\n• Trigger analysis. "How does caffeine affect me?"\n• Compound questions. "What triggers my brain fog?"\n• Trends. "Am I getting better or worse?"\n• Day analysis. "Which day is best for me?"\n• Doctor prep. "What should I tell my doctor?"\n• Weekly recap. "How am I doing this week?"\n\nThe more you log, the smarter my answers get!`;
  }

  // ─── NEW: Thanks handler ───
  if (handler.handler === "thanks") {
    const responses = ["You're welcome! I'm here whenever you need me. 💚", "Glad I could help! Remember, every log you make helps me give you better insights.", "Anytime! Your consistency in tracking is what makes these insights possible.", "Happy to help! Let me know if you want to dig deeper into anything."];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ─── NEW: Compound — "What triggers my [symptom]?" ───
  if (handler.handler === "symptomTriggers") {
    const symptom = handler.param;
    const triggers = ["caffeine", "alcohol", "exercise", "poor sleep", "stress"];
    const results = [];
    triggers.forEach((t) => {
      const data = analyzeTriggerImpact(logs, t);
      if (data.daysWithTrigger < 2) return;
      // Check if this specific symptom appears more with this trigger
      const withT = logs.filter((l) => {
        const ctx = l.context || {};
        const lower = t.toLowerCase();
        if (lower === "caffeine" || lower === "alcohol" || lower === "smoking") return ctx.triggers && ctx.triggers[lower];
        if (lower === "exercise") return ctx.triggers?.exercise;
        if (lower === "poor sleep" || lower === "sleep") return ctx.sleep === "poor" || ctx.sleep === "terrible";
        if (lower === "stress") return ctx.stress === "high" || ctx.stress === "extreme";
        return false;
      });
      const withoutT = logs.filter((l) => !withT.includes(l));
      const rateWith = withT.length > 0 ? withT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withT.length : 0;
      const rateWithout = withoutT.length > 0 ? withoutT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withoutT.length : 0;
      if (rateWith > 0 || rateWithout > 0) results.push({ trigger: t, rateWith: Math.round(rateWith * 100), rateWithout: Math.round(rateWithout * 100), delta: rateWith - rateWithout });
    });

    if (results.length === 0) return `I need more trigger data to tell you what affects your ${symptom}. Keep logging your daily context (caffeine, sleep, stress, etc.) and I'll connect the dots!` + suggestFollowUp("symptomTriggers", symptom);

    const worseners = results.filter((r) => r.delta > 0.1).sort((a, b) => b.delta - a.delta);
    const helpers = results.filter((r) => r.delta < -0.1).sort((a, b) => a.delta - b.delta);
    let msg = `Here's what I found about your ${symptom}:\n\n`;
    if (worseners.length > 0) msg += `Possible triggers:\n${worseners.map((w) => `• ${w.trigger}: ${symptom} appears ${w.rateWith}% of the time (vs ${w.rateWithout}% without)`).join("\n")}\n\n`;
    if (helpers.length > 0) msg += `May help:\n${helpers.map((h) => `• ${h.trigger}: ${symptom} drops to ${h.rateWith}% (vs ${h.rateWithout}% without)`).join("\n")}\n\n`;
    if (worseners.length === 0 && helpers.length === 0) msg += `No strong trigger connections found yet. Your ${symptom} appears fairly consistently regardless of triggers.\n\n`;
    // Add research-backed context for this symptom
    const sKnowledge = getSymptomKnowledge(symptom);
    if (sKnowledge) {
      msg += `\n📚 ${sKnowledge.science}`;
      const strategy = sKnowledge.strategies[Math.floor(Math.random() * sKnowledge.strategies.length)];
      msg += `\n\n💡 Evidence-based tip: ${strategy}`;
    }
    const stageCtx = getStageContext(stage, symptom);
    if (stageCtx) msg += stageCtx;
    return msg + suggestFollowUp("symptomTriggers", symptom);
  }

  // ─── NEW: Compound — "How does [trigger] affect my [symptom]?" ───
  if (handler.handler === "triggerSymptom") {
    const { trigger, symptom } = handler.param;
    const withT = logs.filter((l) => {
      const ctx = l.context || {};
      const lower = trigger.toLowerCase();
      if (lower === "caffeine" || lower === "alcohol" || lower === "smoking") return ctx.triggers && ctx.triggers[lower];
      if (lower === "exercise") return ctx.triggers?.exercise;
      if (lower === "poor sleep" || lower === "sleep") return ctx.sleep === "poor" || ctx.sleep === "terrible";
      if (lower === "stress") return ctx.stress === "high" || ctx.stress === "extreme";
      return false;
    });
    const withoutT = logs.filter((l) => !withT.includes(l));
    if (withT.length < 2) return `I need more days with ${trigger} logged to analyze its effect on ${symptom}. Keep tracking!`;
    const rateWith = withT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withT.length;
    const rateWithout = withoutT.length > 0 ? withoutT.filter((l) => Object.keys(l.symptoms || {}).some((s) => s.toLowerCase().includes(symptom))).length / withoutT.length : 0;
    const pctWith = Math.round(rateWith * 100);
    const pctWithout = Math.round(rateWithout * 100);
    if (pctWith > pctWithout + 10) return `There may be a connection: ${symptom} appears ${pctWith}% of the time on ${trigger} days, vs ${pctWithout}% on non-${trigger} days. That's a ${pctWith - pctWithout} percentage point difference.${stageNote} Worth discussing with your provider.` + suggestFollowUp("triggerSymptom", handler.param);
    if (pctWith < pctWithout - 10) return `Interesting. ${symptom} actually appears less on ${trigger} days (${pctWith}% vs ${pctWithout}%). ${trigger} might be helping with this one!` + suggestFollowUp("triggerSymptom", handler.param);
    return `${trigger} doesn't seem to have a strong effect on your ${symptom} specifically. It appears about ${pctWith}% of the time either way. Other factors might be more relevant.` + suggestFollowUp("triggerSymptom", handler.param);
  }

  // ─── NEW: Mood-specific handler ───
  if (handler.handler === "mood") {
    const data = analyzeOverallTrend(logs);
    if (data.recentDays < 3) return "I need a few more days of mood data to give you a reliable picture. Keep logging!";
    const recentMoods = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 14 && l.mood !== null && l.mood !== undefined);
    const moodLabels = ["😔 rough", "😕 low", "😐 okay", "🙂 good", "😊 great"];
    const moodDist = [0, 0, 0, 0, 0];
    recentMoods.forEach((l) => { if (l.mood >= 0 && l.mood <= 4) moodDist[l.mood]++; });
    const mostCommon = moodDist.indexOf(Math.max(...moodDist));
    let msg = `Your mood over the last 2 weeks:\n\n`;
    msg += `Average: ${data.recentMood}/4 ${moodLabels[Math.round(data.recentMood)] || ""}\n`;
    msg += `Most common mood: ${moodLabels[mostCommon]} (${moodDist[mostCommon]}/${recentMoods.length} days)\n`;
    if (data.prevDays >= 3) {
      const delta = data.recentMood - data.prevMood;
      msg += `Trend: ${Math.abs(delta) > 0.3 ? (delta > 0 ? "📈 Improving" : "📉 Dipping") : "➡️ Steady"} (was ${data.prevMood} → now ${data.recentMood})\n`;
    }
    if (avgEnergy !== null) msg += `Energy correlation: ${avgEnergy >= 2.5 ? "your energy and mood are both in a decent place" : "your energy has been low, which often pulls mood down too"}.\n`;
    // Research-backed mood context
    const moodKnowledge = data.recentMood < 2 ?
      `\n📚 Estrogen helps regulate serotonin. Your brain's "feel good" neurotransmitter. As estrogen fluctuates, mood dips are a physiological response, not a character flaw. Research shows mood changes are most intense during the transition and typically improve afterward.` :
      `\n📚 Research shows that mood during menopause is influenced by hormonal changes, sleep quality, stress, and social support. The fact that you're tracking is itself a positive step. Self-awareness is linked to better emotional regulation.`;
    msg += moodKnowledge;
    if (data.recentMood < 1.5) msg += `\n\n💡 If your mood has been consistently low, please consider talking to your healthcare provider. Depression during menopause is very common and highly treatable.`;
    else msg += `\n\n💡 Regular exercise (even 20 minutes) has evidence as strong as medication for mild-moderate mood changes during menopause.`;
    return msg + suggestFollowUp("mood");
  }

  // ─── NEW: Energy-specific handler ───
  if (handler.handler === "energy") {
    const recentE = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 14 && l.energy !== null && l.energy !== undefined);
    if (recentE.length < 3) return "I need a few more days of energy data. Make sure you're logging your energy level each day!";
    const avg = Math.round(recentE.reduce((s, l) => s + l.energy, 0) / recentE.length * 10) / 10;
    const labels = ["Depleted", "Low", "Moderate", "Good", "Energized"];
    const prevE = logs.filter((l) => { const d = (new Date() - new Date(l.date)) / 86400000; return d > 14 && d <= 28 && l.energy !== null && l.energy !== undefined; });
    const prevAvg = prevE.length > 0 ? Math.round(prevE.reduce((s, l) => s + l.energy, 0) / prevE.length * 10) / 10 : null;
    let msg = `Your energy over the last 2 weeks:\n\nAverage: ${avg}/4 (${labels[Math.round(avg)] || "Moderate"})\n`;
    if (prevAvg !== null) {
      const delta = avg - prevAvg;
      msg += `Trend: ${Math.abs(delta) > 0.3 ? (delta > 0 ? "⬆️ Improving" : "⬇️ Declining") : "➡️ Steady"} (was ${prevAvg} → now ${avg})\n`;
    }
    // Check sleep correlation
    const poorSleepDays = recentE.filter((l) => l.context?.sleep === "poor" || l.context?.sleep === "terrible");
    const goodSleepDays = recentE.filter((l) => l.context?.sleep === "good" || l.context?.sleep === "great");
    if (poorSleepDays.length >= 2 && goodSleepDays.length >= 2) {
      const poorE = poorSleepDays.reduce((s, l) => s + l.energy, 0) / poorSleepDays.length;
      const goodE = goodSleepDays.reduce((s, l) => s + l.energy, 0) / goodSleepDays.length;
      if (goodE - poorE > 0.5) msg += `\n💡 Your data confirms it: energy averages ${labels[Math.round(goodE)] || "higher"} after good sleep vs ${labels[Math.round(poorE)] || "lower"} after poor sleep.`;
    }
    // Research-backed energy context
    msg += `\n\n📚 Menopause-related fatigue is multifactorial: disrupted sleep, hormonal shifts affecting energy metabolism, and the cumulative toll of other symptoms. Up to 85% of menopausal women report it.`;
    if (avg <= 1.5) msg += `\n\n💡 Your energy has been quite low. Checking iron, B12, thyroid, and vitamin D levels with your provider is a good idea. These are common, easily treatable contributors to fatigue in midlife women.`;
    else msg += `\n\n💡 Regular moderate exercise paradoxically increases energy. Consistent wake times. Even on weekends. Also help regulate your circadian rhythm.`;
    return msg + suggestFollowUp("energy");
  }

  if (handler.handler === "symptomTrend") {
    const data = analyzeSymptomTrend(logs, handler.param);
    const knowledge = getSymptomKnowledge(handler.param);
    if (data.recentCount === 0 && data.prevCount === 0) {
      let msg = `I haven't seen ${handler.param} in your recent logs. That's great!`;
      if (knowledge) msg += `\n\n📚 For context: ${knowledge.prevalence}`;
      return msg;
    }
    const trendWord = data.trend === "increasing" ? "more frequently" : data.trend === "decreasing" ? "less often. That's encouraging!" : "at about the same rate";
    let msg = `Looking at your ${handler.param} pattern: you've logged it ${data.recentCount} times in the last 2 weeks, compared to ${data.prevCount} the 2 weeks before. It's appearing ${trendWord}.`;
    // Severity info
    if (data.recentSev > 0 && data.prevSev > 0) {
      const sevDelta = data.recentSev - data.prevSev;
      if (Math.abs(sevDelta) > 0.5) msg += `\n\nSeverity: ${sevDelta > 0 ? "intensity has increased" : "intensity has decreased"} (${data.prevSev}/10 → ${data.recentSev}/10).`;
    } else if (data.recentSev > 0) {
      msg += ` Average severity: ${data.recentSev}/10.`;
    }
    // Research-backed context
    if (knowledge) {
      msg += `\n\n📚 ${knowledge.science}`;
      // Pick a relevant strategy based on trend
      const strategyIdx = data.trend === "increasing" ? 0 : Math.floor(Math.random() * knowledge.strategies.length);
      msg += `\n\n💡 What helps: ${knowledge.strategies[strategyIdx]}`;
      // Stage-specific insight
      const stageCtx = getStageContext(stage, handler.param);
      if (stageCtx) msg += stageCtx;
      // Severity-appropriate doctor nudge
      if (data.recentCount >= 7 || (data.recentSev > 0 && data.recentSev >= 7)) {
        msg += `\n\n⚕️ ${knowledge.whenToSeeDoc}`;
      }
    } else {
      msg += stageNote;
    }
    // Concern callout
    if (concern && handler.param.toLowerCase().includes(concern.toLowerCase().split(" ")[0])) {
      msg += `\n\n📌 This is one of the concerns you flagged during onboarding. I'm keeping a close eye on it.`;
    }
    return msg + suggestFollowUp("symptomTrend", handler.param);
  }

  if (handler.handler === "triggerImpact") {
    const data = analyzeTriggerImpact(logs, handler.param);
    const tKnowledge = TRIGGER_KNOWLEDGE[handler.param.toLowerCase()] || TRIGGER_KNOWLEDGE[handler.param.toLowerCase().replace("poor ", "")];
    if (data.daysWithTrigger === 0) {
      let msg = `I don't have enough data on ${handler.param} yet. Try logging it when it comes up, and I'll analyze the impact!`;
      if (tKnowledge) msg += `\n\n📚 What research says: ${tKnowledge.science}`;
      return msg;
    }
    let energyImpact = "";
    if (data.avgEnergyWith !== null && data.avgEnergyWithout !== null) {
      const eDelta = data.avgEnergyWith - data.avgEnergyWithout;
      if (Math.abs(eDelta) > 0.3) energyImpact = `\nEnergy: ${eDelta > 0 ? "higher" : "lower"} on ${handler.param} days (${data.avgEnergyWith} vs ${data.avgEnergyWithout}).`;
    }
    let msg = "";
    if (data.impact === "worsens") {
      msg = `Here's what your data shows: on days with ${handler.param}, you average ${data.avgSymptomsWith} symptoms compared to ${data.avgSymptomsWithout} without it. Your mood also tends to be ${data.avgMoodWith < data.avgMoodWithout ? "lower" : "about the same"} (${data.avgMoodWith} vs ${data.avgMoodWithout}).${energyImpact}`;
      if (tKnowledge) {
        msg += `\n\n📚 Why this happens: ${tKnowledge.science}`;
        msg += `\n\n💡 ${tKnowledge.tip}`;
      }
    } else if (data.impact === "helps") {
      msg = `Your data suggests ${handler.param} may be helping you! On those days, you average ${data.avgSymptomsWith} symptoms vs ${data.avgSymptomsWithout} without it, and your mood tends to be ${data.avgMoodWith > data.avgMoodWithout ? "better" : "similar"}.${energyImpact}`;
      if (tKnowledge) {
        msg += `\n\n📚 The science backs this up: ${tKnowledge.science}`;
        msg += `\n\n💡 ${tKnowledge.tip}`;
      }
    } else {
      msg = `${handler.param} doesn't show a strong correlation either way in your data. You average ${data.avgSymptomsWith} symptoms with it and ${data.avgSymptomsWithout} without.${energyImpact}`;
      if (tKnowledge) {
        msg += `\n\n📚 ${tKnowledge.nuance}`;
        msg += `\n\n💡 ${tKnowledge.tip}`;
      }
    }
    return msg + suggestFollowUp("triggerImpact", handler.param);
  }

  if (handler.handler === "triggers") {
    const triggers = ["caffeine", "alcohol", "exercise", "poor sleep", "stress"];
    const results = triggers.map((t) => analyzeTriggerImpact(logs, t)).filter((r) => r.daysWithTrigger >= 2);
    const worst = results.filter((r) => r.impact === "worsens").sort((a, b) => b.avgSymptomsWith - a.avgSymptomsWith);
    const best = results.filter((r) => r.impact === "helps");
    let msg = "";
    if (worst.length > 0) msg += `Based on your logs, these show a possible link to more symptoms: ${worst.map((w) => `${w.triggerName} (+${(w.avgSymptomsWith - w.avgSymptomsWithout).toFixed(1)} symptoms/day)`).join(", ")}. Note: individual patterns may differ from clinical evidence. Share these findings with your provider. `;
    if (best.length > 0) msg += `Your data also suggests ${best.map((b) => b.triggerName).join(" and ")} may be associated with fewer symptoms. `;
    if (msg === "") msg = "I need a bit more trigger data to give you a clear picture. Keep logging what you eat, drink, and do. I'll spot the connections!";
    // Add research context for the worst trigger
    if (worst.length > 0) {
      const topTrigger = worst[0].triggerName.toLowerCase().replace("poor ", "");
      const tK = TRIGGER_KNOWLEDGE[topTrigger];
      if (tK) msg += `\n\n📚 About ${worst[0].triggerName}: ${tK.science}\n\n💡 ${tK.tip}`;
    } else if (best.length > 0) {
      const topHelper = best[0].triggerName.toLowerCase().replace("poor ", "");
      const tK = TRIGGER_KNOWLEDGE[topHelper];
      if (tK) msg += `\n\n📚 About ${best[0].triggerName}: ${tK.science}`;
    }
    return msg + suggestFollowUp("triggers");
  }

  if (handler.handler === "trend") {
    const data = analyzeOverallTrend(logs);
    if (data.recentDays < 3) return concern ? `I need a few more days of ${concern} data to spot a reliable trend. Keep logging!` : "I need a few more days of data to spot a reliable trend. Keep logging!";
    const energyTrend = data.recentEnergy > 0 && data.prevEnergy > 0 ? (data.recentEnergy > data.prevEnergy ? " Your energy is also trending up!" : data.recentEnergy < data.prevEnergy ? " I notice your energy has dipped a bit too." : "") : "";
    if (data.direction === "improving") {
      let msg = `Great news. You're trending better! Your symptoms have decreased from an average of ${data.prevSymptoms}/day to ${data.recentSymptoms}/day, and your mood has ${data.recentMood > data.prevMood ? `improved from ${data.prevMood} to ${data.recentMood}` : "held steady"}.${energyTrend} Whatever you're doing, it's working!`;
      msg += `\n\n📚 Research shows that the menopause transition is not a steady decline. Many women experience periods of improvement. Consistent tracking helps you identify what's working so you can do more of it.`;
      return msg + suggestFollowUp("trend");
    }
    if (data.direction === "worse") {
      let msg = `I want to be honest with you: the last 2 weeks have been a bit tougher. Symptoms went from ${data.prevSymptoms}/day to ${data.recentSymptoms}/day${data.recentMood < data.prevMood ? `, and mood dipped from ${data.prevMood} to ${data.recentMood}` : ""}.${energyTrend}`;
      // Find their top symptom to give specific advice
      const recentLogs = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 14);
      const symCounts = {};
      recentLogs.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symCounts[s] = (symCounts[s] || 0) + 1; }));
      const topSym = Object.entries(symCounts).sort((a, b) => b[1] - a[1])[0];
      if (topSym) {
        const topKnowledge = getSymptomKnowledge(topSym[0]);
        if (topKnowledge) {
          msg += `\n\nYour most frequent symptom right now is ${topSym[0]} (${topSym[1]}x in 2 weeks). ${topKnowledge.prevalence}`;
          msg += `\n\n💡 ${topKnowledge.strategies[0]}`;
        }
      }
      msg += `\n\n📚 Symptom fluctuation is normal during the menopausal transition. Research shows symptoms naturally wax and wane. This isn't a setback, it's part of the process.${energyNote}`;
      if (data.recentSymptoms > 4) msg += ` If this pattern continues, consider bringing your Vela data to your healthcare provider. They can help.`;
      return msg + suggestFollowUp("trend");
    }
    let stableMsg = `Things are holding steady. ${data.recentSymptoms} symptoms/day on average, mood around ${data.recentMood}.${energyTrend}`;
    stableMsg += `\n\n📚 Stability is actually a positive sign. Research shows that many women reach a "new baseline" during menopause where symptoms become predictable and manageable. You may be finding yours.`;
    return stableMsg + suggestFollowUp("trend");
  }

  if (handler.handler === "doctor") {
    const data = generateDoctorSummary(logs, profile);
    let msg = "Here's what I'd suggest bringing to your doctor:\n\n";
    if (data.points.length > 0) msg += data.points.map((pt) => `• ${pt}`).join("\n") + "\n\n";
    if (data.correlations.length > 0) msg += `Key patterns: ${data.correlations.slice(0, 2).map((c) => c.text).join("; ")}\n\n`;
    if (data.trend) msg += `Overall trend: ${data.trend.direction} (${data.trend.recentSymptoms} symptoms/day recently vs ${data.trend.prevSymptoms} before)\n\n`;
    if (data.questions.length > 0) msg += "Questions to ask:\n" + data.questions.map((q) => `• ${q}`).join("\n");
    // Add evidence-based context for top symptom
    const recent30 = logs.filter((l) => (new Date() - new Date(l.date)) / 86400000 <= 30);
    const symC = {};
    recent30.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => { symC[s] = (symC[s] || 0) + 1; }));
    const topEntry = Object.entries(symC).sort((a, b) => b[1] - a[1])[0];
    if (topEntry) {
      const topK = getSymptomKnowledge(topEntry[0]);
      if (topK) msg += `\n\n📚 About your most frequent symptom (${topEntry[0]}): ${topK.whenToSeeDoc}`;
    }
    msg += "\n\n📋 Tip: Generate a full PDF report from the Doctor Prep section. Providers respond well to structured data.";
    return msg;
  }

  if (handler.handler === "bestWorstDays") {
    const data = analyzeBestWorstDays(logs);
    if (data.stats.length < 3) return "I need data from more days of the week to give you a reliable breakdown. Keep logging!";
    let msg = "";
    if (data.best) {
      msg += `Your best day tends to be ${data.best.day} (avg mood: ${data.best.avgMood}, avg symptoms: ${data.best.avgSymptoms}`;
      if (data.best.avgEnergy !== null) msg += `, energy: ${data.best.avgEnergy}`;
      msg += `). `;
    }
    if (data.worst && data.worst.day !== data.best?.day) {
      msg += `${data.worst.day}s tend to be tougher (avg mood: ${data.worst.avgMood}, avg symptoms: ${data.worst.avgSymptoms}`;
      if (data.worst.avgEnergy !== null) msg += `, energy: ${data.worst.avgEnergy}`;
      msg += `). `;
    }
    msg += `\n\n💡 Research on chronobiology suggests that aligning demanding tasks with your best days and scheduling recovery time on harder days can significantly improve quality of life. Your data gives you this advantage. Use it!`;
    if (data.best && data.worst && data.best.day !== data.worst?.day) {
      const moodGap = (data.best.avgMood || 0) - (data.worst.avgMood || 0);
      if (moodGap > 1) msg += `\n\n📊 The mood gap between your best and worst days is significant (${moodGap.toFixed(1)} points). Look at what's different about your ${data.worst.day} routine. Sleep the night before, schedule, stress levels.`;
    }
    return msg + suggestFollowUp("bestWorstDays");
  }

  if (handler.handler === "patterns") {
    const patterns = analyzePatterns(logs);
    const correlations = analyzeCorrelations(logs);
    if (patterns.length === 0 && correlations.length === 0) return "I haven't spotted strong patterns yet. The more consistently you log, the faster I can find connections. Even quick logs on good days help!";
    let msg = "Here's what I've noticed:\n\n";
    if (patterns.length > 0) msg += patterns.slice(0, 3).map((pt) => `• ${pt}`).join("\n");
    if (correlations.length > 0 && patterns.length < 3) {
      const extra = correlations.slice(0, 3 - patterns.length).filter((c) => !patterns.some((pt) => pt.includes(c.text)));
      if (extra.length > 0) msg += "\n" + extra.map((c) => `• ${c.icon} ${c.text}`).join("\n");
    }
    msg += `\n\nThese patterns are based on your personal data. Everyone's experience is unique.${stageNote}`;
    return msg + suggestFollowUp("patterns");
  }

  // recent / fallback
  const data = analyzeRecentPattern(logs);
  if (!data) return concern ? `I don't have any data from this week yet. Log how your ${concern} is today and I'll start building your picture!` : "I don't have any data from this week yet. Log how you're feeling today and I'll start building your picture!";
  let msg = `Here's your week so far (${data.daysLogged} days logged):\n\n`;
  if (data.avgMood !== null) msg += `Mood: ${data.avgMood}/4 average (${data.avgMood >= 3.5 ? "great" : data.avgMood >= 2.5 ? "good" : data.avgMood >= 1.5 ? "okay" : "tough"})\n`;
  if (data.avgEnergy !== null) msg += `Energy: ${["Depleted", "Low", "Moderate", "Good", "Energized"][Math.round(data.avgEnergy)] || "Moderate"} average\n`;
  if (data.topSymptoms.length > 0) {
    msg += `Top symptoms: ${data.topSymptoms.map((s) => `${s.name} (${s.count}x)`).join(", ")}\n`;
    if (concern && data.topSymptoms.some((s) => s.name.toLowerCase().includes(concern.toLowerCase()))) {
      msg += `\n📌 Your ${concern} appeared ${data.topSymptoms.find((s) => s.name.toLowerCase().includes(concern.toLowerCase())).count} times this week.\n`;
    }
  }
  if (data.topContext && data.topContext.length > 0) {
    const filtered = data.topContext.filter((t) => !t.name.startsWith("Stress:") && !t.name.startsWith("Sleep:"));
    if (filtered.length > 0) msg += `Context: ${filtered.map((t) => `${t.name} (${t.count}x)`).join(", ")}\n`;
  }
  if (data.bestDay) msg += `\nBest day: ${new Date(data.bestDay.date).toLocaleDateString("en-US", { weekday: "long" })} ${["😞","😕","😐","🙂","😊"][data.bestDay.mood] || ""}`;
  msg += stageNote + energyNote;
  return msg + suggestFollowUp("recent");
}
