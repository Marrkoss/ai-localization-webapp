import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role key (backend only)
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Missing project id" });
    }

    // 1) Delete child rows
    const { error: rowsError } = await supabase
      .from("project_rows")
      .delete()
      .eq("project_id", id);

    if (rowsError) {
      console.error(rowsError);
      return res.status(500).json({ error: "Failed to delete project rows" });
    }

    // 2) Delete project
    const { error: projError } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (projError) {
      console.error(projError);
      return res.status(500).json({ error: "Failed to delete project" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
