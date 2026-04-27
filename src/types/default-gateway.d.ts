declare module "default-gateway" {
  export interface GatewayResult {
    gateway: string;
    interface: string;
  }
  export function v4(): Promise<GatewayResult>;
  export function v6(): Promise<GatewayResult>;
  export function v4Sync(): GatewayResult;
  export function v6Sync(): GatewayResult;
}
