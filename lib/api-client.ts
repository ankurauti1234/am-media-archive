export interface ArchiveRecord {
  id: number;
  channelId: string;
  date: string;
  hour: number;
  videoS3Url: string;
  csvS3Url: string;
  localVideoPath: string;
  localCsvPath: string;
}

export interface FetchDailyRecordsResponse {
  records?: ArchiveRecord[];
  error?: string;
}

export interface FetchClosestRecordResponse {
  record?: ArchiveRecord | null;
  error?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

/**
 * Reusable helper to execute fetch requests with error handling
 */
async function fetchFromApi<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && typeof data === 'object' && 'error' in data) {
        errMsg = String(data.error);
      }
    } catch {
      // Fallback if parsing fails
    }
    throw new Error(errMsg);
  }

  return response.json() as Promise<T>;
}

export const archiveApi = {
  /**
   * Fetch all uploaded recording metadata for a specific channel and day.
   */
  getDailyRecords: async (channelId: string, date: string): Promise<ArchiveRecord[]> => {
    const data = await fetchFromApi<FetchDailyRecordsResponse>(
      `/api/archive?channelId=${channelId}&date=${date}`
    );
    return data.records || [];
  },

  /**
   * Query the database for the chronologically closest uploaded recording relative to a target hour.
   */
  getClosestRecord: async (channelId: string, date: string, hour: number): Promise<ArchiveRecord | null> => {
    const data = await fetchFromApi<FetchClosestRecordResponse>(
      `/api/archive?channelId=${channelId}&date=${date}&hour=${hour}&closest=true`
    );
    return data.record || null;
  },
};
