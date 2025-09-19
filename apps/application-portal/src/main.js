import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { authManager } from './services/auth.js'

// Import Bootstrap and BootstrapVue CSS files (order is important)
import '@popperjs/core'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import '@bootstrap-icons/font/bootstrap-icons.css'

// Import shared styles after Bootstrap to allow overrides
import '@shared/styles/style.css'

const app = createApp(App)

// Initialize auth manager before mounting
authManager.initializeFromStorage()

app.use(router)
app.mount('#app')
