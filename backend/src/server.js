const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend UD. Alam Makmur Jaya aktif di http://localhost:${PORT}`);
});
