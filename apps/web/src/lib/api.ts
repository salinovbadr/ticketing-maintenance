const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data as T;
}

export const ticketsApi = {
    list: (params?: { status?: string; priority?: string; search?: string }) => {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.append('status', params.status);
        if (params?.priority) searchParams.append('priority', params.priority);
        if (params?.search) searchParams.append('search', params.search);
        return apiFetch<any[]>(`/tickets?${searchParams.toString()}`);
    },
    get: (id: string | number) => apiFetch<any>(`/tickets/${id}`),
    update: (id: string | number, data: any) =>
        apiFetch<any>(`/tickets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
};

export const dashboardApi = {
    getStats: () => apiFetch<any>('/dashboard/stats'),
    getUptime: () => apiFetch<any>('/dashboard/uptime'),
    getCategories: () => apiFetch<any>('/dashboard/categories'),
    getTicketsByHour: () => apiFetch<any>('/dashboard/tickets-by-hour'),
    getTeamPerformance: () => apiFetch<any>('/dashboard/team-performance'),
};

export const usersApi = {
    getMe: () => apiFetch<any>('/users/me'),
    updateMe: (data: any) => apiFetch<any>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
};

export const settingsApi = {
    getSla: () => apiFetch<any>('/settings/sla'),
    updateSla: (id: number, data: any) => apiFetch<any>(`/settings/sla/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),
};
