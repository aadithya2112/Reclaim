import { getOperationalReplay } from "@/lib/operational-recovery";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const replay = await getOperationalReplay(id);
  return replay ? Response.json({ replay }) : Response.json({ error: "Recovery case not found" }, { status: 404 });
}
