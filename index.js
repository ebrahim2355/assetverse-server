const express = require('express')
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

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
        const assetsCollection = db.collection("assets");
        const requestsCollection = db.collection("requests");
        const affiliationsCollection = db.collection("affiliations");
        const paymentsCollection = db.collection("payments");
        const packagesCollection = db.collection("packages");
        const testimonialsCollection = db.collection("testimonials");

        // PACKAGES APIs
        app.get("/packages", async (req, res) => {
            try {
                const result = await packagesCollection.find().toArray();
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: err.message });
            }
        });

        // TESTIMONIALS APIs
        app.get("/testimonials", async (req, res) => {
            try {
                const result = await testimonialsCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });


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

        app.get("/users/:email", async (req, res) => {
            try {
                const email = req.params.email;
                const user = await usersCollection.findOne({ email });
                res.send(user);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        app.get("/users/:email/role", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role })
        })

        app.patch("/users/:email", async (req, res) => {
            const email = req.params.email;
            const body = req.body;

            const updateQuery = {};

            if (body.$set) updateQuery.$set = body.$set;
            if (body.$inc) updateQuery.$inc = body.$inc;

            const result = await usersCollection.updateOne(
                { email },
                updateQuery
            );

            res.send(result);
        })

        // PAYMENT RELATED APIs
        app.post("/create-checkout-session", async (req, res) => {
            try {
                const { packageName, price, email, employeeLimit } = req.body;

                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ["card"],
                    mode: "payment",
                    customer_email: email,
                    metadata: {
                        plan: packageName,
                        limit: employeeLimit,
                        hrEmail: email
                    },
                    line_items: [
                        {
                            price_data: {
                                currency: "usd",
                                product_data: {
                                    name: `${packageName} Plan`,
                                },
                                unit_amount: price * 100,
                            },
                            quantity: 1,
                        },
                    ],
                    success_url: `${process.env.SITE_DOMAIN}/dashboard/hr/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/hr/upgrade?canceled=true`,
                });

                res.send({ url: session.url });

            } catch (error) {
                console.log(error);
                res.status(500).send({ error: error.message });
            }
        });

        app.get("/checkout-session/:id", async (req, res) => {
            try {
                const session = await stripe.checkout.sessions.retrieve(req.params.id);
                res.send(session);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        app.post("/payments", async (req, res) => {
            try {
                const payment = req.body;

                const exists = await paymentsCollection.findOne({
                    transactionId: payment.transactionId
                })

                if (exists) {
                    return res.send({ inserted: false, message: "Payment already recorded" });
                }

                payment.date = new Date();

                const result = await paymentsCollection.insertOne(payment);
                res.send(result);

            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

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

        // ALL ASSETS APIs
        app.get("/assets", async (req, res) => {
            const availableOnly = req.query.available === "true";
            let query = {};

            if (availableOnly) {
                query = { availableQuantity: { $gt: 0 } };
            }

            const assets = await assetsCollection.find(query).toArray();
            res.send(assets);
        });

        app.get("/assets/:hrEmail", async (req, res) => {
            const hrEmail = req.params.hrEmail;
            const assets = await assetsCollection.find({ hrEmail }).toArray();
            res.send(assets);
        });

        app.get("/assets/id/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await assetsCollection.findOne(query);
            res.send(result);
        });

        app.patch("/assets/:id", async (req, res) => {
            const id = req.params.id;
            const body = req.body;

            const updateQuery = {};

            if (body.$set) {
                updateQuery.$set = body.$set;
            }
            if (body.$inc) {
                updateQuery.$inc = body.$inc;
            }

            const result = await assetsCollection.updateOne(
                { _id: new ObjectId(id) },
                updateQuery
            );

            res.send(result);
        });

        app.post("/assets", /* verifyHR, */ async (req, res) => {
            try {
                const {
                    productName,
                    productImage = "",
                    productType,
                    productQuantity,
                    hrEmail,
                    companyName = ""
                } = req.body;

                // Basic validation
                if (!productName || !productType || typeof productQuantity !== "number" || !hrEmail) {
                    return res.status(400).send({
                        error: "Missing required fields. Required: productName, productType, productQuantity (number), hrEmail"
                    });
                }

                if (!["Returnable", "Non-returnable"].includes(productType)) {
                    return res.status(400).send({ error: "productType must be 'Returnable' or 'Non-returnable'" });
                }

                if (productQuantity < 0) {
                    return res.status(400).send({ error: "productQuantity must be >= 0" });
                }

                const assetDoc = {
                    productName,
                    productImage,
                    productType,
                    productQuantity,
                    availableQuantity: productQuantity,
                    dateAdded: new Date(),
                    hrEmail,
                    companyName
                };

                const result = await assetsCollection.insertOne(assetDoc);

                res.status(201).send({
                    message: "Asset created",
                    insertedId: result.insertedId,
                    asset: { ...assetDoc, _id: result.insertedId }
                });
            } catch (error) {
                console.error("POST /assets error:", error);
                res.status(500).send({ error: error.message });
            }
        });

        app.delete("/assets/:id", async (req, res) => {
            const id = new ObjectId(req.params.id);
            const result = await assetsCollection.deleteOne({ _id: id });
            res.send(result);
        });


        // REQUESTS APIs
        app.post("/requests", async (req, res) => {
            const data = req.body;
            data.requestDate = new Date();
            data.requestStatus = "pending";

            const result = await requestsCollection.insertOne(data);
            res.send(result);
        });

        app.get("/requests", async (req, res) => {
            const hrEmail = req.query.hrEmail;
            const result = await requestsCollection.find({ hrEmail }).toArray();
            res.send(result);
        });

        app.patch("/requests/:id", async (req, res) => {
            const id = new ObjectId(req.params.id);
            const update = req.body;

            const result = await requestsCollection.updateOne(
                { _id: id },
                { $set: update }
            );

            res.send(result);
        });

        // AFFILIATIONS APIS
        app.post("/affiliations", async (req, res) => {
            try {
                const affiliation = req.body;
                const { employeeEmail, hrEmail } = affiliation;

                // Check if already affiliated
                const exists = await affiliationsCollection.findOne({
                    employeeEmail,
                    hrEmail
                });

                if (exists) {
                    return res.send({ message: "Already affiliated", inserted: false });
                }

                affiliation.affiliationDate = new Date();
                affiliation.status = "active";

                const result = await affiliationsCollection.insertOne(affiliation);
                res.send(result);

            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        app.get("/affiliations/employee/:email", async (req, res) => {
            try {
                const email = req.params.email;

                const affiliations = await affiliationsCollection
                    .find({ employeeEmail: email })
                    .toArray();

                res.send(affiliations);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        app.get("/affiliations/team/:hrEmail", async (req, res) => {
            try {
                const hrEmail = req.params.hrEmail;

                const affiliations = await affiliationsCollection.find({ hrEmail }).toArray();

                const employeeEmails = affiliations.map(a => a.employeeEmail);

                const users = await usersCollection
                    .find({ email: { $in: employeeEmails } })
                    .toArray();

                res.send(users);

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