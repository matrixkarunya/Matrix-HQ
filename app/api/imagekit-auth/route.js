import ImageKit from "@imagekit/nodejs";
import { genericErrorResponse, verifyCaller } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await verifyCaller(request);

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
    if (!privateKey || !publicKey) {
      return Response.json({ error: "Image upload is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const client = new ImageKit({ privateKey });
    const expire = Math.floor(Date.now() / 1000) + 300;
    const auth = client.helper.getAuthenticationParameters(undefined, expire);

    return Response.json({ ...auth, publicKey }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ImageKit auth request failed:", error?.status || "unknown");
    return genericErrorResponse(error);
  }
}
