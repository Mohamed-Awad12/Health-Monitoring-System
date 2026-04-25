const env = require("../config/env");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeTrend = (trend) => {
  if (trend === "increasing" || trend === "decreasing") {
    return trend;
  }

  return "stable";
};

const buildFallbackReport = ({ spo2, bpm, trend }) => {
  const safeSpo2 = clamp(Number(spo2), 50, 100);
  const safeBpm = clamp(Number(bpm), 20, 220);
  const safeTrend = normalizeTrend(trend);
  const concerns = [];
  const advice = [];

  let condition =
    "Current readings show mild variation from a typical resting range, so close monitoring is recommended.";

  if (safeSpo2 >= 95 && safeBpm >= 60 && safeBpm <= 100 && safeTrend !== "decreasing") {
    condition = "Current readings are generally stable for a resting check-in.";
  } else if (safeSpo2 < 90 || safeBpm > 120 || safeBpm < 50) {
    condition =
      "Current readings are outside common resting ranges and should be watched carefully.";
  }

  if (safeSpo2 <= 94) {
    concerns.push("Oxygen saturation is lower than the usual target range.");
  }

  if (safeBpm > 100) {
    concerns.push("Heart rate is elevated compared with a typical resting level.");
  } else if (safeBpm < 55) {
    concerns.push("Heart rate is lower than a common resting range.");
  }

  if (safeTrend === "decreasing") {
    concerns.push("Recent trend suggests oxygen levels are gradually going down.");
  }

  if (!concerns.length) {
    concerns.push("No immediate warning pattern is obvious from this single snapshot.");
  }

  advice.push("Rest for a few minutes and avoid physical effort before the next check.");
  advice.push("Make sure the sensor is placed correctly and your hand is warm and still.");
  advice.push("Repeat readings in 15 to 30 minutes and compare with your baseline values.");

  if (safeSpo2 <= 92 || safeTrend === "decreasing") {
    advice.push("If symptoms worsen or you feel unwell, contact a licensed clinician promptly.");
  }

  return {
    condition: { en: condition, ar: condition },
    concerns: { en: concerns, ar: concerns },
    advice: { en: advice, ar: advice },
    disclaimer: {
      en: "This assistant provides informational guidance only and is not a diagnosis or treatment plan.",
      ar: "هذا المساعد يقدم إرشادات معلوماتية فقط وليس تشخيصاً أو خطة علاج."
    }
  };
};

const parseAssistantResponse = (text) => {
  if (!text || typeof text !== "string") {
    return null;
  }

  const cleanedText = text.replace(/^```(json)?|```$/gmi, '').trim();

  try {
    const parsed = JSON.parse(cleanedText);

    const isBilingualString = (val) => typeof val?.en === "string" && typeof val?.ar === "string";
    const isBilingualArray = (val) => Array.isArray(val?.en) && Array.isArray(val?.ar);

    if (
      isBilingualString(parsed.condition) &&
      isBilingualArray(parsed.concerns) &&
      isBilingualArray(parsed.advice)
    ) {
      return {
        condition: { en: parsed.condition.en, ar: parsed.condition.ar },
        concerns: { 
          en: parsed.condition.en ? parsed.concerns.en.filter(i => typeof i === "string") : [],
          ar: parsed.condition.ar ? parsed.concerns.ar.filter(i => typeof i === "string") : []
        },
        advice: {
          en: parsed.advice.en ? parsed.advice.en.filter(i => typeof i === "string") : [],
          ar: parsed.advice.ar ? parsed.advice.ar.filter(i => typeof i === "string") : []
        },
        disclaimer: isBilingualString(parsed.disclaimer)
          ? { en: parsed.disclaimer.en, ar: parsed.disclaimer.ar }
          : {
              en: "This assistant provides informational guidance only and is not a diagnosis or treatment plan.",
              ar: "هذا المساعد يقدم إرشادات معلوماتية فقط وليس تشخيصاً أو خطة علاج.",
            },
      };
    } else if (
      typeof parsed.condition === "string" &&
      Array.isArray(parsed.concerns) &&
      Array.isArray(parsed.advice)
    ) {
      // Fallback for single language response
      return {
        condition: { en: parsed.condition, ar: parsed.condition },
        concerns: { en: parsed.concerns, ar: parsed.concerns },
        advice: { en: parsed.advice, ar: parsed.advice },
        disclaimer: { en: parsed.disclaimer || "Disclaimer", ar: parsed.disclaimer || "Disclaimer" }
      };
    }
  } catch (_error) {
    return null;
  }

  return null;
};

const requestModelReport = async ({ spo2, bpm, trend }) => {
  if (!env.AI_HEALTH_ASSISTANT_API_KEY) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.AI_HEALTH_ASSISTANT_TIMEOUT_MS
  );

  const systemPrompt =
    "You are a medical assistant AI. Provide concise informational guidance only. Do not diagnose, prescribe treatment, or give strict medical decisions. Keep advice safe and non-alarming. You must provide all responses in BOTH English and Arabic.";

  const userPrompt = [
    "Given:",
    `- SpO2: ${spo2}%`,
    `- Heart Rate: ${bpm} bpm`,
    `- Trend: ${trend} oxygen levels`,
    "",
    "Write a short report including:",
    "1. Current condition",
    "2. Possible concerns",
    "3. Simple advice (non-medical, safe)",
    "",
    "Return valid JSON ONLY with exactly the following structure (each key must contain an object with 'en' and 'ar' translations):",
    `{
  "condition": { "en": "string", "ar": "string" },
  "concerns": { "en": ["string", "string"], "ar": ["string", "string"] },
  "advice": { "en": ["string", "string"], "ar": ["string", "string"] },
  "disclaimer": { "en": "string", "ar": "string" }
}`
  ].join("\n");

  try {
    const isGemini = env.AI_HEALTH_ASSISTANT_BASE_URL.includes("generativelanguage.googleapis.com");
    let url, headers, bodyData;

    if (isGemini) {
      url = `${env.AI_HEALTH_ASSISTANT_BASE_URL.replace(/\/$/, "")}/models/${env.AI_HEALTH_ASSISTANT_MODEL}:generateContent`;
      headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": env.AI_HEALTH_ASSISTANT_API_KEY,
      };
      bodyData = {
        contents: [
          { parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      };
    } else {
      url = `${env.AI_HEALTH_ASSISTANT_BASE_URL.replace(/\/$/, "")}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_HEALTH_ASSISTANT_API_KEY}`,
      };
      bodyData = {
        model: env.AI_HEALTH_ASSISTANT_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyData),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`AI API Error: ${response.status} ${response.statusText}`);
      const errBody = await response.text();
      console.error(`AI API Details:`, errBody);
      return null;
    }

    const payload = await response.json();
    let content;
    
    if (isGemini) {
      content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      content = payload?.choices?.[0]?.message?.content;
    }

    return parseAssistantResponse(content);
  } catch (_error) {
    console.error(`AI Service Exception:`, _error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const generateHealthAssistantReport = async ({ spo2, bpm, trend }) => {
  const reportInput = {
    spo2: Number(spo2),
    bpm: Number(bpm),
    trend: normalizeTrend(trend),
  };

  const aiReport = await requestModelReport(reportInput);

  if (aiReport) {
    return {
      source: "ai",
      generatedAt: new Date().toISOString(),
      report: aiReport,
    };
  }

  return {
    source: "fallback",
    generatedAt: new Date().toISOString(),
    report: buildFallbackReport(reportInput),
  };
};

module.exports = {
  generateHealthAssistantReport,
};
