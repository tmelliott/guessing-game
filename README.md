This is a [Next.js](https://nextjs.org) project for hosting photo guessing games online.

## Features

- **Game Rooms**: Each game has a unique 6-letter join code
- **Cloud Storage**: Photos are stored in Vercel Blob Storage (works with serverless functions)
- **Real-time Updates**: Photo count updates automatically via Server-Sent Events (SSE)
- **Host or Join**: Landing page allows hosting a new game (with a topic) or joining with a code
- **Share Links**: Easy share links in the format `HOST_NAME/join/XXXXXX`

## Getting Started

First, run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How It Works

1. **Host a Game**: Click "Host a Game" on the landing page, enter a topic (e.g., "baby photos"), and get a 6-letter code
2. **Share the Link**: Share the join link (e.g., `yoursite.com/join/ABCDEF`) with players
3. **Join and Upload**: Players visit the join link, enter their name, and upload a photo
4. **Play**: Once photos are uploaded, start the game and guess who's in each photo!

## Setup

### Environment Variables

For Vercel Blob Storage to work, you need to set up the `GG_READ_WRITE_TOKEN` environment variable:

1. **On Vercel**: Go to your project settings → Environment Variables
2. **Add**: `GG_READ_WRITE_TOKEN` with your token from [Vercel Blob Dashboard](https://vercel.com/dashboard/stores)
3. **For local development**: Create a `.env.local` file:
   ```
   GG_READ_WRITE_TOKEN=your_token_here
   ```

### Installing Dependencies

```bash
bun install
```

## File Storage

Photos are stored in Vercel Blob Storage, which is compatible with serverless functions. Files are automatically managed by Vercel and don't require manual cleanup of temp directories.

### Automatic Cleanup

To set up automatic cleanup, you can:

1. **Use a CRON job** (on your server):
   ```bash
   # Run cleanup every hour
   0 * * * * curl -X POST https://your-domain.com/api/cleanup
   ```

2. **Use a service like cron-job.org** (free):
   - Set up a job to call `https://your-domain.com/api/cleanup` every hour
   - Both GET and POST methods work

3. **Use Vercel Cron** (if deploying on Vercel):
   Add to `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cleanup",
       "schedule": "0 * * * *"
     }]
   }
   ```

The cleanup endpoint removes games older than 24 hours. Blob files are managed by Vercel Blob Storage and cleaned up automatically based on your storage settings.

## Real-time Updates

The join page uses Server-Sent Events (SSE) to update the photo count in real-time. When a player uploads a photo, all users viewing the join page will see the count update automatically without refreshing.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
