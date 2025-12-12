async function isAdmin(url, serviceKey, token) {
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

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return res.status(500).json({ error: "Missing Supabase env vars" });

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const { role, error } = await isAdmin(url, serviceKey, token);
    if (error) return res.status(401).json({ error: "Invalid session: " + error });
    if (role !== "admin") return res.status(403).json({ error: "Admin only" });

    // delete rows first
    const rowDel = await fetch(`${url}/rest/v1/project_rows?project_id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!rowDel.ok) return res.status(500).json({ error: await rowDel.text() });

    // delete project
    const projDel = await fetch(`${url}/rest/v1/projects?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!projDel.ok) return res.status(500).json({ error: await projDel.text() });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
