export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // Ensure CSS is properly minified and optimized for production
    ...(process.env.NODE_ENV === 'production' && {
      cssnano: {
        preset: ['default', {
          discardComments: {
            removeAll: true,
          },
        }]
      }
    })
  },
}
