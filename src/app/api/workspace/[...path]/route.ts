import { handleWorkspaceRequest } from "@/server/flows/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context {
  params: Promise<{ path: string[] }>;
}
export const GET = async (request: Request, { params }: Context) =>
  handleWorkspaceRequest(request, (await params).path);
export const POST = async (request: Request, { params }: Context) =>
  handleWorkspaceRequest(request, (await params).path);
