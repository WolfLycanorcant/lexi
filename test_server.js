import express from 'express';
const app = express();
const PORT = 3002;
app.get('/', (req, res) => res.send('ok'));
app.listen(PORT, () => console.log(`Test server running on ${PORT}`));
