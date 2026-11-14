export interface GuestModePolicy {
  readonly enabled: boolean;
  readonly appId: string;
  readonly deploymentId: string;
  readonly capabilities: readonly string[];
  readonly luthExcluded: true;
}

export interface GuestWorkspaceRouteContext {
  readonly kind: "guest";
  readonly leaseId: string;
  readonly appId: string;
  readonly deploymentId: string;
  readonly workspaceId: string;
  readonly capabilities: readonly string[];
}

export function createGuestModePolicy(
  appId: string,
  deploymentId: string,
  capabilities: readonly string[] = [],
): GuestModePolicy {
  if (!appId || !deploymentId) throw new Error("Guest mode requires trusted app and deployment identities.");
  if (appId.toLowerCase() === "luth") throw new Error("Luth is excluded from guest mode.");
  return {
    enabled: true,
    appId,
    deploymentId,
    capabilities: [...new Set(capabilities)],
    luthExcluded: true,
  };
}

export function guestCan(policy: GuestModePolicy, capability: string): boolean {
  return policy.enabled && policy.capabilities.includes(capability);
}

export function guestWorkspaceNamespace(context: GuestWorkspaceRouteContext): string {
  return [
    "guest",
    encodeURIComponent(context.appId),
    encodeURIComponent(context.deploymentId),
    encodeURIComponent(context.leaseId),
    encodeURIComponent(context.workspaceId),
  ].join("/");
}
