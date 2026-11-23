import { type NextRequest } from "next/server";
import { searchSongs } from "@/lib/music";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return Response.json({ results: [] });
  try {
    const results = await searchSongs(q.toLowerCase(), 8);
    return Response.json({ results });
  } catch {
    return Response.json({ results: [], error: "Search is unavailable right now." }, { status: 502 });
  }
}
