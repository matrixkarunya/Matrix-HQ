import ImageKit from "@imagekit/nodejs";
import { genericErrorResponse, verifyCaller } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firestoreValue(value) {
  return typeof value?.stringValue === "string" ? value.stringValue : "";
}

export async function POST(request) {
  let caller;
  try {
    caller = await verifyCaller(request);

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const photoUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/userPhotos/${encodeURIComponent(caller.email)}`;
    const photoResponse = await fetch(photoUrl, {
      headers: { Authorization: `Bearer ${caller.idToken}` },
      cache: "no-store",
    });

    if (photoResponse.status === 404) return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    if (photoResponse.status !== 200) return Response.json({ error: "Could not inspect the photo." }, { status: 502, headers: { "Cache-Control": "no-store" } });

    const photoDocument = await photoResponse.json();
    const fileId = firestoreValue(photoDocument.fields?.fileId);
    if (fileId) {
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
      if (!privateKey) return Response.json({ error: "Photo deletion is not configured." }, { status: 502, headers: { "Cache-Control": "no-store" } });
      try {
        const client = new ImageKit({ privateKey });
        await client.files.delete(fileId);
      } catch (error) {
        console.error("ImageKit photo deletion failed:", error?.status || "unknown");
        return Response.json({ error: "The hosted photo could not be deleted." }, { status: 502, headers: { "Cache-Control": "no-store" } });
      }
    }

    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ImageKit delete request failed:", error?.status || "unknown");
    return genericErrorResponse(error);
  }
}
