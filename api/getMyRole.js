export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return res.status(500).json({ error: "Supabase env vars missing" });
    }

    // Access token from browser
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    // Verify user via Supabase Auth (server-side)
    const uResp = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
    });

    const user = await uResp.json();
    if (!uResp.ok || !user?.id) {
      return res.status(401).json({ error: "Invalid session", detail: user });
    }

    // Get role from table
    const roleResp = await fetch(
      `${url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(user.id)}&select=role`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const roleRows = await roleResp.json();
    if (!roleResp.ok) {
      return res.status(500).json({ error: "Role lookup failed", detail: roleRows });
    }

    const role = roleRows?.[0]?.role || "user";
    return res.status(200).json({ role, userId: user.id, email: user.email || "" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
