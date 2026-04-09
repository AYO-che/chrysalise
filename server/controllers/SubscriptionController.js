// controllers/subscriptionController.js
import prisma from "../prismaClient.js";

const userSelect = {
  select: { id: true, firstName: true, lastName: true, email: true, image: true },
};

// ==============================
// 1️⃣ Create a subscription (CLIENT)
// ==============================
export const createSubscription = async (req, res) => {
  try {
    const { offerId, nutritionId } = req.body;
    const userId = req.user.id;

    if (!offerId)
      return res.status(400).json({ message: "offerId is required" });

    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) return res.status(404).json({ message: "Offer not found" });
    if (!offer.isActive)
      return res.status(400).json({ message: "Offer is no longer active" });

    const existing = await prisma.subscription.findFirst({
      where: { patientId: userId, offerId, status: { in: ["PENDING", "ACTIVE"] } },
    });
    if (existing)
      return res.status(400).json({
        message: "You already have an active or pending subscription for this offer",
      });

    let linkedNutritionId = null;
    let isFree = false;
    let durationDays = offer.durationDays;

    if (offer.type === "CONSULTATION") {
      if (!nutritionId)
        return res.status(400).json({ message: "nutritionId is required for consultation offers" });
      linkedNutritionId = nutritionId;
    }

    if (offer.type === "PLAN") {
      const plan = await prisma.plan.findUnique({ where: { offerId } });
      if (!plan)
        return res.status(404).json({ message: "Plan not found for this offer" });
      linkedNutritionId = plan.nutritionId ?? null;

      const client = await prisma.user.findUnique({ where: { id: userId } });
      if (!client.usedFreePlanTrial) {
        isFree = true;
        await prisma.user.update({
          where: { id: userId },
          data: { usedFreePlanTrial: true },
        });
      }
    }

    if (offer.type === "AI_CALORIES") {
      const previousAiSub = await prisma.subscription.findFirst({
        where: { patientId: userId, offer: { type: "AI_CALORIES" } },
      });
      if (!previousAiSub) {
        isFree = true;
        durationDays = 10;
      }
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);

    const subscription = await prisma.subscription.create({
      data: {
        patientId: userId,
        nutritionId: linkedNutritionId,
        offerId,
        startDate,
        endDate,
        status: isFree ? "ACTIVE" : "PENDING",
      },
    });

    res.status(201).json({
      subscription,
      isFree,
      message: isFree
        ? offer.type === "AI_CALORIES"
          ? "10 day free trial started"
          : "Free first plan subscription activated"
        : "Subscription created, proceed to payment",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 2️⃣ Get all my subscriptions (CLIENT)
// ==============================
export const getMySubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await prisma.subscription.findMany({
      where: { patientId: userId },
      include: {
        offer: true,
        nutrition: userSelect,
        payments: true,
      },
      orderBy: { startDate: "desc" },
    });

    res.json({ subscriptions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 3️⃣ Get single subscription (ADMIN or owner)
// ==============================
export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        offer: true,
        patient: userSelect,
        nutrition: userSelect,
        payments: true,
        sessions: true,
      },
    });

    if (!subscription)
      return res.status(404).json({ message: "Subscription not found" });

    if (req.user.role !== "ADMIN" && req.user.id !== subscription.patientId)
      return res.status(403).json({ message: "Access forbidden" });

    res.json({ subscription });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 4️⃣ Get all subscriptions for a nutritionist (NUTRITION or ADMIN)
// ==============================
export const getNutritionSubscriptions = async (req, res) => {
  try {
    const nutritionId = req.user.id;

    const subscriptions = await prisma.subscription.findMany({
      where: { nutritionId },
      include: {
        offer: true,
        patient: userSelect,
        payments: true,
        sessions: true,
      },
      orderBy: { startDate: "desc" },
    });

    res.json({ subscriptions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 5️⃣ Cancel a subscription (CLIENT — own only)
// ==============================
export const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription)
      return res.status(404).json({ message: "Subscription not found" });

    if (req.user.role !== "ADMIN" && subscription.patientId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    if (subscription.status === "CANCELLED")
      return res.status(400).json({ message: "Subscription is already cancelled" });

    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    res.json({ message: "Subscription cancelled", subscription: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};