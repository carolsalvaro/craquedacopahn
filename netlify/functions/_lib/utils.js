function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function ok(body) { return json(200, body); }
function bad(message, status = 400) { return json(status, { error: message }); }

function parseBody(event) {
  try { return JSON.parse(event.body || "{}"); }
  catch { return {}; }
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function checkAdmin(event) {
  const expected = process.env.ADMIN_PASSWORD;
  const provided = event.headers["x-admin-password"] || event.headers["X-Admin-Password"];
  if (!expected) throw new Error("ADMIN_PASSWORD não configurada no Netlify.");
  if (!provided || provided !== expected) {
    const err = new Error("Senha administrativa inválida.");
    err.statusCode = 401;
    throw err;
  }
}

function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

module.exports = { json, ok, bad, parseBody, digits, checkAdmin, shortName };
