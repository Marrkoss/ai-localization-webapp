export default async function handler(req, res) {
  try {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    };

    // 1) Fetch project
    const projResp = await fetch(`${url}/rest/v1/projects?id=eq.${id}`, {
      method: "GET",
      headers
    });

    if (!projResp.ok) {
      const txt = await projResp.text();
      console.error("Supabase getProject error:", txt);
      return res.status(500).json({ error: "Supabase projects error: " + txt });
    }

    const projData = await projResp.json();
    const project = projData[0];
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // 2) Fetch project_rows (ordered by block_index)
    const rowResp = await fetch(
      `${url}/rest/v1/project_rows?project_id=eq.${id}&order=block_index.asc`,
      { method: "GET", headers }
    );

    if (!rowResp.ok) {
      const txt = await rowResp.text();
      console.error("Supabase project_rows error:", txt);
      return res.status(500).json({ error: "Supabase project_rows error: " + txt });
    }

    const rows = await rowResp.json();

    return res.status(200).json({
      project,
      rows
    });
  } catch (err) {
    console.error("getProject error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
