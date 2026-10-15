// Point d'entrée de l'interface Vue.
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { chargerSession } from './store.js';
import './assets/style.css';

// La session est chargée avant le premier affichage pour que le routeur connaisse l'utilisateur.
chargerSession().finally(() => {
  createApp(App).use(router).mount('#app');
});
