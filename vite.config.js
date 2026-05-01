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
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split heavy vendor libs and rarely-used app modules into their own
        // chunks. Markdown libs are only needed when a note is opened; QnA
        // parsing is only needed for the practice tab.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-markdown') || id.includes('remark-') ||
                id.includes('rehype-') || id.includes('mdast-') ||
                id.includes('hast-') || id.includes('micromark') ||
                id.includes('unist-')) return 'markdown';
            if (id.includes('react-dom')) return 'react-vendor';
            if (id.includes('@libsql')) return 'libsql';
          }
          if (id.includes('/data/qna.js')) return 'qna';
        },
      },
    },
  },
})
