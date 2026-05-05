# Pulse Product Slides

Standalone React/Vite slide deck for the Smart Pulse Oximeter Platform.

## Run

```bash
npm install -w slides
npm run dev -w slides
```

The slide app runs on `http://localhost:4174`.

## Environment

Copy `slides/.env.example` to `slides/.env` if you want the contact CTA to point at a specific running app:

```bash
cp slides/.env.example slides/.env
```

`VITE_MAIN_APP_URL` defaults to `http://localhost:5173`.
