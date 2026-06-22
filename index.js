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
    const favoritesCollection = db.collection("favorites");
    const trainerApplicationsCollection = db.collection("trainer-applications");

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    //==================================================================================================================================
    //                                                           TRAINER                                                              ||
    //==================================================================================================================================
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

    //==================================================================================================================================
    //                                                           USER                                                                 ||
    //==================================================================================================================================
    // 1. Get User Dashboard Overview Statistics & Status (UPDATED)
    app.get("/api/user-overview/:email", async (req, res) => {
      const { email } = req.params;

      try {
        // ১. টোটাল বুকড ক্লাস কাউন্ট
        const totalBookedClasses = await db
          .collection("bookings")
          .countDocuments({ userEmail: email });

        // ২. টোটাল ফেভারিট কাউন্ট
        const totalFavorites = await db
          .collection("favorites")
          .countDocuments({ userEmail: email });

        // ৩. ট্রেইনার অ্যাপ্লিকেশনের বর্তমান স্ট্যাটাস ও ফিডব্যাক খোঁজা
        const trainerApplication = await db
          .collection("trainer-applications")
          .findOne(
            { email: email },
            { projection: { status: 1, feedback: 1 } },
          );

        // 🛠️ ৪. ফিক্স: সরাসরি 'user' কালেকশন থেকে লেটেস্ট রোল খুঁজে বের করা
        const userDetails = await db
          .collection("user")
          .findOne({ email: email }, { projection: { role: 1 } });

        const applicationStatus = trainerApplication?.status || "Not Applied";
        const adminFeedback = trainerApplication?.feedback || null;
        const currentRole = userDetails?.role || "user"; // 👈 লেটেস্ট রোল

        res.status(200).json({
          success: true,
          stats: {
            totalBookedClasses,
            totalFavorites,
          },
          application: {
            status: applicationStatus,
            feedback: adminFeedback,
          },
          role: currentRole, // 👈 ফ্রন্টএন্ডে পাঠানোর জন্য রোলটি যোগ করা হলো
        });
      } catch (error) {
        console.error("Error fetching user overview data:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // 2. Get All Booked Classes for a Specific User
    app.get("/api/my-bookings/:email", async (req, res) => {
      const { email } = req.params;

      try {
        const query = { userEmail: email };
        // বুকিং করা ক্লাসগুলো লেটেস্ট ডেট অনুযায়ী সর্ট হয়ে আসবে
        const bookings = await bookingsCollection
          .find(query)
          .sort({ bookingDate: -1 })
          .toArray();

        res.status(200).json({
          success: true,
          bookings,
        });
      } catch (error) {
        console.error("Error fetching booked classes:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 3. Post a Trainer Application
    app.post("/api/trainer-applications", async (req, res) => {
      const { name, email, image, experience, specialty, bio } = req.body;

      try {
        // ১. চেক করুন এই ইমেইল দিয়ে অলরেডি কোনো অ্যাপ্লিকেশন আছে কি না
        const isApplied = await trainerApplicationsCollection.findOne({
          email,
        });

        if (isApplied) {
          return res.status(400).json({
            success: false,
            message:
              "You have already submitted an application. Current status: " +
              isApplied.status,
          });
        }

        // ২. নতুন অ্যাপ্লিকেশনের ডাটা স্ট্রাকচার
        const applicationData = {
          name,
          email,
          image,
          experience: parseInt(experience), // সংখ্যায় কনভার্ট করা হলো
          specialty,
          bio,
          status: "Pending", // 👈 ডিফল্ট স্ট্যাটাস পেন্ডিং
          feedback: null,
          appliedAt: new Date(),
        };

        const result =
          await trainerApplicationsCollection.insertOne(applicationData);
        res.status(201).json({
          success: true,
          message: "Application submitted successfully!",
          result,
        });
      } catch (error) {
        console.error("Error submitting trainer application:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 4. Get All Favorite Classes for a Specific User
    app.get("/api/my-favorites/:email", async (req, res) => {
      const { email } = req.params;

      try {
        const query = { userEmail: email };
        // লেটেস্ট যোগ করা ফেভারিট ক্লাসগুলো আগে দেখাবে
        const favorites = await favoritesCollection
          .find(query)
          .sort({ addedAt: -1 })
          .toArray();

        res.status(200).json({
          success: true,
          favorites,
        });
      } catch (error) {
        console.error("Error fetching favorite classes:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //==================================================================================================================================
    //                                                           ADMIN                                                                ||
    //==================================================================================================================================
    // 1. Get Admin Dashboard------(Overview)
    app.get("/api/admin-overview", async (req, res) => {
      try {
        // 🛠️ ফিক্স: কালেকশনের নাম 'user' করা হলো
        const totalUsers = await db.collection("user").countDocuments({});
        const totalClasses = await classesCollection.countDocuments({});
        const totalBookedClasses = await bookingsCollection.countDocuments({});

        res.status(200).json({
          success: true,
          stats: {
            totalUsers,
            totalClasses,
            totalBookedClasses,
          },
        });
      } catch (error) {
        console.error("Error fetching admin overview data:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // 2. Get All Registered Users-------(Manage Users)
    app.get("/api/admin/users", async (req, res) => {
      try {
        // 🛠️ ফিক্স: কালেকশনের নাম 'user' করা হলো
        const users = await db.collection("user").find({}).toArray();
        res.status(200).json({ success: true, users });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Toggle Block / Unblock Status-Soft Block
    app.patch("/api/admin/users/toggle-block/:id", async (req, res) => {
      const { id } = req.params;
      const { currentStatus } = req.body;

      const newStatus = currentStatus === "Blocked" ? "Active" : "Blocked";

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status: newStatus } };

        const result = await db.collection("user").updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.status(200).json({
            success: true,
            message: `User status updated to ${newStatus}`,
          });
        } else {
          res.status(404).json({ success: false, message: "User not found" });
        }
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Promote Standard User to Admin
    app.patch("/api/admin/users/make-admin/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: "admin" } }; // 👈 🛠️ ফিক্স: রোল ছোট হাতের 'admin' করা হলো

        const result = await db.collection("user").updateOne(filter, updateDoc); // 👈 🛠️ ফিক্স: কালেকশন 'user' করা হলো

        if (result.modifiedCount > 0) {
          res.status(200).json({
            success: true,
            message: "User successfully promoted to Admin",
          });
        } else {
          res.status(404).json({
            success: false,
            message: "User not found or already an Admin",
          });
        }
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 3. Get All Pending Trainer Applications-------(Applied Trainer)
    app.get("/api/admin/trainer-applications/pending", async (req, res) => {
      try {
        const applications = await db
          .collection("trainer-applications")
          .find({ status: "Pending" })
          .toArray();
        res.status(200).json({ success: true, applications });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Approve Trainer Application
    app.patch(
      "/api/admin/trainer-applications/approve/:id",
      async (req, res) => {
        const { id } = req.params;
        const { email, feedback } = req.body;

        try {
          // ক) অ্যাপ্লিকেশন স্ট্যাটাস আপডেট
          const appFilter = { _id: new ObjectId(id) };
          const appUpdate = {
            $set: {
              status: "Approved",
              feedback: feedback || "Your application has been approved.",
            },
          };
          await db
            .collection("trainer-applications")
            .updateOne(appFilter, appUpdate);

          // খ) 🛠️ ফিক্সড: কালেকশনের নাম 'user' (users নয়) এবং রোল ছোট হাতের 'trainer'
          const userFilter = { email: email };
          const userUpdate = { $set: { role: "trainer" } };
          await db.collection("user").updateOne(userFilter, userUpdate);

          res
            .status(200)
            .json({ success: true, message: "Trainer approved successfully" });
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      },
    );

    // Reject Trainer Application
    app.patch(
      "/api/admin/trainer-applications/reject/:id",
      async (req, res) => {
        const { id } = req.params;
        const { feedback } = req.body;

        if (!feedback) {
          return res.status(400).json({
            success: false,
            message: "Feedback is required for rejection",
          });
        }

        try {
          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: {
              status: "Rejected",
              feedback: feedback,
            },
          };

          await db
            .collection("trainer-applications")
            .updateOne(filter, updateDoc);
          res.status(200).json({
            success: true,
            message: "Application rejected with feedback",
          });
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      },
    );

    // 4. Get All Active Trainers---------(Manage Trainers)
    app.get("/api/admin/trainers", async (req, res) => {
      try {
        // 🛠️ ফিক্সড: কালেকশন 'user' এবং রোল ছোট হাতের 'trainer'
        const trainers = await db
          .collection("user")
          .find({ role: "trainer" })
          .toArray();
        res.status(200).json({ success: true, trainers });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Demote Trainer to Regular User
    app.patch("/api/admin/trainers/demote/:email", async (req, res) => {
      const { email } = req.params;

      try {
        // 🛠️ ফিক্সড: রোল ছোট হাতের "user" এবং কালেকশন 'user'
        const userUpdate = await db
          .collection("user")
          .updateOne({ email: email }, { $set: { role: "user" } });

        await db.collection("trainer-applications").updateOne(
          { email: email },
          {
            $set: {
              status: "Demoted",
              feedback: "Demoted to regular user by Admin.",
            },
          },
        );

        if (userUpdate.modifiedCount > 0) {
          res.status(200).json({
            success: true,
            message: "Trainer successfully demoted to user",
          });
        } else {
          res.status(404).json({
            success: false,
            message: "User not found or not a trainer",
          });
        }
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 5. Get All Classes---------(Manage Classes)
    app.get("/api/admin/classes", async (req, res) => {
      try {
        // সব ক্লাস ডাটাবেজ থেকে ক্রিয়েট হওয়ার লেটেস্ট টাইম অনুযায়ী সর্ট করে আনা
        const classes = await db
          .collection("classes")
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json({ success: true, classes });
      } catch (error) {
        console.error("Error fetching classes for admin:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //  Approve a Class
    app.patch("/api/admin/classes/approve/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: "Approved" },
        };

        const result = await db
          .collection("classes")
          .updateOne(filter, updateDoc);

        if (result.modifiedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Class not found or already approved",
          });
        }

        res
          .status(200)
          .json({ success: true, message: "Class approved successfully" });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //  Reject a Class
    app.patch("/api/admin/classes/reject/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: "Rejected" },
        };

        const result = await db
          .collection("classes")
          .updateOne(filter, updateDoc);

        if (result.modifiedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Class not found or already rejected",
          });
        }

        res
          .status(200)
          .json({ success: true, message: "Class rejected successfully" });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //  Delete a Class
    app.delete("/api/admin/classes/delete/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const filter = { _id: new ObjectId(id) };
        const result = await db.collection("classes").deleteOne(filter);

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Class not found" });
        }

        res
          .status(200)
          .json({ success: true, message: "Class deleted permanently" });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 6. Create a New Forum Post----------(Add Forum Post)
    app.post("/api/admin/forum-posts", async (req, res) => {
      const { title, image, description, author } = req.body;

      if (!title || !image || !description) {
        return res.status(400).json({
          success: false,
          message: "Please fill in all fields and upload a cover image.",
        });
      }

      try {
        const newPost = {
          title: title.trim(),
          image: image,
          description: description.trim(),
          authorName: author?.name || "Admin Team",
          authorEmail: author?.email || "admin@gymx.com",
          authorImage:
            author?.image ||
            "https://i.ibb.co/4whpS6gy/Gemini-Generated-Image-tpowc9tpowc9tpow.png",
          authorRole: "admin",
          upvotes: 0,
          downvotes: 0,
          createdAt: new Date(),
        };

        const result = await forumsCollection.insertOne(newPost);

        res.status(201).json({
          success: true,
          message: "Forum post published successfully!",
          postId: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating forum post:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 7. Get All Stripe Payments----------(Transactions)
    app.get("/api/admin/transactions", async (req, res) => {
      try {
        const transactions = await bookingsCollection
          .find({ transactionId: { $exists: true, $ne: null } })
          .sort({ date: -1 })
          .toArray();

        res.status(200).json({ success: true, transactions });
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 8. Get All Forum Posts----------(Forum Post Manage)
    app.get("/api/admin/forums", async (req, res) => {
      try {
        const posts = await forumsCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json({ success: true, posts });
      } catch (error) {
        console.error("Error fetching forum posts for admin:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // Delete any Inappropriate Forum Post
    app.delete("/api/admin/forums/delete/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const filter = { _id: new ObjectId(id) };
        const result = await forumsCollection.deleteOne(filter);

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({
              success: false,
              message: "Post not found or already deleted",
            });
        }

        res
          .status(200)
          .json({
            success: true,
            message: "Forum post removed successfully from platform",
          });
      } catch (error) {
        console.error("Error deleting forum post:", error);
        res.status(500).json({ success: false, message: error.message });
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
