export default {
  '/api': {
    target: `http://localhost:${process.env['API_PORT'] ?? 3000}`,
    secure: false,
  },
};
