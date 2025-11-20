export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const {
      projectId,
      projectName,
      languages,
      status,
      reviewedBy,
      blocks
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ error: "Missing projectId" });
    }

    if (!Array.isArray(blocks) || !blocks.length) {
      return res.status(400).json({ error: "No blocks provided" });
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

    const effectiveStatus = status || "Draft";
    const now = new Date().toISOString();

    // 1) Update project
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

    // 2) Delete old rows for this project
    const delResp = await fetch(`${url}/rest/v1/project_rows?project_id=eq.${projectId}`, {
      method: "DELETE",
      headers
    });

    if (!delResp.ok) {
      const errTxt = await delResp.text();
      console.error("Supabase project_rows delete error:", errTxt);
      return res.status(500).json({ error: "Supabase project_rows delete error: " + errTxt });
    }

    // 3) Insert new rows from blocks
    let reviewed_at = null;
    if ((effectiveStatus === "Reviewed" || effectiveStatus === "Approved") && reviewedBy) {
      reviewed_at = now;
    }

    const rowsPayload = blocks.map((b, i) => {
      const t = b.translations || {};
      return {
        project_id: projectId,
        block_index: typeof b.index === "number" ? b.index : i,
        english_text: b.englishText || "",
        zh_tw: t["zh-TW"] || null,
        zh_cn: t["zh-CN"] || null,
        ja_jp: t["ja-JP"] || null,
        th_th: t["th-TH"] || null,
        vi_vn: t["vi-VN"] || null,
        status: effectiveStatus,
        reviewed_by: reviewedBy || null,
        reviewed_at
      };
    });

    const rowResp = await fetch(`${url}/rest/v1/project_rows`, {
      method: "POST",
      headers,
      body: JSON.stringify(rowsPayload)
    });

    if (!rowResp.ok) {
      const errTxt = await rowResp.text();
      console.error("Supabase project_rows insert (update) error:", errTxt);
      return res.status(500).json({ error: "Supabase project_rows insert error: " + errTxt });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("updateProject error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
