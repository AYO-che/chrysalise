// controllers/offerController.js
import prisma from "../prismaClient.js";

// ==============================
// 1️⃣ Create Offer (NUTRITION only)
// ==============================
export const createOffer = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      price,
      durationDays,
      hasFreeTrial,
      includesSessions,
    } = req.body;

    if (!name || !type || !price || !durationDays)
      return res
        .status(400)
        .json({ message: "name, type, price and durationDays are required" });

    if (!["PLAN", "CONSULTATION", "AI_CALORIES"].includes(type))
      return res.status(400).json({ message: "Invalid offer type" });

    const offer = await prisma.offer.create({
      data: {
        name,
        description: description ?? null,
        type,
        price,
        durationDays,
        hasFreeTrial: hasFreeTrial ?? false,
        includesSessions: includesSessions ?? false,
        isActive: true,
      },
    });

    res.status(201).json({ offer });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 2️⃣ Get all offers
// ==============================
export const getAllOffers = async (req, res) => {
  try {
    const offers = await prisma.offer.findMany({
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ offers });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 3️⃣ Get single offer by ID
// ==============================
export const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!offer) return res.status(404).json({ message: "Offer not found" });

    res.json({ offer });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 4️⃣ Update Offer (NUTRITION — own plan's offer only, or ADMIN)
// ==============================
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      durationDays,
      hasFreeTrial,
      includesSessions,
      isActive,
    } = req.body;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    // Ownership check through the plan
    if (req.user.role !== "ADMIN" && offer.plan?.nutritionId !== req.user.id)
      return res.status(403).json({ message: "Access forbidden" });

    const updatedOffer = await prisma.offer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(durationDays !== undefined && { durationDays }),
        ...(hasFreeTrial !== undefined && { hasFreeTrial }),
        ...(includesSessions !== undefined && { includesSessions }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ offer: updatedOffer });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 5️⃣ Delete Offer (NUTRITION — own only, or ADMIN)
// ==============================
export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    if (req.user.role !== "ADMIN" && offer.plan?.nutritionId !== req.user.id)
      return res.status(403).json({ message: "Access forbidden" });

    // Check no active subscriptions exist before deleting
    const activeSubscriptions = await prisma.subscription.findFirst({
      where: { offerId: id, status: { in: ["ACTIVE", "PENDING"] } },
    });
    if (activeSubscriptions)
      return res.status(400).json({
        message: "Cannot delete an offer with active or pending subscriptions",
      });

    await prisma.offer.delete({ where: { id } });

    res.json({ message: "Offer deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};