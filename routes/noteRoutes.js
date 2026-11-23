const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { authenticateToken } = require("../middleware/authMiddleware");
const { events } = require("../events/appEvents");

const router = express.Router();

router.use(authenticateToken);

router.post("/", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const note = {
      title: String(title).trim(),
      content: String(content).trim(),
      owner: new ObjectId(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await getDB().collection("notes").insertOne(note);
    events.emit("noteCreated", note);

    res.status(201).json({
      message: "Note created successfully",
      note: { ...note, _id: result.insertedId }
    });
  } catch (error) {
    res.status(500).json({ message: "Could not create note", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const notes = await getDB().collection("notes")
      .find({ owner: new ObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: "Could not fetch notes", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body.content !== undefined) updates.content = String(req.body.content).trim();
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "Provide a title or content to update" });
    }
    updates.updatedAt = new Date();

    const result = await getDB().collection("notes").findOneAndUpdate(
      {
        _id: new ObjectId(req.params.id),
        owner: new ObjectId(req.user.id)
      },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result) return res.status(404).json({ message: "Note not found" });
    res.json({ message: "Note updated successfully", note: result });
  } catch (error) {
    res.status(500).json({ message: "Could not update note", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const result = await getDB().collection("notes").deleteOne({
      _id: new ObjectId(req.params.id),
      owner: new ObjectId(req.user.id)
    });

    if (!result.deletedCount) {
      return res.status(404).json({ message: "Note not found" });
    }

    res.json({ message: "Note deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Could not delete note", error: error.message });
  }
});

module.exports = router;
