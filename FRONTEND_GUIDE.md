# JobDog Frontend Development Guide

**Backend API:** `http://localhost:8080` (local) or your deployed URL

---

## Recommended Tech Stack

### Modern React Setup
```bash
npx create-next-app@latest jobdog-frontend
# Choose: TypeScript, Tailwind CSS, App Router
```

**Why Next.js:**
- Server-side rendering for SEO
- Built-in API routes
- Easy deployment to Vercel
- Great TypeScript support

### Alternative: Vite + React
```bash
npm create vite@latest jobdog-frontend -- --template react-ts
cd jobdog-frontend
npm install
```

---

## Core Pages to Build

### 1. Landing Page (`/`)
- Hero section with value proposition
- Job search preview
- Call-to-action to sign up

### 2. Job Board (`/jobs`)
- List all active jobs from API
- Filters: location, company, keywords
- Search functionality
- Pagination

### 3. Job Detail (`/jobs/[id]`)
- Full job description
- Company info
- Apply button (requires auth)
- Match score if user has resume

### 4. Auth Pages
- `/login` - User login
- `/register` - User registration
- `/profile` - User profile (authenticated)

### 5. Resume Management (`/resumes`)
- Upload resume (PDF)
- View uploaded resumes
- Delete/update resumes
- Resume parsing status

### 6. Applications (`/applications`)
- View all applications
- Application status
- Match scores
- Application history

---

## API Integration Examples

### Setup API Client

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('jwt_token', token);
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('jwt_token');
    }
    return this.token;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string, displayName: string) {
    const data = await this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  // Jobs
  async getJobs() {
    return this.request('/api/v1/jobs');
  }

  // Resumes
  async uploadResume(file: File, label?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (label) formData.append('label', label);

    const response = await fetch(`${API_BASE}/api/v1/resumes/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: formData,
    });

    return response.json();
  }

  async getResumes() {
    return this.request('/api/v1/resumes');
  }

  // Applications
  async createApplication(jobId: string, resumeId: string) {
    return this.request('/api/v1/applications', {
      method: 'POST',
      body: JSON.stringify({ jobId, resumeId }),
    });
  }

  async getApplications() {
    return this.request('/api/v1/applications');
  }
}

export const api = new ApiClient();
```

### Job Board Component

```typescript
// components/JobBoard.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Job {
  jobId: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  postedAt: string;
  applyUrl: string;
}

export default function JobBoard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getJobs()
      .then(data => {
        setJobs(data.items);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch jobs:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading jobs...</div>;

  return (
    <div className="grid gap-4">
      {jobs.map(job => (
        <div key={job.jobId} className="border rounded-lg p-4 hover:shadow-lg transition">
          <h3 className="text-xl font-bold">{job.title}</h3>
          <p className="text-gray-600">{job.company}</p>
          <p className="text-sm text-gray-500">{job.location}</p>
          <div className="mt-2 flex gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              {job.employmentType}
            </span>
            <span className="text-xs text-gray-500">
              Posted {new Date(job.postedAt).toLocaleDateString()}
            </span>
          </div>
          <a 
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Apply Now
          </a>
        </div>
      ))}
    </div>
  );
}
```

### Resume Upload Component

```typescript
// components/ResumeUpload.tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadResume(file, label);
      alert('Resume uploaded successfully!');
      setFile(null);
      setLabel('');
    } catch (err) {
      alert('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 border rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Upload Resume</h2>
      
      <input
        type="text"
        placeholder="Resume label (optional)"
        value={label}
        onChange={e => setLabel(e.target.value)}
        className="w-full px-3 py-2 border rounded mb-4"
      />

      <input
        type="file"
        accept=".pdf"
        onChange={e => setFile(e.target.files?.[0] || null)}
        className="w-full mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {uploading ? 'Uploading...' : 'Upload Resume'}
      </button>
    </div>
  );
}
```

---

## Environment Variables

Create `.env.local` in your frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

For production:
```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

---

## CORS Configuration

Your backend already has CORS enabled for `http://localhost:3000` (default Next.js port).

For production, update `services/backend-api/src/main/java/dev/jobdog/backend/config/CorsConfig.java`:

```java
.allowedOrigins("https://your-frontend-domain.com")
```

---

## Deployment Options

### Frontend Deployment

**Vercel (Recommended for Next.js):**
```bash
npm i -g vercel
vercel
```

**Netlify:**
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Backend Deployment

**Railway:**
- Free tier available
- Auto-deploys from GitHub
- Provisions PostgreSQL
- Gives you a public URL

**Render:**
- Free tier available
- Docker support
- Managed PostgreSQL

**Fly.io:**
- Free tier available
- Global edge deployment
- Great for Docker

---

## Full Stack Deployment Example

### 1. Deploy Backend to Railway

```bash
cd /home/kori/Coding/jobdog
railway login
railway init
railway up
```

You'll get: `https://jobdog-production.up.railway.app`

### 2. Deploy Frontend to Vercel

```bash
cd jobdog-frontend
vercel
```

Set environment variable:
```
NEXT_PUBLIC_API_URL=https://jobdog-production.up.railway.app
```

### 3. Update Backend CORS

Add your Vercel URL to allowed origins in `CorsConfig.java`

---

## Next Steps

1. **Choose frontend framework** (Next.js recommended)
2. **Build core pages** (jobs, auth, resumes)
3. **Test locally** with backend at `localhost:8080`
4. **Deploy backend** to Railway/Render
5. **Deploy frontend** to Vercel/Netlify
6. **Update CORS** with production URLs

---

## Need Help?

- Backend API docs: See `DEPLOYMENT.md`
- Scraper status: See `SCRAPER_STATUS.md`
- API is fully functional and ready for frontend integration
