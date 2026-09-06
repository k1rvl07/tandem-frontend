import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import autosize from './shared/directives/autosize'
import './styles/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.directive('autosize', autosize)

app.mount('#app')
