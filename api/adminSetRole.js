import { createClient } from "@supabase/supabase-js";

async function requireAdmin(req, supaAdmin, url, serviceKey) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Error("Missing auth token");

  const uResp = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
  });
  const user = await uResp.json();
  if (!uResp.ok || !user?.id) throw new Error("Invalid session");

  const { data: roleRow } = await supaAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if ((roleRow?.role || "user") !== "admin") throw new Error("Not an admin");
  return user;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return res.status(500).json({ error: "Supabase env vars missing" });

    const supaAdmin = createClient(url, serviceKey);
    await requireAdmin(req, supaAdmin, url, serviceKey);

    const { userId, role } = req.body || {};
    if (!userId || !role) return res.status(400).json({ error: "Missing userId or role" });

    if (!["user", "reviewer", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const { error } = await supaAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(403).json({ error: String(e) });
  }
}
