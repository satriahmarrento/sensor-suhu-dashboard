const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
};

const headers = (key, prefer) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {})
});

module.exports = async (req, res) => {
  const config = getSupabaseConfig();
  if (!config) return json(res, 500, { error: "Supabase env vars are not configured" });

  try {
    if (req.method === "GET") {
      const response = await fetch(`${config.url}/rest/v1/admin_config?id=eq.1&select=*`, {
        headers: headers(config.key)
      });
      const data = await response.json();
      if (!response.ok) return json(res, response.status, { error: data.message || "Supabase request failed" });
      return json(res, 200, { data: data[0] || null });
    }

    if (req.method === "POST") {
      const response = await fetch(`${config.url}/rest/v1/admin_config?on_conflict=id`, {
        method: "POST",
        headers: headers(config.key, "resolution=merge-duplicates,return=representation"),
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      if (!response.ok) return json(res, response.status, { error: data.message || "Supabase request failed" });
      return json(res, 200, { data: Array.isArray(data) ? data[0] : data });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Unexpected server error" });
  }
};
