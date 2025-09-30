import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Swal from 'sweetalert2'
import App from './App.vue'
import router from './router'
import '@shared/styles/style.css'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// Add SweetAlert2 as global property
app.config.globalProperties.$swal = Swal

app.use(pinia)
app.use(router)

app.mount('#app')