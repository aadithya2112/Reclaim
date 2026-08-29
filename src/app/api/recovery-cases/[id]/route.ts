import { getRecoveryCaseSnapshot } from "@/lib/recovery";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const recoveryCase = await getRecoveryCaseSnapshot(id);

  if (!recoveryCase) {
    return Response.json({ error: "Recovery case not found" }, { status: 404 });
  }

  return Response.json({ recoveryCase });
}
