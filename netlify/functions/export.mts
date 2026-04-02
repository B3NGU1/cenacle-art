import { getStore } from "@netlify/blobs";

const CSV_HEADERS = [
  "Prenom", "Nom", "Email", "Instagram", "WhatsApp",
  "Budget", "Objectif", "Activite", "Position", "Date estimee", "Statut", "Date soumission",
];

export default async (req: Request) => {
  // Simple auth via query param (set EXPORT_KEY in Netlify env vars)
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const exportKey = process.env.EXPORT_KEY;

  if (!exportKey || key !== exportKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const store = getStore("submissions");
  let index: string[] = [];

  try {
    const existing = await store.get("_index", { type: "json" });
    if (Array.isArray(existing)) index = existing;
  } catch {
    return new Response("No submissions yet", { status: 200 });
  }

  const rows: string[] = [CSV_HEADERS.join(",")];

  for (const id of index) {
    try {
      const entry = await store.get(id, { type: "json" }) as Record<string, string> | null;
      if (!entry) continue;
      const row = [
        entry.prenom, entry.nom, entry.email, entry.instagram, entry.whatsapp,
        entry.budget, entry.objectif, entry.activite,
        entry.realPosition, entry.realEstimatedDate, entry.status, entry.submittedAt,
      ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`);
      rows.push(row.join(","));
    } catch { continue; }
  }

  return new Response(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=cenacle-submissions.csv",
    },
  });
};
