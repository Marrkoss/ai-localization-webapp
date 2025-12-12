export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return res.status(500).json({ error: "Missing Supabase env vars" });

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Authorization Bearer token" });

    // 1) Validate user via Supabase Auth (admin endpoint)
    const userResp = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`
      }
    });
    if (!userResp.ok) {
      const t = await userResp.text();
      return res.status(401).json({ error: "Invalid session: " + t });
    }
    const user = await userResp.json();
    const userId = user?.id;
    if (!userId) return res.status(401).json({ error: "Invalid user" });

    // 2) Read role from user_roles
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

    return res.status(200).json({ role, userId, email: user.email || "" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
