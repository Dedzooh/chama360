import axios from 'axios';

interface ApiErrorDetail {
  field?: string;
  message?: string;
}

interface ApiErrorPayload {
  message?: string;
  error?: string | {
    message?: string;
    details?: ApiErrorDetail[];
  };
}

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const data = error.response?.data;
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (typeof data?.error === 'string') {
      return data.error;
    }
    if (typeof data?.error?.message === 'string') {
      const detailMessages = data.error.details
        ?.map((detail) => detail.field ? `${detail.field}: ${detail.message}` : detail.message)
        .filter((message): message is string => Boolean(message));

      return detailMessages?.length
        ? detailMessages.join(' ')
        : data.error.message;
    }
  }

  return error instanceof Error ? error.message : fallback;
};
