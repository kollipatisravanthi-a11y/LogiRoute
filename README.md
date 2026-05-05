# LogiRoute

A simple logistics frontend prototype with role-based entry points (Owner / Customer) and supporting JS modules.

## Run locally

Option A (Python):

```bash
cd frontend
python -m http.server 5173
```

Then open:

- http://localhost:5173/

Option B (VS Code Live Server):

- Open `frontend/index.html`
- Click **Go Live**

## Project structure

- `frontend/index.html` – app entry
- `frontend/assets/css/styles.css` – styling
- `frontend/assets/js/` – application logic (auth, state, owner/customer flows, maps)

## Notes

This project is static (no backend). Data is currently stored/handled in the frontend code.
