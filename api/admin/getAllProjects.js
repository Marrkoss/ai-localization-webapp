function isAdminRole(role) {
  return role === "admin";
}

async function getUserAndRole(url, serviceKey, token) {
  const userResp = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
  });
  if (!userResp.ok) return { error: await userResp.text() };

  const user = await userResp.json();
  const userId = user?.id;

  const roleResp = await fetch(
    `${url}/rest/v1/user_roles?user_id=eq.${userId}&select=role`,
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

  return { user, role };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return res.status(500).json({ error: "Missing Supabase env vars" });

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    const { role, error } = await getUserAndRole(url, serviceKey, token);
    if (error) return res.status(401).json({ error: "Invalid session: " + error });
    if (!isAdminRole(role)) return res.status(403).json({ error: "Admin only" });

    // Pull all projects
    const resp = await fetch(
      `${url}/rest/v1/projects?select=id,project_name,languages,status,owner_id,created_at&order=created_at.desc`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!resp.ok) return res.status(500).json({ error: await resp.text() });
    const projects = await resp.json();

    return res.status(200).json({ projects });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
