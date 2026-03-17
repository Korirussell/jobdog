# OAuth Setup Guide

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen if needed
6. Application type: Web application
7. Add authorized redirect URIs:
   - Development: `http://localhost:8080/login/oauth2/code/google`
   - Production: `https://yourdomain.com/login/oauth2/code/google`
8. Copy Client ID and Client Secret

## GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in application details:
   - Application name: JobDog
   - Homepage URL: `http://localhost:3000` (or your domain)
   - Authorization callback URL: `http://localhost:8080/login/oauth2/code/github`
4. Click "Register application"
5. Copy Client ID
6. Generate a new client secret and copy it

## Environment Variables

Add these to your backend `.env` file or environment:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

## Testing OAuth Flow

1. Start the backend: `cd services/backend-api && mvn spring-boot:run`
2. Start the frontend: `cd services/frontend && npm run dev`
3. Navigate to `http://localhost:3000/login`
4. Click "Continue with Google" or "Continue with GitHub"
5. Complete OAuth flow
6. You should be redirected back with a JWT token

## Production Deployment

When deploying to production:

1. Update redirect URIs in Google Cloud Console and GitHub OAuth App
2. Set production environment variables
3. Ensure HTTPS is enabled
4. Update CORS configuration if needed
