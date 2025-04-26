import './app.css'
import App from './App.svelte'

// Use the compatibility API for Svelte 5
const target = document.getElementById('app');
if (target) {
  // @ts-ignore - Needed for Svelte 5
  new App({ target });
}
