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
