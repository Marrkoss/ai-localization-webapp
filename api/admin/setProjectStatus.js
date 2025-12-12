async function getRole(url, serviceKey, token) {
  const userResp = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
  });
  if (!userResp.ok) return { error: await userResp.text() };
  const user = await userResp.json();

  const roleResp = await fetch(
    `${url}/rest/v1/user_roles?user_id=eq.${user.id}&select=role`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      }
    }
  );
  let role = "user";
  if (roleResp.ok) {
    const rows = await roleResp.json();
    role = rows?.[0]?.role || "user";
  }
  return { role };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { projectId, status, reviewedBy } = req.body || {};
    if (!projectId || !status) return res.status(400).json({ error: "Missing projectId/status" });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return res.status(500).json({ error: "Missing Supabase env vars" });

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const { role, error } = await getRole(url, serviceKey, token);
    if (error) return res.status(401).json({ error: "Invalid session: " + error });
    if (role !== "admin") return res.status(403).json({ error: "Admin only" });

    const reviewed_at =
      (status === "Reviewed" || status === "Approved") && reviewedBy
        ? new Date().toISOString()
        : null;

    // 1) update projects status
    const projResp = await fetch(`${url}/rest/v1/projects?id=eq.${projectId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ status })
    });
    if (!projResp.ok) return res.status(500).json({ error: await projResp.text() });

    // 2) update all rows status + review metadata (optional)
    const patch = { status };
    if (reviewedBy !== undefined) patch.reviewed_by = reviewedBy || null;
    if (reviewed_at !== undefined) patch.reviewed_at = reviewed_at;

    const rowResp = await fetch(`${url}/rest/v1/project_rows?project_id=eq.${projectId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    });
    if (!rowResp.ok) return res.status(500).json({ error: await rowResp.text() });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
