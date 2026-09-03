// Cloudflare Worker: receives { name, date } from the GitHub Pages frontend
// and sends an email via Resend. The Resend API key lives only here, as a
// secret — never in the browser.

// Set this to your GitHub Pages origin (no trailing slash).
// Examples: "https://josualampas.github.io"  or  "https://termin.example.com"
const ALLOWED_ORIGIN = "https://jerryjollla.github.io";

const RECIPIENT = "j.lampas@protonmail.com";
// "onboarding@resend.dev" as FROM works without domain verification ONLY if the
// Resend account was created with this same address (j.lampas@protonmail.com).
// Otherwise verify a domain in Resend and use e.g. "termin@your-domain.tld".
const FROM = "Tinker Tech Support <onboarding@resend.dev>";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Ungültige Anfrage." }, 400, cors);
    }

    const name = String(data.name ?? "").trim().slice(0, 120);
    const date = String(data.date ?? "").trim().slice(0, 40);

    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "Name oder Datum fehlt bzw. ist ungültig." }, 400, cors);
    }

    const chosen = new Date(date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!(chosen > today)) {
      return json({ error: "Der Termin muss in der Zukunft liegen." }, 400, cors);
    }

    const lesbar = chosen.toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [RECIPIENT],
        reply_to: RECIPIENT,
        subject: `Tinker Tech Support – Terminwunsch von ${name}`,
        text:
          `Hallo Tinker Tech Support Team,\n\n` +
          `es gibt einen neuen Terminwunsch aus der Werkstatt-App.\n\n` +
          `Name: ${name}\n` +
          `Wunschdatum: ${lesbar} (${date})\n`,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      return json({ error: "E-Mail-Versand fehlgeschlagen.", detail }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
