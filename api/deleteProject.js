// api/deleteProject.js
// Match style of saveProject: use fetch to Supabase REST API

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: "Missing project id" });
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
      Prefer: "return=minimal"
    };

    // 1) Delete all child rows in project_rows
    const rowsResp = await fetch(
      `${url}/rest/v1/project_rows?project_id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers
      }
    );

    if (!rowsResp.ok) {
      const errTxt = await rowsResp.text();
      console.error("Supabase project_rows delete error:", errTxt);
      return res
        .status(500)
        .json({ error: "Supabase project_rows delete error: " + errTxt });
    }

    // 2) Delete the project record itself
    const projResp = await fetch(
      `${url}/rest/v1/projects?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers
      }
    );

    if (!projResp.ok) {
      const errTxt = await projResp.text();
      console.error("Supabase projects delete error:", errTxt);
      return res
        .status(500)
        .json({ error: "Supabase projects delete error: " + errTxt });
    }

    // Success
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("deleteProject error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
