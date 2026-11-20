import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' gerir slóðir afstæðar svo síðan virki undir
// https://<notandi>.github.io/<repo>/ á GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()]
})
