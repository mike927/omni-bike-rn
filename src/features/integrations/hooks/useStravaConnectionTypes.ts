export interface UseStravaConnectionResult {
  isConnected: boolean;
  athleteName: string | null;
  isLoading: boolean;
  connect: () => Promise<{ success: boolean; errorMessage?: string }>;
  disconnect: () => Promise<{ success: boolean; errorMessage?: string }>;
}
