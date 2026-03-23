// controllers/reviewController.js
import prisma from "../prismaClient.js";

const patientSelect = {
  select: { id: true, firstName: true, lastName: true, image: true },
};

const nutritionSelect = {
  select: { id: true, firstName: true, lastName: true, image: true },
};

// ==============================
// 1️⃣ Create a review (Client after completed session)
// ==============================
export const createReview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, comment } = req.body;
    const clientId = req.user.id;

    if (!rating)
      return res.status(400).json({ message: "Rating is required" });

    if (rating < 1 || rating > 5)
      return res.status(400).json({ message: "Rating must be between 1 and 5" });

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.patientId !== clientId)
      return res.status(403).json({ message: "Access forbidden" });

    if (session.status !== "COMPLETED")
      return res.status(400).json({ message: "You can only review completed sessions" });

    const existingReview = await prisma.review.findUnique({
      where: { sessionId_patientId: { sessionId, patientId: clientId } },
    });
    if (existingReview)
      return res.status(400).json({ message: "You already reviewed this session" });

    const review = await prisma.review.create({
      data: {
        sessionId,
        patientId: clientId,
        nutritionId: session.nutritionId,
        rating,
        comment: comment ?? null,
      },
    });

    // Recalculate and update nutritionist's average rating
    const allReviews = await prisma.review.findMany({
      where: { nutritionId: session.nutritionId },
      select: { rating: true },
    });

    const average =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await prisma.resume.updateMany({
      where: { userId: session.nutritionId },
      data: { ratingAverage: Math.round(average * 10) / 10 },
    });

    res.status(201).json({ review });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 2️⃣ Get all reviews for logged-in nutritionist (private)
// ==============================
export const getNutritionReviews = async (req, res) => {
  try {
    const nutritionId = req.user.id;

    const reviews = await prisma.review.findMany({
      where: { nutritionId },
      include: {
        patient: patientSelect,
        session: { select: { id: true, sessionDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 3️⃣ Get public reviews for a nutritionist by ID (no auth)
// ==============================
export const getPublicNutritionReviews = async (req, res) => {
  try {
    const { id: nutritionId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { nutritionId },
      include: {
        patient: patientSelect,
        session: { select: { id: true, sessionDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 4️⃣ Get all reviews written by logged-in client
// ==============================
export const getClientReviews = async (req, res) => {
  try {
    const clientId = req.user.id;

    const reviews = await prisma.review.findMany({
      where: { patientId: clientId },
      include: {
        nutrition: nutritionSelect,
        session: { select: { id: true, sessionDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};