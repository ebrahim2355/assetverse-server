const express = require('express')
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
require("dotenv").config();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rlqi2bh.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        await client.connect();

        const db = client.db("assetverse_db");


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Assetverse server loading...')
})

app.listen(port, () => {
    console.log(`Your server app is listening on port ${port}`)
})