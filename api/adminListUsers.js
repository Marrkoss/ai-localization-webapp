import { createClient } from "@supabase/supabase-js";

async function requireAdmin(req, supaAdmin, url, serviceKey) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Error("Missing auth token");

  // Verify session user
  const uResp = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
  });
  const user = await uResp.json();
  if (!uResp.ok || !user?.id) throw new Error("Invalid session");

  // Check role
  const { data: roleRow, error } = await supaAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if ((roleRow?.role || "user") !== "admin") throw new Error("Not an admin");

  return user;
}

export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return res.status(500).json({ error: "Supabase env vars missing" });

    const supaAdmin = createClient(url, serviceKey);
    await requireAdmin(req, supaAdmin, url, serviceKey);

    // List users from Supabase Auth
    const { data, error } = await supaAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return res.status(500).json({ error: error.message });

    // Pull roles
    const { data: roles, error: roleErr } = await supaAdmin
      .from("user_roles")
      .select("user_id, role");
    if (roleErr) return res.status(500).json({ error: roleErr.message });

    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

    const users = (data?.users || []).map(u => ({
      id: u.id,
      email: u.email || "",
      created_at: u.created_at,
      role: roleMap.get(u.id) || "user"
    }));

    return res.status(200).json({ users });
  } catch (e) {
    return res.status(403).json({ error: String(e) });
  }
}
