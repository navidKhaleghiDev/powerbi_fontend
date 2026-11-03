import { handleAuth } from "@/server/flows/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context {
  params: Promise<{ action: string }>;
}
export const GET = async (request: Request, { params }: Context) =>
  handleAuth(request, (await params).action);
export const POST = async (request: Request, { params }: Context) =>
  handleAuth(request, (await params).action);
