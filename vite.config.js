import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/InterviewPrepHub/',
  plugins: [react()],
  resolve: {
    alias: {
      '@notes': path.resolve(__dirname, 'Notes/SystemDesign'),
    },
  },
  assetsInclude: ['**/*.md'],
})
