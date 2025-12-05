const express = require('express')
const cors = require("cors");
const app = express()
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send('Assetverse server loading...')
})

app.listen(port, () => {
    console.log(`Your server app is listening on port ${port}`)
})