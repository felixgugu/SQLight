import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './assets/main.css';

// Prevent default browser/system context menu globally for a native desktop feel
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');
