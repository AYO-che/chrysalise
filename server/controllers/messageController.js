// controllers/messageController.js
import prisma from "../prismaClient.js";
import { io, connectedUsers } from "../socket.js";

// ==============================
//  Get or create a conversation between patient and nutritionist
// ==============================
export const getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { otherUserId } = req.body;

    if (!otherUserId)
      return res.status(400).json({ message: "otherUserId is required" });

    const patientId = role === "CLIENT" ? userId : otherUserId;
    const nutritionId = role === "NUTRITION" ? userId : otherUserId;

    const conversation = await prisma.conversation.upsert({
      where: { patientId_nutritionId: { patientId, nutritionId } },
      update: {},
      create: { patientId, nutritionId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, image: true } },
        nutrition: { select: { id: true, firstName: true, lastName: true, image: true } },
      },
    });

    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
//  Get all conversations for the logged-in user
// ==============================
export const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const where =
      role === "CLIENT" ? { patientId: userId } : { nutritionId: userId };

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, image: true } },
        nutrition: { select: { id: true, firstName: true, lastName: true, image: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // last message preview
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
//  Get all messages in a conversation
// ==============================
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });

    // Only participants can read messages
    if (conversation.patientId !== userId && conversation.nutritionId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, image: true } },
      },
    });

    // Mark all unread messages as read for this user
    await prisma.message.updateMany({
      where: {
        conversationId,
        isRead: false,
        senderId: { not: userId },
      },
      data: { isRead: true },
    });

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// Send a message
// ==============================
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

    if (!content)
      return res.status(400).json({ message: "Message content is required" });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });

    // Only participants can send messages
    if (conversation.patientId !== senderId && conversation.nutritionId !== senderId)
      return res.status(403).json({ message: "Access forbidden" });

    // Determine the receiver
    const receiverId =
      conversation.patientId === senderId
        ? conversation.nutritionId
        : conversation.patientId;

    const message = await prisma.message.create({
      data: { conversationId, senderId, content },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, image: true } },
      },
    });

    // Update conversation updatedAt so it bubbles to top of list
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Save notification to DB
    const notification = await prisma.notification.create({
      data: {
        userId: receiverId,
        title: "New Message",
        message: `${req.user.firstName} sent you a message`,
        link: `/conversations/${conversationId}`,
      },
    });

    // Emit real-time notification if receiver is online
    const receiverSocketId = connectedUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("notification", notification);
      io.to(receiverSocketId).emit("new_message", message);
    }

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};