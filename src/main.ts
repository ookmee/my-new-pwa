import './app.css'
import './i18n'  // Import i18n before app
import App from './App.svelte'

// Wait a tiny bit for i18n to initialize
setTimeout(() => {
  const app = new App({
    target: document.getElementById('app')!,
  })
}, 10);

export default App
