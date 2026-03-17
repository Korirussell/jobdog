# Environment Setup

Create a `.env.local` file in the `services/frontend` directory with the following content:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8080
```

For production deployment, change to your deployed backend URL:

```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

## Quick Setup

```bash
cd services/frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
npm run dev
```

Then visit http://localhost:3000
