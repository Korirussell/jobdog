// Use relative path for proxy mode (production), full URL for local development
const API_BASE = process.env.NODE_ENV === 'production' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');

export class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('jwt_token', token);
    }
  }

  getToken() {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('jwt_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jwt_token');
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
    } else if (options.headers) {
      Object.assign(headers, options.headers as Record<string, string>);
    }

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string, displayName: string) {
    const data = await this.request<{ token: string; userId: string; email: string; displayName: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ token: string; userId: string; email: string; displayName: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  // Jobs
  async getJobs() {
    return this.request<{
      items: Array<{
        jobId: string;
        title: string;
        company: string;
        location: string;
        employmentType: string;
        postedAt: string;
        applyUrl: string;
      }>;
      page: number;
      size: number;
      total: number;
    }>('/api/v1/jobs');
  }

  // Resumes
  async uploadResume(file: File, label?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (label) formData.append('label', label);

    const token = this.getToken();
    const response = await fetch(`${API_BASE}/api/v1/resumes/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload resume');
    }

    return response.json();
  }

  async getResumes() {
    return this.request<{
      items: Array<{
        resumeId: string;
        label: string;
        originalFilename: string;
        status: string;
        uploadedAt: string;
      }>;
    }>('/api/v1/resumes');
  }

  // Applications
  async createApplication(jobId: string, resumeId: string) {
    return this.request<{
      applicationId: string;
      jobId: string;
      resumeId: string;
      status: string;
      matchScore: number;
    }>('/api/v1/applications', {
      method: 'POST',
      body: JSON.stringify({ jobId, resumeId }),
    });
  }

  async getApplications() {
    return this.request<{
      items: Array<{
        applicationId: string;
        jobTitle: string;
        company: string;
        status: string;
        matchScore: number;
        appliedAt: string;
      }>;
    }>('/api/v1/applications');
  }
}

export const api = new ApiClient();
