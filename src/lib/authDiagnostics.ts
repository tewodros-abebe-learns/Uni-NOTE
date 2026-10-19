export function authDiagnostic(hostname: string, projectId: string, storageBucket?: string) {
  return {
    hostname,
    authSettingsUrl: `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/authentication/settings`,
    storageRulesUrl: `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/storage/${storageBucket ? encodeURIComponent(storageBucket) + '/' : ''}rules`,
    message: `Google sign-in is not authorized for ${hostname}. Add this exact hostname under Firebase Authentication → Settings → Authorized domains, then retry.`,
  };
}
export const isAuthorizedHostname = (hostname: string, domains: string[]) => domains.some(domain => domain.toLowerCase() === hostname.toLowerCase());
