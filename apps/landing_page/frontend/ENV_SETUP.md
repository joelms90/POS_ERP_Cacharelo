# Environment Variables Setup

## CARTO Maps API Key Setup

The landing page uses CARTO maps for displaying locations. You need to set up an API key to use the map tiles.

### Getting Your CARTO API Key

1. Visit [CARTO](https://carto.com/)
2. Sign up for a free account or log in
3. Navigate to your dashboard
4. Go to **API Keys** section
5. Copy your API key

### Setting Up Locally

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and replace `YOUR_CARTO_API_KEY_HERE` with your actual API key:
   ```
   VITE_CARTO_API_KEY=your_actual_api_key_here
   ```

3. Save the file

### Setting Up for Production

Update the `.env.production` file with your production API key:
```
VITE_CARTO_API_KEY=your_production_api_key_here
```

### Important Notes

- The `.env` file is in `.gitignore` and will NOT be committed to git
- Never commit API keys to the repository
- Use different API keys for development and production environments
- The map will fall back to a basic dark theme if no API key is provided

### Testing

After setting up your API key, run the development server:
```bash
npm run dev
```

The map should now display with the Voyager theme from CARTO.
