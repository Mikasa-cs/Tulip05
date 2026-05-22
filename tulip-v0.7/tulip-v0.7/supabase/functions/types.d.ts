declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.57.4' {
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/stripe@16.8.0?target=deno' {
  const Stripe: any;
  export default Stripe;
}

declare global {
  const Deno: {
    env: {
      get: (key: string) => string | undefined;
    };
  };
}

export {};
