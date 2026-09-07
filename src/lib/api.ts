import { Student, Transaction, ApiResponse, DashboardStats, AuthResponse } from '../types';

function getCleanGasUrl(): string {
  const raw = (import.meta.env.VITE_GAS_API_URL as string) || '';
  return raw.replace(/^["']|["']$/g, '').trim();
}

const GAS_API_URL = getCleanGasUrl();

async function request<T>(targetUrlOrAction: string, options?: RequestInit & { params?: Record<string, string> }): Promise<ApiResponse<T>> {
  try {
    const isPost = options?.method === 'POST';
    const isFullUrl = targetUrlOrAction.startsWith('http://') || targetUrlOrAction.startsWith('https://');

    // 1. First priority: Use server proxy (/api/gas) to bypass browser CORS & redirect issues
    try {
      let proxyEndpoint = '/api/gas';
      if (!isPost && isFullUrl && targetUrlOrAction.includes('?')) {
        const queryString = targetUrlOrAction.split('?')[1];
        proxyEndpoint = `/api/gas?${queryString}`;
      }

      const proxyRes = await fetch(proxyEndpoint, {
        method: options?.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: options?.body,
      });

      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json && typeof json === 'object') {
          return json;
        }
      } else {
        const errorJson = await proxyRes.json().catch(() => null);
        if (errorJson && errorJson.message) {
          return {
            success: false,
            data: null as any,
            message: errorJson.message,
          };
        }
      }
    } catch (proxyErr) {
      console.warn('Proxy request failed, attempting direct fetch:', proxyErr);
    }

    // 2. Second fallback: Direct fetch to Google Apps Script URL using text/plain (CORS friendly)
    const directUrl = isFullUrl ? targetUrlOrAction : (GAS_API_URL || targetUrlOrAction);
    if (!directUrl) {
      return {
        success: false,
        data: null as any,
        message: 'URL Google Apps Script belum disetel di .env',
      };
    }

    const response = await fetch(directUrl, {
      ...options,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('API Request Error Details:', error);
    let msg = error.message || 'Terjadi kesalahan koneksi ke server backend';
    if (msg.includes('Failed to fetch') || error.name === 'TypeError') {
      msg = 'Gagal menghubungi backend Google Apps Script. Pastikan Web App di-deploy dengan akses "Anyone" (Siapa saja).';
    }
    return {
      success: false,
      data: null as any,
      message: msg,
    };
  }
}

export const studentApi = {
  getAll: async () => {
    return request<Student[]>(`${GAS_API_URL}?action=getStudents&_t=${Date.now()}`);
  },
  getById: async (id: string) => {
    return request<Student>(`${GAS_API_URL}?action=getStudent&id=${id}&_t=${Date.now()}`);
  },
  create: async (student: Omit<Student, 'id' | 'created_at'>) => {
    return request<Student>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'createStudent',
        ...student,
      }),
    });
  },
  update: async (id: string, student: Partial<Student>) => {
    return request<Student>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateStudent',
        id,
        ...student,
      }),
    });
  },
  batchCreate: async (students: Omit<Student, 'id' | 'created_at'>[]) => {
    return request<Student[]>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'batchCreateStudents',
        students,
      }),
    });
  },
};

export const transactionApi = {
  getAll: async () => {
    return request<Transaction[]>(`${GAS_API_URL}?action=getTransactions&_t=${Date.now()}`);
  },
  deposit: async (data: { student_id: string; amount: number; method: string; note: string; status?: string; created_by?: string }) => {
    return request<Transaction>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'deposit',
        ...data,
        Status: data.status,
        StudentId: data.student_id,
        Amount: data.amount,
        Method: data.method,
        Note: data.note,
        CreatedBy: data.created_by,
      }),
    });
  },
  withdraw: async (data: { student_id: string; amount: number; method: string; note: string }) => {
    return request<Transaction>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'withdraw',
        ...data,
        StudentId: data.student_id,
        Amount: data.amount,
        Method: data.method,
        Note: data.note,
      }),
    });
  },
  getBalance: async (student_id: string) => {
    return request<{ balance: number }>(`${GAS_API_URL}?action=getBalance&student_id=${student_id}&_t=${Date.now()}`);
  },
  approve: async (id: string) => {
    return request<Transaction>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'approveTransaction',
        id,
      }),
    });
  },
  reject: async (id: string) => {
    return request<Transaction>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'rejectTransaction',
        id,
      }),
    });
  },
};

export const dashboardApi = {
  getStats: async () => {
    return request<DashboardStats>(`${GAS_API_URL}?action=getDashboardStats&_t=${Date.now()}`);
  },
};

export const authApi = {
  login: async (credentials: any) => {
    return request<AuthResponse>(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        ...credentials,
      }),
    });
  },
};
