import { init, register, getLocaleFromNavigator, locale, addMessages } from 'svelte-i18n';

// Register locales
register('en', () => import('./locales/en.json'));
register('es', () => import('./locales/es.json'));

// Add fallback messages for immediate use while lazy-loading
addMessages('en', {
  app: {
    title: 'My Progressive Web App',
    welcome: 'Welcome to my PWA!'
  }
});

// Initialize
init({
  fallbackLocale: 'en',
  initialLocale: getLocaleFromNavigator() || 'en',
});

// Explicitly set to English if detection fails
setTimeout(() => {
  locale.update(current => current || 'en');
}, 10);
