// controllers/notificationController.js
import prisma from "../prismaClient.js";

// =====================
// 1️⃣ Get all my notifications
// =====================
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 2️⃣ Mark a single notification as read
// =====================
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });

    if (notification.userId !== req.user.id)
      return res.status(403).json({ message: "Access forbidden" });

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ notification: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 3️⃣ Mark all notifications as read
// =====================
export const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 4️⃣ Delete a notification
// =====================
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });

    if (notification.userId !== req.user.id)
      return res.status(403).json({ message: "Access forbidden" });

    await prisma.notification.delete({ where: { id } });

    res.json({ message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 5️⃣ Get unread notifications count
// =====================
export const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};