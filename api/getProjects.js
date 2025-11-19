export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    };

    const { ownerId } = req.query || {};

    let endpoint = `${url}/rest/v1/projects?select=*`;
    if (ownerId) {
      endpoint += `&owner_id=eq.${ownerId}`;
    }

    const resp = await fetch(endpoint, {
      method: "GET",
      headers
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).json({ error: "Supabase error: " + txt });
    }

    const data = await resp.json();
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ projects: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
