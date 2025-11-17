export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { text, targets } = req.body || {};
    if (!text || !Array.isArray(targets) || !targets.length) {
      return res.status(400).json({ error: "Missing text/targets" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    const translations = {};
    for (const locale of targets) {
      const payload = {
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system",
            content: "You are a professional B2B marketing translator. Preserve brand/product names (Bosch, BVMS, IVA Pro, PRAESENSA, AUTODOME, FLEXIDOME, VideoView+). Return only the translation." },
          { role: "user", content: `Target locale: ${locale}\n${text}` }
        ]
      };

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!r.ok) {
        const errTxt = await r.text();
        return res.status(r.status).json({ error: `OpenAI error: ${errTxt}` });
      }

      const j = await r.json();
      translations[locale] = j.choices?.[0]?.message?.content?.trim() || "";
      await new Promise(s => setTimeout(s, 120));
    }

    res.status(200).json({ translations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
}
