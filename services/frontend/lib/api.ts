const API_BASE = process.env.NODE_ENV === 'production' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');

export interface BulletFeedback {
  original: string;
  score: number;
  issue: string;
  improved: string;
}

export interface RecruiterTakeItem {
  section: string;
  grade: string;
  comment: string;
  red_flags: string[];
}

export interface AtsParsedSections {
  name?: string;
  contact?: string;
  education?: string[];
  experience?: string[];
  projects?: string[];
  skills?: string[];
  certifications?: string[];
  missing_sections?: string[];
}

export interface ResumeAnalysis {
  analysisId: string;
  resumeId: string;
  userLevel: string;
  targetRole: string;
  overallScore: number;
  atsScore: number;
  atsIssues: string[];
  sectionScores: Record<string, number>;
  bulletFeedback: BulletFeedback[];
  strengths: string[];
  improvements: string[];
  summaryVerdict: string;
  atsParsedSections?: AtsParsedSections;
  recruiterTake?: RecruiterTakeItem[];
  analyzedAt: string;
}

export interface JobFitResult {
  fitId: string;
  resumeId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  fitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  fitSummary: string;
  analyzedAt: string;
}

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
      // If the token is expired/invalid, clear it and redirect to login
      if (response.status === 401) {
        this.clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?session=expired';
        }
        throw new Error('Session expired. Please log in again.');
      }

      const responseText = await response.text().catch(() => "");
      let message = `API ${response.status}: ${response.statusText}`;
      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          message = parsed.message || parsed.error || message;
        } catch {
          message = responseText.slice(0, 300) || message;
        }
      }
      throw new Error(message);
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string, displayName: string) {
    const data = await this.request<{ userId: string; email: string; displayName: string; token: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ userId: string; email: string; displayName: string; token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async me() {
    return this.request<{ userId: string; email: string; displayName: string }>('/api/v1/auth/me');
  }

  logout() {
    this.clearToken();
  }

  // Jobs
  async getJobs(params?: URLSearchParams) {
    const qs = params ? `?${params.toString()}` : '';
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
    }>(`/api/v1/jobs${qs}`);
  }

  // Resumes
  async uploadResume(file: File, label?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (label) formData.append('label', label);

    const token = this.getToken();
    const response = await fetch(`${API_BASE}/api/v1/resumes`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?session=expired';
        }
        throw new Error('Session expired. Please log in again.');
      }
      let msg = `Upload failed (${response.status})`;
      try {
        const body = await response.json();
        if (body?.message) msg = body.message;
      } catch {}
      throw new Error(msg);
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

  async deleteResume(resumeId: string) {
    return this.request<void>(`/api/v1/resumes/${resumeId}`, { method: 'DELETE' });
  }

  async getPublicProfile(userId: string) {
    return this.request<{
      userId: string;
      displayName: string;
      topScore?: {
        overallScore: number;
        atsScore: number;
        sectionScores: Record<string, number>;
        strengths: string[];
        summaryVerdict: string;
        userLevel: string;
        targetRole: string;
        analyzedAt: string;
      };
    }>(`/api/v1/public/profile/${userId}`);
  }

  // Applications
  async createApplication(jobId: string, resumeId: string) {
    return this.request<{
      applicationId: string;
      matchScore: number;
      benchmarkState: string;
      percentile: number | null;
      applicantCount: number;
      earlyApplicantMessage: string | null;
    }>(`/api/v1/jobs/${jobId}/applications`, {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });
  }

  async getApplications() {
    return this.request<Array<{
      applicationId: string;
      jobId: string;
      jobTitle: string;
      company: string;
      status: string;
      resumeId: string;
      resumeName: string;
      matchScore: number;
      percentile: number | null;
      applicantCount: number;
      appliedAt: string;
    }>>('/api/v1/applications');
  }

  async updateApplicationStatus(applicationId: string, status: string) {
    return this.request<void>(`/api/v1/applications/${applicationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Saved Jobs
  async saveJob(jobId: string) {
    return this.request<{ savedJobId: string; jobId: string }>('/api/v1/saved-jobs', {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    });
  }

  async unsaveJob(jobId: string) {
    return this.request<void>(`/api/v1/saved-jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  async getSavedJobs() {
    return this.request<{
      items: Array<{
        jobId: string;
        title: string;
        company: string;
        location: string;
        employmentType: string;
        postedAt: string | null;
        scrapedAt: string;
        jobStatus: string;
        applyUrl: string;
        savedAt: string;
      }>;
    }>('/api/v1/saved-jobs');
  }

  // Resume Roaster
  async roastResume(resumeId: string, jobId?: string) {
    return this.request<{
      brutalRoastText: string;
      missingDependencies: string[];
      topDogRank: number;
      tierName: string;
    }>('/api/v1/roast', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jobId: jobId ?? null }),
    });
  }

  // Resume Analysis
  async getResumeAnalysis(resumeId: string) {
    const response = await fetch(`${API_BASE}/api/v1/resume-analysis/${resumeId}`, {
      headers: { ...(this.getToken() ? { 'Authorization': `Bearer ${this.getToken()}` } : {}) },
    });
    if (response.status === 204) return null;
    if (!response.ok) {
      if (response.status === 401) { this.clearToken(); if (typeof window !== 'undefined') window.location.href = '/login?session=expired'; throw new Error('Session expired.'); }
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || `Error ${response.status}`);
    }
    return response.json() as Promise<ResumeAnalysis>;
  }

  async analyzeResume(resumeId: string, userLevel: string, targetRole: string) {
    return this.request<ResumeAnalysis>('/api/v1/resume-analysis', {
      method: 'POST',
      body: JSON.stringify({ resumeId, userLevel, targetRole }),
    });
  }

  async getJobFitAnalysis(resumeId: string, jobId: string) {
    return this.request<JobFitResult>('/api/v1/resume-analysis/job-fit', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jobId }),
    });
  }

  // Ghost Score
  async getGhostScore(company: string) {
    return this.request<{
      company: string;
      ghostScore: number;
      avgDaysOpen: number;
      ghostReports: number;
      totalJobs: number;
    }>(`/api/v1/ghost-score?company=${encodeURIComponent(company)}`);
  }

  // Roast endpoints
  async roastJob(resumeId: string, jobId: string | null) {
    return this.request<{
      brutalRoastText: string;
      missingDependencies: string[];
      topDogRank: number;
      tierName: string;
    }>('/api/v1/roast', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jobId }),
    });
  }

  async getRoastHistory() {
    return this.request<{ items: any[] }>('/api/v1/roast/history');
  }

  // Benchmark endpoints
  async getBenchmarks() {
    return this.request<{ items: any[] }>('/api/v1/jobs/benchmarks');
  }
}

export const api = new ApiClient();
