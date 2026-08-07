import { ChannelDurableObject, type Env } from './channelDurableObject';

export { ChannelDurableObject };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Single seeded channel for now — the id is already a real routing
    // parameter, not hardcoded elsewhere, so adding more channels later is
    // just minting more DO instances under different names.
    const match = url.pathname.match(/^\/channels\/([^/]+)(\/.*)?$/);
    if (!match) {
      return new Response('not found', { status: 404 });
    }

    const [, channelId, rest = '/'] = match;
    const id = env.CHANNEL.idFromName(channelId);
    const stub = env.CHANNEL.get(id);

    const forwardUrl = new URL(request.url);
    forwardUrl.pathname = rest;
    return stub.fetch(new Request(forwardUrl, request));
  },
};
