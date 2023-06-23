const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

//middleware 
app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
    if(!authorization){
      return res.status(401).send({error: true, message: 'Unauthorized Access'})
    };
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.TOKEN_SECRET, (error, decoded) => {
    if(error){
      return res.status(403).send({error: true, message: 'Unauthorized Access'})
    }
    res.decoded = decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster1.some2ew.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db('RSHNetowrk').collection('users');
    const consultantCollection = client.db('RSHNetowrk').collection('consultants');
    

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {expiresIn: '1h'});
      res.send({token});
    })
    /* *********************************************
     * Add doctors api
    ************************************************/
    app.post('/consultants', async (req, res) => {
      // const newConsultant
      const newConsultant = req.body;
      const result = await consultantCollection.insertOne(newConsultant);
      res.send(result);
    })

    app.get('/consultants', async (req, res) => {
      const result = await consultantCollection.find().toArray();
      res.send(result);
    })


    /* *********************************************
     * Users Authorization and Verification Routes
    ************************************************/

    app.post('/users', async (req, res) => {
        const newUser = req.body;
        const query = {email: newUser.email};
        const searchResult = await userCollection.findOne(query);
        
        if(searchResult){
            return res.send({error: true, message: "User Already Registered"})
        }
        else{
            const result = await userCollection.insertOne(newUser);
            res.send(result);
        }
    })

    app.get('/users',verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    // TODO: secure this api
    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.findOne(query);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('RUSHMONO Network Server')
})

app.listen(port, () => {
    console.log('RSH Server running on port:', port);
})