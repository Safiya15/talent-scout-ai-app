import { Router, type IRouter } from "express";
import {
  ScoreCandidatesBody,
  GenerateMessageBody,
  SendToSheetsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const SHEETS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzHcIGi6-wQMJH3CKFSlZTTJE0AD2icjjqII2M4SV8VQPSJIVMOqIaBuWU8tKevaPSS/exec";

const SKILL_MATCHERS: Array<{ name: string; patterns: string[] }> = [
  { name: "React",      patterns: ["react"] },
  { name: "Python",     patterns: ["python"] },
  { name: "NodeJS",     patterns: ["nodejs", "node.js", "node js", "node,", "node "] },
  { name: "TypeScript", patterns: ["typescript", "ts,", "ts "] },
];

function scoreSkills(skills: string): number {
  const lower = skills.toLowerCase() + " ";
  const matched = SKILL_MATCHERS.filter(({ patterns }) =>
    patterns.some((p) => lower.includes(p))
  ).length;
  return Math.round((matched / SKILL_MATCHERS.length) * 100);
}

function scoreExperience(experience: string): number {
  const lower = experience.toLowerCase();
  // Match patterns like "4 years", "4+ years", "4yrs", "4+yrs", "4", "4+"
  const yearsMatch = lower.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:year|yr|y\b)/);
  const bareNumberMatch = lower.match(/^(\d+(?:\.\d+)?)\s*\+?$/);
  const rawYears = yearsMatch
    ? parseFloat(yearsMatch[1])
    : bareNumberMatch
    ? parseFloat(bareNumberMatch[1])
    : null;

  if (rawYears === null) {
    if (lower.includes("fresh") || lower.includes("entry") || lower.includes("intern")) return 25;
    return 25;
  }
  if (rawYears >= 5) return 100;
  if (rawYears >= 4) return 85;
  if (rawYears >= 3) return 75;
  if (rawYears >= 1) return 50;
  return 25;
}

function scoreEducation(education: string): number {
  const lower = education.toLowerCase();
  if (lower.includes("mtech") || lower.includes("m.tech") || lower.includes("m tech") || lower.includes("master")) return 100;
  if (lower.includes("btech") || lower.includes("b.tech") || lower.includes("b tech") || lower.includes("bachelor of technology") || lower.includes("be ") || lower.includes("b.e")) return 80;
  if (lower.includes("bsc") || lower.includes("b.sc") || lower.includes("b sc") || lower.includes("bachelor of science")) return 60;
  return 40;
}

function scoreLocation(location: string): number {
  const lower = location.toLowerCase();
  if (lower.includes("ahmedabad") || lower.includes("bangalore") || lower.includes("bengaluru")) return 100;
  const indiaKeywords = ["mumbai", "delhi", "pune", "hyderabad", "chennai", "kolkata", "india", "noida", "gurgaon", "gurugram", "surat", "jaipur", "lucknow"];
  if (indiaKeywords.some((kw) => lower.includes(kw))) return 70;
  return 40;
}

function determineStatus(score: number): "QUALIFIED" | "REVIEW" | "REJECTED" {
  if (score >= 70) return "QUALIFIED";
  if (score >= 40) return "REVIEW";
  return "REJECTED";
}

router.post("/score", async (req, res) => {
  const parsed = ScoreCandidatesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  const { candidates } = parsed.data;

  const scored = candidates.map((c) => {
    const skillsScore = scoreSkills(c.skills);
    const experienceScore = scoreExperience(c.experience);
    const educationScore = scoreEducation(c.education);
    const locationScore = scoreLocation(c.location);

    const totalScore = Math.round(
      skillsScore * 0.4 +
      experienceScore * 0.3 +
      educationScore * 0.2 +
      locationScore * 0.1
    );

    const status = determineStatus(totalScore);

    return {
      name: c.name,
      skills: c.skills,
      experience: c.experience,
      education: c.education,
      location: c.location,
      currentCompany: c.currentCompany,
      score: totalScore,
      status,
      skillsScore,
      experienceScore,
      educationScore,
      locationScore,
      message: null,
    };
  });

  const qualified = scored.filter((c) => c.status === "QUALIFIED").length;
  const review = scored.filter((c) => c.status === "REVIEW").length;
  const rejected = scored.filter((c) => c.status === "REJECTED").length;

  res.json({
    candidates: scored,
    stats: {
      total: scored.length,
      qualified,
      review,
      rejected,
      timeSavedMinutes: scored.length * 15,
    },
  });
});

router.post("/generate-message", async (req, res) => {
  const parsed = GenerateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  if (!GROQ_API_KEY) {
    res.status(500).json({ error: "GROQ_API_KEY environment secret is not set." });
    return;
  }

  const { name, skills, experience, currentCompany } = parsed.data;

  const prompt = `Write a concise, personalized LinkedIn outreach message for a technical recruiting context. The tone should be warm and genuine — not spammy or generic. Keep it under 130 words.

Candidate:
- Name: ${name}
- Current Company: ${currentCompany}
- Skills: ${skills}
- Experience: ${experience}

Requirements:
- Open with a specific compliment tied to their skills or experience (not a generic opener)
- Briefly mention why they caught our attention
- Include one clear call-to-action (e.g. open to a quick chat?)
- Sign off as "RecruitAI Team"

Return only the message text, no subject line, no extra commentary.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null) as { error?: { message?: string; type?: string } } | null;
      const errMessage = errJson?.error?.message ?? "Unknown Groq API error";
      console.error("Groq API error:", JSON.stringify(errJson, null, 2));
      const status = response.status === 429 ? 429 : 500;
      res.status(status).json({ error: errMessage });
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const message = data?.choices?.[0]?.message?.content?.trim() ?? "Could not generate message.";
    res.json({ message });
  } catch (err) {
    console.error("Error calling Groq:", err);
    res.status(500).json({ error: "Failed to generate message" });
  }
});

router.post("/send-to-sheets", async (req, res) => {
  const parsed = SendToSheetsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  const { name, score, skills, status, message } = parsed.data;

  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score, skills, status, message: message ?? "" }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sheets webhook error:", errText);
      res.json({ success: false, message: `Webhook returned ${response.status}` });
      return;
    }

    res.json({ success: true, message: "Successfully sent to Google Sheets" });
  } catch (err) {
    console.error("Error sending to Sheets:", err);
    res.json({ success: false, message: "Failed to send to Google Sheets" });
  }
});

export default router;
