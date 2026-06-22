const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();
const app = express();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URL;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    // Database and collections defined
    const db = client.db("GymX-Auth");
    const classesCollection = db.collection("classes");
    const bookingsCollection = db.collection("bookings");
    const forumsCollection = db.collection("forums");

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    // 1. ------Trainer Overview (Overview)-------
    app.get("/api/trainer-stats/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const totalClasses = await classesCollection.countDocuments({
          trainerEmail: email,
        });

        const totalStudents = await bookingsCollection.countDocuments({
          trainerEmail: email,
        });

        res.send({
          success: true,
          stats: { totalClasses, totalStudents },
        });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // 2. -------Add Trainer New Class (Add Class)--------
    app.post("/api/classes", async (req, res) => {
      const newClass = req.body;

      const classData = {
        ...newClass,
        status: "Pending",
        bookingCount: 0,
        createdAt: new Date(),
      };

      try {
        const result = await classesCollection.insertOne(classData);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // 3. --------Show Trainer All Clases (My Class)---------
    //  Get All Classes API
    app.get("/api/my-classes/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const query = { trainerEmail: email };
        const result = await classesCollection.find(query).toArray();
        res.send({ success: true, classes: result });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // Update Classes API
    app.put("/api/classes/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          className: updatedData.className,
          category: updatedData.category,
          difficultyLevel: updatedData.difficultyLevel,
          duration: updatedData.duration,
          "classSchedule.days": updatedData.classSchedule.days,
          "classSchedule.time": updatedData.classSchedule.time,
          price: updatedData.price,
          description: updatedData.description,
        },
      };

      try {
        const result = await classesCollection.updateOne(filter, updateDoc);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // Delete Class API
    app.delete("/api/classes/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const result = await classesCollection.deleteOne(query);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // API to view Attendees (Students) of a specific class
    app.get("/api/class-students/:className", async (req, res) => {
      const className = req.params.className;
      try {
        const query = { bookedClassName: className };
        const students = await bookingsCollection.find(query).toArray();
        res.send({ success: true, students });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // 4. -------Triner Create Forum Post (Add Forum Post)----------
    // New Forum Post Add API
    app.post("/api/forums", async (req, res) => {
      const newPost = req.body;

      const postData = {
        ...newPost,
        upvotes: 0,
        downvotes: 0,
        createdAt: new Date(),
      };

      try {
        const result = await forumsCollection.insertOne(postData);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // 5. ------Show Trainer Forum Posts (My Forum Posts)--------
    // All Forum post Get API
    app.get("/api/my-forums/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const query = { authorEmail: email };
        const result = await forumsCollection.find(query).toArray();
        res.send({ success: true, forums: result });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // Forum Post Delete API
    app.delete("/api/forums/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const result = await forumsCollection.deleteOne(query);
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });
    
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`◇ GymX Backend Server listening on port ${port}`);
});
