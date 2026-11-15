function unauthorized(message = "Unauthorized") {
  const error = new Error(message);
  error.status = 401;
  return error;
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeTokenPayload(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw unauthorized();

  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw unauthorized();
  }
}

function firestoreValue(value) {
  if (typeof value?.stringValue === "string") return value.stringValue;
  if (typeof value?.booleanValue === "boolean") return value.booleanValue;
  return undefined;
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw unauthorized();
  return match[1];
}

export async function verifyCaller(request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw unauthorized();

  const idToken = getBearerToken(request);
  const payload = decodeTokenPayload(idToken);
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const now = Math.floor(Date.now() / 1000);

  if (
    !email
    || !Number.isFinite(payload.exp)
    || payload.exp <= now
    || payload.aud !== projectId
    || payload.iss !== `https://securetoken.google.com/${projectId}`
  ) {
    throw unauthorized();
  }

  const userUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(email)}`;
  let response;
  try {
    response = await fetch(userUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
  } catch {
    throw unauthorized();
  }

  if (response.status !== 200) {
    throw response.status === 403 ? Object.assign(new Error("Forbidden"), { status: 403 }) : unauthorized();
  }

  let document;
  try {
    document = await response.json();
  } catch {
    throw unauthorized();
  }

  const role = firestoreValue(document.fields?.role);
  const active = firestoreValue(document.fields?.active);
  if (active === false) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (role !== "admin" && role !== "member") throw Object.assign(new Error("Forbidden"), { status: 403 });

  return { email, idToken };
}

export function genericErrorResponse(error) {
  const status = error?.status === 403 ? 403 : 401;
  return Response.json({ error: status === 403 ? "Forbidden" : "Unauthorized" }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
