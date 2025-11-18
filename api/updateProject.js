export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const {
      projectId,
      projectName,
      languages,
      englishText,
      translations,
      status,
      reviewedBy,
      markReviewed
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ error: "Missing projectId" });
    }

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return res.status(500).json({ error: "Supabase env vars missing" });
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation"
    };

    const effectiveStatus = markReviewed ? "Reviewed" : (status || "Draft");
    const now = new Date().toISOString();

    // 1) Update the project record
    const projectPatch = {
      ...(projectName ? { project_name: projectName } : {}),
      ...(Array.isArray(languages) ? { languages } : {}),
      status: effectiveStatus,
      updated_at: now
    };

    const projResp = await fetch(`${url}/rest/v1/projects?id=eq.${projectId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(projectPatch)
    });

    if (!projResp.ok) {
      const errTxt = await projResp.text();
      console.error("Supabase projects update error:", errTxt);
      return res.status(500).json({ error: "Supabase projects update error: " + errTxt });
    }

    // 2) Update project_rows for this project (assuming one row per project)
    const rowPatch = {
      english_text: englishText || null,
      zh_tw: translations?.["zh-TW"] ?? null,
      zh_cn: translations?.["zh-CN"] ?? null,
      ja_jp: translations?.["ja-JP"] ?? null,
      th_th: translations?.["th-TH"] ?? null,
      vi_vn: translations?.["vi-VN"] ?? null,
      status: effectiveStatus,
      updated_at: now
    };

    if (markReviewed) {
      rowPatch.reviewed_by = reviewedBy || null;
      rowPatch.reviewed_at = now;
    }

    const rowResp = await fetch(`${url}/rest/v1/project_rows?project_id=eq.${projectId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(rowPatch)
    });

    if (!rowResp.ok) {
      const errTxt = await rowResp.text();
      console.error("Supabase project_rows update error:", errTxt);
      return res.status(500).json({ error: "Supabase project_rows update error: " + errTxt });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("updateProject error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
