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
        const db = client.db("assetverse_db");
        const usersCollection = db.collection("users");
        const assignedAssetsCollection = db.collection("assignedAssets");

        // USERS APIs
        app.post("/users/employee", async (req, res) => {
            try {
                const user = req.body;
                const email = user.email;
                user.role = "employee";
                user.createdAt = new Date();

                const userExist = await usersCollection.findOne({ email });
                if (userExist) {
                    return res.send({ message: "user exists" });
                }

                const result = await usersCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        })

        app.post("/users/hr", async (req, res) => {
            try {
                const user = req.body;
                const email = user.email;

                const userExist = await usersCollection.findOne({ email });
                if (userExist) {
                    return res.send({ message: "user exists" });
                }

                user.role = "hr";
                user.packageLimit = 5;
                user.currentEmployees = 0;
                user.subscription = "basic";
                user.createdAt = new Date();

                const result = await usersCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        })

        app.get("/users", async (req, res) => {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get("/users/:email/role", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            console.log(query.role)
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role })
        })

        // ASSIGNED ASSETS APIs
        app.get("/assigned-assets/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const query = { employeeEmail: email };
                const result = await assignedAssetsCollection.find(query).toArray();

                res.send(result);

            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        app.post("/assigned-assets", async (req, res) => {
            try {
                const assetData = req.body;

                // Required fields
                const {
                    assetId,
                    assetName,
                    assetImage,
                    assetType,
                    employeeEmail,
                    employeeName,
                    hrEmail,
                    companyName
                } = assetData;

                if (!assetId || !employeeEmail || !assetName) {
                    return res.status(400).send({ error: "Missing required fields" });
                }

                const newAssignedAsset = {
                    assetId,
                    assetName,
                    assetImage,
                    assetType,
                    employeeEmail,
                    employeeName,
                    hrEmail,
                    companyName,
                    assignmentDate: new Date(),
                    returnDate: null,
                    status: "assigned"
                };

                const result = await assignedAssetsCollection.insertOne(newAssignedAsset);

                res.send({
                    success: true,
                    message: "Asset assigned successfully",
                    insertedId: result.insertedId
                });

            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });


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