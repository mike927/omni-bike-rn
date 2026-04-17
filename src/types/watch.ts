export type WatchSessionState = 'idle' | 'starting' | 'active' | 'stopping' | 'ended' | 'failed';

export type WatchSessionStateEvent = 'started' | 'ended' | 'failed';
