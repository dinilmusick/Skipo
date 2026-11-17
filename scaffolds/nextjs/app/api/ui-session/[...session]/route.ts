import { fetchHandler } from '@/src/backend/adapters/httpsAdapter';

export async function GET(request: Request): Promise<Response> {
  return fetchHandler(request, process.env);
}

export { GET as POST, GET as DELETE };
