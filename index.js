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
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    //==================================================================================================================================
    //                                                           TRAINER DASHBOARD                                                    ||
    //==================================================================================================================================
    // 1. ------Trainer Overview (Overview)-------
    app.get("/api/trainer-stats/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const totalClasses = await classesCollection.countDocuments({
          trainerEmail: email,
        });

        const stats = await bookingsCollection
          .aggregate([
            {
              $lookup: {
                from: "classes",
                localField: "classId",
                foreignField: "_id",
                as: "classDetails",
              },
            },
            { $unwind: "$classDetails" },
            { $match: { "classDetails.trainerEmail": email } },
            { $count: "totalStudents" },
          ])
          .toArray();

        const totalStudents = stats.length > 0 ? stats[0].totalStudents : 0;

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
      const trainerEmail = newClass.trainerEmail;

      try {
        const user = await db
          .collection("user")
          .findOne({ email: trainerEmail });
        if (user && user.status === "Blocked") {
          return res.status(403).json({
            success: false,
            message:
              "Action denied. Your account has been suspended by the administrator.",
          });
        }

        const classData = {
          ...newClass,
          status: "Pending",
          bookingCount: 0,
          createdAt: new Date(),
        };

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
    app.post("/api/forums", async (req, res) => {
      const newPost = req.body;
      const authorEmail = newPost.authorEmail;

      try {
        const user = await db
          .collection("user")
          .findOne({ email: authorEmail });
        if (user && user.status === "Blocked") {
          return res.status(403).json({
            success: false,
            message:
              "Forbidden. Blocked users are restricted from publishing content.",
          });
        }

        const postData = {
          ...newPost,
          upvotes: 0,
          downvotes: 0,
          createdAt: new Date(),
        };

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
    //                                                           USER DASHBOARD                                                       ||
    //==================================================================================================================================
    // 1. Get User Dashboard Overview Statistics & Status (UPDATED)
    app.get("/api/user-overview/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const totalBookedClasses = await db
          .collection("bookings")
          .countDocuments({ userEmail: email });

        const totalFavorites = await db
          .collection("favorites")
          .countDocuments({ email: email });

        const trainerApplication = await db
          .collection("trainer-applications")
          .findOne(
            { email: email },
            { projection: { status: 1, feedback: 1 } },
          );
        const userDetails = await db
          .collection("user")
          .findOne({ email: email }, { projection: { role: 1 } });

        res.status(200).json({
          success: true,
          stats: { totalBookedClasses, totalFavorites },
          application: {
            status: trainerApplication?.status || "Not Applied",
            feedback: trainerApplication?.feedback || null,
          },
          role: userDetails?.role || "user",
        });
      } catch (error) {
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
        const user = await db.collection("user").findOne({ email: email });
        if (user && user.status === "Blocked") {
          return res.status(403).json({
            success: false,
            message:
              "Submission failed. Your account is restricted from applying.",
          });
        }

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

        const applicationData = {
          name,
          email,
          image,
          experience: parseInt(experience),
          specialty,
          bio,
          status: "Pending",
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
        const query = { email: email };
        const favorites = await favoritesCollection
          .find(query)
          .sort({ addedAt: -1 })
          .toArray();
        res.status(200).json({ success: true, favorites });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 5. Favorites check (to keep the button active when reloaded)
    app.get("/api/check-favorite", async (req, res) => {
      try {
        const { email, classId } = req.query;
        if (!email || !classId) return res.status(200).json({ isFav: false });

        const query = { email: email, classId: classId }; // ফিল্ড 'email' ঠিক করা হয়েছে
        const exists = await favoritesCollection.findOne(query);
        res.status(200).json({ isFav: !!exists });
      } catch (error) {
        res.status(500).json({ isFav: false, message: error.message });
      }
    });

    // 6. Remove from favorite class list - API (Remove Favorite)
    app.delete("/api/favorites", async (req, res) => {
      try {
        const { email, classId } = req.query;

        if (!email || !classId) {
          return res
            .status(400)
            .json({ success: false, message: "Missing email or classId" });
        }

        const query = { email: email, classId: classId };
        const result = await favoritesCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.status(200).json({
            success: true,
            message: "Removed from favorites successfully",
          });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Favorite item not found" });
        }
      } catch (error) {
        console.error("Error removing favorite:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 7. Booking Check
    app.get("/api/check-booking", async (req, res) => {
      try {
        const { email, classId } = req.query;
        if (!email || !classId)
          return res.status(200).json({ hasBooked: false });

        const query = { userEmail: email, classId: classId };
        const exists = await bookingsCollection.findOne(query);
        res.status(200).json({ hasBooked: !!exists });
      } catch (error) {
        res.status(500).json({ hasBooked: false, message: error.message });
      }
    });

    //8.  Booking fetching route
    app.get("/api/my-bookings/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const bookings = await db
          .collection("bookings")
          .find({ userEmail: email })
          .toArray();

        const formattedBookings = bookings.map((b) => ({
          ...b,
          bookedClassName: b.bookedClassName || b.className || "Unnamed Class",
        }));

        res.status(200).json({ success: true, bookings: formattedBookings });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //==================================================================================================================================
    //                                                           ADMIN DASHBOARD                                                      ||
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
          
          .sort({ bookingDate: -1 })
          .toArray();

        res.status(200).json({ success: true, transactions });
      } catch (error) {
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
          return res.status(404).json({
            success: false,
            message: "Post not found or already deleted",
          });
        }

        res.status(200).json({
          success: true,
          message: "Forum post removed successfully from platform",
        });
      } catch (error) {
        console.error("Error deleting forum post:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //==================================================================================================================================
    //                                                           ALL CLASSES PAGE                                                     ||
    //==================================================================================================================================

    // 1. PUBLIC: Get All Approved Classes with Search, Filter & Pagination
    app.get("/api/public/classes", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const search = req.query.search || "";
        const category = req.query.category || "";

        let query = { status: "Approved" };

        if (search) {
          query.className = { $regex: search, $options: "i" };
        }

        if (category) {
          query.category = category;
        }

        const totalClasses = await classesCollection.countDocuments(query);
        const classes = await classesCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        res.status(200).json({
          success: true,
          classes,
          totalPages: Math.ceil(totalClasses / limit),
          currentPage: page,
          totalClasses,
        });
      } catch (error) {
        console.error("Error fetching public classes:", error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 2. PRIVATE/PROTECTED: Get Single Class Details by ID
    app.get("/api/classes/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // ২৪ অক্ষরের মঙ্গোডিবি অবজেক্ট আইডি ভ্যালিডেশন
        if (!id || id.length !== 24) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await db.collection("classes").findOne(query); // আপনার কালেকশন নাম classes হলে

        if (!result) {
          return res
            .status(404)
            .json({ success: false, message: "Class not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    // 3. PRIVATE/PROTECTED: Add a class to favorites
    app.post("/api/favorites", async (req, res) => {
      try {
        const favoriteData = req.body;

        const query = {
          email: favoriteData.email,
          classId: favoriteData.classId,
        };
        const exists = await favoritesCollection.findOne(query);

        if (exists) {
          return res
            .status(400)
            .json({ success: false, message: "Already in favorites" });
        }

        const result = await favoritesCollection.insertOne(favoriteData);
        res.status(200).json({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    //==================================================================================================================================
    //                                                           ALL FORUM PAGE                                                       ||
    //==================================================================================================================================

    // 1. COMMUNITY FORUM API WITH PAGINATION
    app.get("/api/forum-posts", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6; // প্রতি পেজে ৪টি করে পোস্ট দেখাবে
        const skip = (page - 1) * limit;

        // ডাটাবেজ থেকে ফোরাম কালেকশন (আপনার কালেকশনের নাম অনুযায়ী পরিবর্তন করতে পারেন)
        const forumCollection = db.collection("forums");

        // ১. মোট কতটি পোস্ট আছে তা কাউন্ট করা
        const totalPosts = await forumCollection.countDocuments();

        // ২. বর্তমান পেজের জন্য নির্দিষ্ট ডাটা ফেচ করা (সর্বশেষ পোস্ট আগে দেখাবে)
        const posts = await forumCollection
          .find({})
          .sort({ createdAt: -1 }) // Newest posts first
          .skip(skip)
          .limit(limit)
          .toArray();

        // ৩. টোটাল পেজ সংখ্যা হিসাব করা
        const totalPages = Math.ceil(totalPosts / limit);

        res.status(200).json({
          success: true,
          posts,
          currentPage: page,
          totalPages,
          totalPosts,
        });
      } catch (error) {
        console.error("Error fetching forum posts:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // 2. Get Single forum post & Comment
    app.get("/api/public/forum-posts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const forumCollection = db.collection("forums");

        const post = await forumCollection.findOne({ _id: new ObjectId(id) });
        if (!post) {
          return res
            .status(404)
            .json({ success: false, message: "Post not found" });
        }
        res.status(200).json({ success: true, post });
      } catch (error) {
        console.error("Error fetching single post:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // 3. Forum Like & Dislike
    app.patch("/api/user/forum-posts/:id/vote", async (req, res) => {
      try {
        const id = req.params.id;
        const { userEmail, voteType } = req.body;
        const forumCollection = db.collection("forums");

        const post = await forumCollection.findOne({ _id: new ObjectId(id) });
        if (!post) {
          return res
            .status(404)
            .json({ success: false, message: "Post not found" });
        }

        const upVotes = post.upVotes || [];
        const downVotes = post.downVotes || [];

        let updateDoc = {};

        if (voteType === "like") {
          if (upVotes.includes(userEmail)) {
            // If you already liked it, it will be removed (toggle)
            updateDoc = { $pull: { upVotes: userEmail } };
          } else {
            // Likes will be added and dislikes will be removed.
            updateDoc = {
              $addToSet: { upVotes: userEmail },
              $pull: { downVotes: userEmail },
            };
          }
        } else if (voteType === "dislike") {
          if (downVotes.includes(userEmail)) {
            // If you already dislike it, it will be removed.
            updateDoc = { $pull: { downVotes: userEmail } };
          } else {
            // Dislikes will be added and likes will be removed.
            updateDoc = {
              $addToSet: { downVotes: userEmail },
              $pull: { upVotes: userEmail },
            };
          }
        }

        await forumCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);

        const updatedPost = await forumCollection.findOne({
          _id: new ObjectId(id),
        });
        res.status(200).json({
          success: true,
          upVotes: updatedPost.upVotes || [],
          downVotes: updatedPost.downVotes || [],
        });
      } catch (error) {
        res.status(500).json({ success: false, message: "Voting failed" });
      }
    });

    // 4. Add new Comment
    app.post("/api/user/forum-posts/:id/comments", async (req, res) => {
      try {
        const id = req.params.id;
        const { userEmail, userName, userImage, text } = req.body;
        const forumCollection = db.collection("forums");

        const newComment = {
          commentId: new ObjectId().toString(),
          userEmail,
          userName,
          userImage:
            userImage ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
          text,
          createdAt: new Date(),
        };

        await forumCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { comments: newComment } },
        );

        res.status(201).json({ success: true, comment: newComment });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, message: "Comment post failed" });
      }
    });

    // 5. Edit Comment
    app.patch(
      "/api/user/forum-posts/:id/comments/:commentId",
      async (req, res) => {
        try {
          const { id, commentId } = req.params;
          const { text, userEmail } = req.body;
          const forumCollection = db.collection("forums");

          const result = await forumCollection.updateOne(
            {
              _id: new ObjectId(id),
              "comments.commentId": commentId,
              "comments.userEmail": userEmail,
            },
            { $set: { "comments.$.text": text } },
          );

          if (result.modifiedCount === 0) {
            return res.status(403).json({
              success: false,
              message: "Unauthorized or comment not found",
            });
          }

          res
            .status(200)
            .json({ success: true, message: "Comment updated successfully" });
        } catch (error) {
          res.status(500).json({ success: false, message: "Update failed" });
        }
      },
    );

    // 5. Delete Comment
    app.delete(
      "/api/user/forum-posts/:id/comments/:commentId",
      async (req, res) => {
        try {
          const { id, commentId } = req.params;
          const { userEmail } = req.body; // সিকিউরিটির জন্য বডি থেকে ইমেইল ভেরিফাই করা হচ্ছে
          const forumCollection = db.collection("forums");

          const result = await forumCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $pull: {
                comments: { commentId: commentId, userEmail: userEmail },
              },
            },
          );

          if (result.modifiedCount === 0) {
            return res
              .status(403)
              .json({ success: false, message: "Unauthorized action" });
          }

          res.status(200).json({ success: true, message: "Comment deleted" });
        } catch (error) {
          res.status(500).json({ success: false, message: "Delete failed" });
        }
      },
    );

    //==================================================================================================================================
    //                                                HOME PAGE FEATURED CLASSES & LATEST FORUM                                       ||
    //==================================================================================================================================
    // 1. GET: Fetch top featured classes based on booking count
    app.get("/api/public/featured-classes", async (req, res) => {
      try {
        // Taking 4 classes sorted from largest to smallest (descending) according to bookingCount
        // Only classes with "Approved" status are safe to show.
        const featuredClasses = await classesCollection
          .find({ status: "Approved" })
          .sort({ bookingCount: -1 })
          .limit(4)
          .toArray();

        res.send({
          success: true,
          message: "Featured classes fetched successfully",
          classes: featuredClasses,
        });
      } catch (error) {
        console.error("Error fetching featured classes:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    // 2. GET: Fetch 3-4 most recent forum posts for Home Page
    app.get("/api/public/latest-forums", async (req, res) => {
      try {
        const latestPosts = await forumsCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray();

        res.send({
          success: true,
          message: "Latest forum posts fetched successfully",
          posts: latestPosts,
        });
      } catch (error) {
        console.error("Error fetching latest forums:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    //==================================================================================================================================
    //                                               STRIPE PAYMENY                                                                    ||
    //==================================================================================================================================

    // 1. Booking Confrim
    app.post("/api/bookings/confirm", async (req, res) => {
      try {
        const bookingInfo = req.body;

        console.log("Backend Received Data:", bookingInfo);

        if (!bookingInfo.classId || !bookingInfo.userEmail) {
          return res
            .status(400)
            .json({ success: false, message: "Required fields missing." });
        }

        let parsedClassId;
        try {
          parsedClassId = new ObjectId(bookingInfo.classId);
        } catch (idError) {
          parsedClassId = bookingInfo.classId;
        }

        const finalBooking = {
          classId: parsedClassId,
          className: bookingInfo.className,
          trainerName: bookingInfo.trainerName,
          trainerEmail: bookingInfo.trainerEmail,
          price: parseFloat(bookingInfo.price) || 0,
          userEmail: bookingInfo.userEmail,
          transactionId: bookingInfo.transactionId,
          bookingDate: bookingInfo.bookingDate || new Date().toISOString(),
          classSchedule: bookingInfo.classSchedule || {
            day: bookingInfo.day || "Flexible Day",
            time: bookingInfo.time || "Standard Time",
          },
        };

        const bookingResult = await db
          .collection("bookings")
          .insertOne(finalBooking);

        try {
          await db
            .collection("classes")
            .updateOne({ _id: parsedClassId }, { $inc: { bookingCount: 1 } });
        } catch (classErr) {
          console.log("Optional class update skipped or failed");
        }

        return res.status(200).json({
          success: true,
          message: "Booking confirmed!",
          result: bookingResult,
        });
      } catch (error) {
        console.error("CRITICAL DATABASE ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
    });

    // 2. Add this route to your backend file (right below the 'confirm' route).
    app.post("/api/payments/create-checkout-session", async (req, res) => {
      try {
        const { classData, userEmail } = req.body;

        if (!classData || !classData.price) {
          return res
            .status(400)
            .json({ error: "Class data or price is missing." });
        }

        // সঠিক উপায়ে শিডিউল ডাটা বের করা
        // যদি classSchedule অবজেক্টে সরাসরি day/time থাকে অথবা days অ্যারে থাকে
        const scheduleDay =
          classData.classSchedule?.day ||
          (Array.isArray(classData.classSchedule?.days)
            ? classData.classSchedule.days[0]
            : "Flexible Day");

        const scheduleTime = classData.classSchedule?.time || "Standard Time";

        const unitAmount = Math.round(parseFloat(classData.price) * 100);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          customer_email: userEmail,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: classData.className || "Gym Class",
                  description: `Trainer: ${classData.trainerName}`,
                },
                unit_amount: unitAmount,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          // URL-এ ডেটা এনকোড করে পাঠানো হচ্ছে
          success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&classId=${classData._id}&className=${encodeURIComponent(classData.className)}&trainerName=${encodeURIComponent(classData.trainerName)}&price=${classData.price}&userEmail=${userEmail}&day=${encodeURIComponent(scheduleDay)}&time=${encodeURIComponent(scheduleTime)}`,
          cancel_url: `${process.env.CLIENT_URL}/payment?classId=${classData._id}`,
        });

        return res.status(200).json({ id: session.url });
      } catch (error) {
        console.error("Stripe Error:", error);
        return res.status(500).json({ error: error.message });
      }
    });

    // 3. Check Booked
    app.get("/api/check-booked", async (req, res) => {
      try {
        const { email, classId } = req.query;

        if (!email || !classId) {
          return res
            .status(400)
            .json({ success: false, message: "Missing email or classId" });
        }

        let query = { userEmail: email };

        if (ObjectId.isValid(classId)) {
          query.classId = new ObjectId(classId);
        } else {
          query.classId = classId;
        }

        let booking = await db.collection("bookings").findOne(query);

        if (!booking) {
          booking = await db.collection("bookings").findOne({
            userEmail: email,
            classId: classId,
          });
        }

        res.status(200).json({ isBooked: !!booking });
      } catch (error) {
        console.error("Booking Check Error:", error);
        res
          .status(500)
          .json({ isBooked: false, message: "Internal server error" });
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
