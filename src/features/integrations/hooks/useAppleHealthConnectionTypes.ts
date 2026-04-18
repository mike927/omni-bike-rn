export interface UseAppleHealthConnectionResult {
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<{ success: boolean; errorMessage?: string }>;
  disconnect: () => Promise<{ success: boolean; errorMessage?: string }>;
}
