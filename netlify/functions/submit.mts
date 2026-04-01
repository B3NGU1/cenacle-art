import type { Context } from "@netlify/functions";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const CALLS_PER_WEEK = 5;
const FRIDAY = 5; // day of week (1=Mon, 5=Fri in ISO)

interface ApplicationData {
  prenom: string;
  nom: string;
  instagram: string;
  whatsapp: string;
  email: string;
  budget: string;
  objectif: string;
  activite: string;
}

const REQUIRED_FIELDS: (keyof ApplicationData)[] = [
  "prenom", "nom", "instagram", "whatsapp", "email", "budget", "objectif", "activite",
];

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Count active leads in the Notion CRM (those still in the queue). */
async function countActiveLeads(notionKey: string, dbId: string): Promise<number> {
  const response = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: "Statut",
            select: { does_not_equal: "signé" },
          },
          {
            property: "Statut",
            select: { does_not_equal: "perdu" },
          },
          {
            property: "Statut",
            select: { does_not_equal: "non qualifié" },
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Notion query error: ${err}`);
  }

  const data = (await response.json()) as { results: unknown[] };
  return data.results.length;
}

/** Calculate real and inflated waitlist position + estimated contact date. */
function calculateWaitlist(queueSize: number) {
  const realPosition = queueSize + 1;

  // Find next Friday
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = ((FRIDAY - dayOfWeek) + 7) % 7 || 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);

  // Weeks to wait based on capacity
  const weeksToWait = Math.ceil(realPosition / CALLS_PER_WEEK) - 1;
  const realDate = new Date(nextFriday);
  realDate.setDate(realDate.getDate() + weeksToWait * 7);

  // Inflated values for frontend display
  const inflatedPosition = realPosition + 5;
  const delayedDate = new Date(realDate);
  delayedDate.setDate(delayedDate.getDate() + 7);

  return {
    realPosition,
    realDate: realDate.toISOString().split("T")[0],
    inflatedPosition,
    delayedDate: delayedDate.toISOString().split("T")[0],
  };
}

/** Create a new page in the Notion CRM database. */
async function createNotionEntry(
  notionKey: string,
  dbId: string,
  data: ApplicationData,
  realPosition: number,
  realDate: string
) {
  const today = new Date().toISOString().split("T")[0];

  const response = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        Prenom: {
          title: [{ text: { content: data.prenom } }],
        },
        Nom: {
          rich_text: [{ text: { content: data.nom } }],
        },
        Instagram: {
          url: data.instagram,
        },
        WhatsApp: {
          rich_text: [{ text: { content: data.whatsapp } }],
        },
        Email: {
          email: data.email,
        },
        Budget: {
          rich_text: [{ text: { content: data.budget } }],
        },
        Objectif: {
          rich_text: [{ text: { content: data.objectif } }],
        },
        Activite: {
          rich_text: [{ text: { content: data.activite } }],
        },
        "Date de candidature": {
          date: { start: today },
        },
        Statut: {
          select: { name: "en attente" },
        },
        "Date de contact estimee": {
          date: { start: realDate },
        },
        Position: {
          number: realPosition,
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Notion create error: ${err}`);
  }
}

/** Send Telegram notification to Andreas. */
async function notifyTelegram(
  botToken: string,
  chatId: string,
  data: ApplicationData
) {
  const message = [
    "🎯 *Nouvelle Candidature Cénacle*",
    "",
    `*Nom :* ${data.prenom} ${data.nom}`,
    `*Instagram :* ${data.instagram}`,
    `*Budget :* ${data.budget}`,
  ].join("\n");

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
    }),
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Env vars
  const notionKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_CENACLE_DB_ID;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChat = process.env.TELEGRAM_CHAT_ID_ANDREAS;

  if (!notionKey || !dbId) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  // Parse body
  let data: ApplicationData;
  try {
    data = (await req.json()) as ApplicationData;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || !String(data[field]).trim()) {
      return jsonResponse({ error: `Le champ "${field}" est requis.` }, 400);
    }
  }

  try {
    // 1. Count active leads
    const queueSize = await countActiveLeads(notionKey, dbId);

    // 2. Calculate waitlist
    const waitlist = calculateWaitlist(queueSize);

    // 3. Create Notion entry (real values)
    await createNotionEntry(notionKey, dbId, data, waitlist.realPosition, waitlist.realDate);

    // 4. Send Telegram notification (non-blocking — don't fail the request if it errors)
    if (telegramToken && telegramChat) {
      notifyTelegram(telegramToken, telegramChat, data).catch((err) =>
        console.error("Telegram notification failed:", err)
      );
    }

    // 5. Return inflated values to frontend
    return jsonResponse({
      success: true,
      position: waitlist.inflatedPosition,
      estimatedDate: waitlist.delayedDate,
    });
  } catch (err) {
    console.error("Submit error:", err);
    return jsonResponse({ error: "Une erreur est survenue. Veuillez réessayer." }, 500);
  }
};
