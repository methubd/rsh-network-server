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
    req.decoded = decoded;
    
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
    const appointmentsCollection = client.db('RSHNetowrk').collection('appointments');
    const servicesCollection = client.db('RSHNetowrk').collection('services');
    const patientReviewCollection = client.db('RSHNetowrk').collection('patientReview');
    const healthPackageCollection = client.db('RSHNetowrk').collection('healthPackage');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {expiresIn: '1h'});
      res.send({token});
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);

      if (user?.role !== 'admin'){
        res.status(403).send({
          error: true,
          message: "Forbidden Access",
        })
      }
      next();
    }
    /* *********************************************
     * Services Api
    ************************************************/

    app.get('/feature-services', async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result)
    })

    /* *********************************************
     * Health Packages
    ************************************************/

    app.get('/health-packages', async (req, res) => {
      const result = await healthPackageCollection.find().toArray();
      res.send(result);
    })

    app.get('/health-packages/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await healthPackageCollection.findOne(query);
      res.send(result);
    })

    /* *********************************************
     * Patient Review Api
    ************************************************/

    app.post('/patient-review', verifyJWT, async (req, res) => {
      const patientReview = req.body;
      const email = patientReview.ptEmail;
      const query = {ptEmail: email}
      const previousReview = await patientReviewCollection.findOne(query);

      if (previousReview) {
        return res.send({duplicate: true, message: 'One patient can add review for one time.'})
      }
      
      else{
        const result = await patientReviewCollection.insertOne(patientReview);
        res.send(result)
      }      
    })

    app.get('/patient-review', async (req, res) => {
      const result = await patientReviewCollection.find().toArray();
      res.send(result)
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

    app.delete('/consultants/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await consultantCollection.deleteOne(query);
      res.send(result)
    })

    app.get('/consultants', async (req, res) => {
      const result = await consultantCollection.find().toArray();
      res.send(result);
    })

    app.get('/consultant/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await consultantCollection.findOne(query);
      res.send(result)
    })

    /* *********************************************
     * Booked Appointment Routes
    ************************************************/

    app.post('/appointments', async (req, res) => {
      const newAppointment = req.body;
      const result = await appointmentsCollection.insertOne(newAppointment);
      res.send(result);
    })

    app.get('/appointments/:userEmail', verifyJWT, async (req, res) => {
      const email = req.params.userEmail;
      const query = {userEmail: email}
      const result = await appointmentsCollection.find(query).toArray();
      res.send(result)
    })

    app.delete('/appointments/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await appointmentsCollection.deleteOne(query);
      res.send(result)
    })    

    /* *********************************************
     * Users Authorization and Verification Routes
    ************************************************/

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const result = {admin : user?.role === 'admin'}
      res.send(result.admin)
    })

    //TODO: secure api
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

    app.get('/users',verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.put('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const request = req.body;
      const email = request.email;
      const filter = {email: email};      
      const options = {upsert: true}

      const newRole =  {
        $set: {
          role: request.role,
        }
      }
      const result = await userCollection.updateOne(filter, newRole, options)
      res.send(result)

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