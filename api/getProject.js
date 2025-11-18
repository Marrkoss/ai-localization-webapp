export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: "Missing project ID" });

    const headers = {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    };

    // 1) Load project info
    const p = await fetch(`${url}/rest/v1/projects?id=eq.${id}&select=*`, {
      method: "GET",
      headers
    });
    const project = (await p.json())[0];
    if (!project) return res.status(404).json({ error: "Project not found" });

    // 2) Load project_rows
    const r = await fetch(`${url}/rest/v1/project_rows?project_id=eq.${id}&select=*`, {
      method: "GET",
      headers
    });

    const rows = await r.json();

    return res.status(200).json({ project, rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
