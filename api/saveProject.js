export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const {
      projectName,
      languages,
      status,
      reviewedBy,
      ownerId,
      blocks
    } = req.body || {};

    if (!projectName || !Array.isArray(languages) || !languages.length) {
      return res.status(400).json({ error: "Missing projectName or languages" });
    }

    if (!ownerId) {
      return res.status(400).json({ error: "Missing ownerId (user must be logged in)" });
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

    let reviewed_at = null;
    if ((effectiveStatus === "Reviewed" || effectiveStatus === "Approved") && reviewedBy) {
      reviewed_at = new Date().toISOString();
    }

    // 1) Insert into projects
    const projResp = await fetch(`${url}/rest/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify([
        {
          project_name: projectName,
          languages,
          status: effectiveStatus,
          owner_id: ownerId
        }
      ])
    });

    if (!projResp.ok) {
      const errTxt = await projResp.text();
      console.error("Supabase projects insert error:", errTxt);
      return res.status(500).json({ error: "Supabase projects insert error: " + errTxt });
    }

    const projRows = await projResp.json();
    const projectId = projRows[0]?.id;
    if (!projectId) {
      return res.status(500).json({ error: "Failed to get project ID from Supabase." });
    }

    // 2) Insert rows for each block
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
      console.error("Supabase project_rows insert error:", errTxt);
      return res.status(500).json({ error: "Supabase project_rows insert error: " + errTxt });
    }

    const rowData = await rowResp.json();

    return res.status(200).json({
      projectId,
      rowsInserted: rowData.length || 0
    });
  } catch (err) {
    console.error("saveProject error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
