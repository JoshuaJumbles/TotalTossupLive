import { ChannelDurableObject, type Env } from './channelDurableObject';
import { channelDirectory } from './presets';

export { ChannelDurableObject };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // The channel directory: what there is to connect to. Answered here
    // rather than by a Durable Object because it is a property of the
    // deployed code and not of any one channel's state — no object is
    // woken to serve it. `no-store` for the same reason the read routes
    // carry it: this changes with a deploy, and a cached copy would hide
    // a newly added Family behind an old list.
    if (url.pathname === '/channels' && request.method === 'GET') {
      return Response.json(
        { channels: channelDirectory() },
        { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } },
      );
    }

    // The id is a real routing parameter, not hardcoded anywhere, so
    // adding channels is just minting more DO instances under different
    // names. The full request (including /channels/:id/...) is forwarded
    // as-is so the DO can parse its own channelId out of the path.
    const match = url.pathname.match(/^\/channels\/([^/]+)(\/.*)?$/);
    if (!match) {
      return new Response('not found', { status: 404 });
    }

    const [, channelId] = match;
    const id = env.CHANNEL.idFromName(channelId);
    const stub = env.CHANNEL.get(id);
    return stub.fetch(request);
  },
};
