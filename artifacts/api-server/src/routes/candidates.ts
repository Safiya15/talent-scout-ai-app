import { Router, type IRouter } from "express";
import {
  ScoreCandidatesBody,
  GenerateMessageBody,
  SendToSheetsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
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

  if (!ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY environment secret is not set." });
    return;
  }

  const { name, skills, experience, currentCompany } = parsed.data;

  const prompt = `Write a short, personalized LinkedIn outreach message to a candidate for a technical role. Keep it professional, warm, and under 150 words.

Candidate details:
- Name: ${name}
- Current Company: ${currentCompany}
- Skills: ${skills}
- Experience: ${experience}

The message should mention their specific skills and experience, express genuine interest, and include a call to action to connect. Sign off as "RecruitAI Team".`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null) as { error?: { type?: string; message?: string } } | null;
      const errMessage = errJson?.error?.message ?? "Unknown Anthropic API error";
      console.error("Anthropic API error:", JSON.stringify(errJson, null, 2));
      const status = response.status === 429 ? 429 : 500;
      res.status(status).json({ error: errMessage });
      return;
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const message = data?.content?.find((b) => b.type === "text")?.text ?? "Could not generate message.";
    res.json({ message });
  } catch (err) {
    console.error("Error calling Anthropic:", err);
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
