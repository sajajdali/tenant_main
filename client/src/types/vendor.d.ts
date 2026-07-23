declare module "iran-cities-json" {
  export const ostan: Array<{
    id: number | string;
    name: string;
  }>;

  export const shahr: Array<{
    id: number | string;
    name: string;
    ostan: number | string;
  }>;
}

declare module "@replit/vite-plugin-runtime-error-modal" {
  const runtimeErrorOverlay: () => unknown;
  export default runtimeErrorOverlay;
}

declare module "@replit/vite-plugin-cartographer" {
  export const cartographer: () => unknown;
}

declare module "@replit/vite-plugin-dev-banner" {
  export const devBanner: () => unknown;
}
