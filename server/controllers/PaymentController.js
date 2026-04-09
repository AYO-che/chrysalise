// controllers/paymentController.js
import prisma from "../prismaClient.js";
import Stripe from "stripe";
import { createZoomMeeting } from "../utils/zoom.js";
import { io, connectedUsers } from "../socket.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =====================
// 1️⃣ Create a payment
// =====================
export const createPayment = async (req, res) => {
  try {
    const { subscriptionId, paymentMethodId, sessionDate } = req.body;
    const userId = req.user.id;

    if (!subscriptionId || !paymentMethodId)
      return res.status(400).json({ message: "subscriptionId and paymentMethodId are required" });

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        offer: true,
        patient: true,
        nutrition: { include: { stripe: true } },
      },
    });

    if (!subscription)
      return res.status(404).json({ message: "Subscription not found" });

    if (subscription.patientId !== userId)
      return res.status(403).json({ message: "You cannot pay for this subscription" });

    // Free trial protection
    if (subscription.status === "ACTIVE") {
      const existingPayment = await prisma.payment.findFirst({
        where: { subscriptionId, status: "SUCCESS" },
      });
      if (!existingPayment)
        return res.status(400).json({ message: "This subscription is on a free trial, no payment needed" });
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { subscriptionId, status: "SUCCESS" },
    });
    if (existingPayment)
      return res.status(400).json({ message: "Subscription already paid" });

    const { offer, patient, nutrition } = subscription;
    if (!offer) return res.status(400).json({ message: "Offer not found" });

    const amount = Math.round((offer.price || 0) * 100);

    const paymentIntentData = {
      amount,
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      metadata: { subscriptionId },
    };

    // Stripe Connect
    if (["CONSULTATION", "PLAN"].includes(offer.type)) {
      const stripeAccountId = nutrition?.stripe?.stripeAccountId;
      if (!stripeAccountId)
        return res.status(400).json({ message: "Nutritionist Stripe account not linked" });

      paymentIntentData.transfer_data = { destination: stripeAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    if (paymentIntent.status !== "succeeded")
      return res.status(400).json({ message: "Payment not completed", status: paymentIntent.status });

    // =========================
    // Zoom + slot conflict check (outside transaction)
    // =========================
    let zoomLink = null;
    let scheduledDate = null;

    if (offer.type === "CONSULTATION") {
      if (sessionDate && new Date(sessionDate) <= new Date())
        return res.status(400).json({ message: "Session date must be in the future" });

      scheduledDate = sessionDate
        ? new Date(sessionDate)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      // ✅ Conflict check — reject if slot already taken
      const conflict = await prisma.session.findFirst({
        where: {
          nutritionId: subscription.nutritionId,
          status: { not: "CANCELLED" },
          sessionDate: scheduledDate,
        },
      });
      if (conflict)
        return res.status(409).json({
          message: "This time slot is already booked, please choose another",
        });

      zoomLink = await createZoomMeeting(
        nutrition.email || "",
        patient.email || "",
        offer.name || ""
      );
    }

    // =========================
    // DB TRANSACTION
    // =========================
    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ payment
      const payment = await tx.payment.create({
        data: {
          subscriptionId,
          amount: offer.price || 0,
          status: "SUCCESS",
          paymentMethod: "stripe",
          transactionId: paymentIntent.id,
        },
      });

      // 2️⃣ activate subscription
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: { status: "ACTIVE", startDate: new Date() },
      });

      let session = null;

      // =========================
      // 🔥 PLAN LOGIC
      // =========================
      if (offer.type === "PLAN") {
        const plan = await tx.plan.findUnique({
          where: { offerId: subscription.offerId },
        });

        if (!plan) throw new Error("Plan not found");

        await tx.userPlan.create({
          data: {
            userId: subscription.patientId,
            planId: plan.id,
            subscriptionId: subscription.id,
            startDate: new Date(),
          },
        });
      }

      // =========================
      // CONSULTATION
      // =========================
      if (offer.type === "CONSULTATION") {
        session = await tx.session.create({
          data: {
            subscriptionId,
            patientId: subscription.patientId,
            nutritionId: subscription.nutritionId,
            sessionDate: scheduledDate,
            zoomLink,
            status: "SCHEDULED",
          },
        });
      }

      return { payment, session };
    });

    // =========================
    // Notifications
    // =========================
    if (result.session && offer.type === "CONSULTATION") {
      const { session } = result;

      const [patientNotif, nutritionNotif] = await Promise.all([
        prisma.notification.create({
          data: {
            userId: subscription.patientId,
            title: "Session Scheduled",
            message: `Your consultation with ${nutrition.firstName} is scheduled on ${session.sessionDate.toLocaleString()}`,
            link: session.zoomLink,
          },
        }),
        prisma.notification.create({
          data: {
            userId: subscription.nutritionId,
            title: "New Session Scheduled",
            message: `A session with ${patient.firstName} is scheduled on ${session.sessionDate.toLocaleString()}`,
            link: session.zoomLink,
          },
        }),
      ]);

      const patientSocketId = connectedUsers.get(subscription.patientId);
      if (patientSocketId) io.to(patientSocketId).emit("notification", patientNotif);

      const nutritionSocketId = connectedUsers.get(subscription.nutritionId);
      if (nutritionSocketId) io.to(nutritionSocketId).emit("notification", nutritionNotif);
    }

    res.json({
      message:
        offer.type === "CONSULTATION"
          ? "Payment successful, consultation scheduled"
          : "Payment successful",
      payment: result.payment,
      session: result.session,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 2️⃣ Get my payments
// =====================
export const getMyPayments = async (req, res) => {
  try {
    const userId = req.user.id;

    const payments = await prisma.payment.findMany({
      where: { subscription: { patientId: userId } },
      include: {
        subscription: {
          include: {
            offer: true,
            nutrition: {
              select: { id: true, firstName: true, lastName: true, email: true, image: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 3️⃣ Get payment by ID
// =====================
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            offer: true,
            patient: {
              select: { id: true, firstName: true, lastName: true, email: true, image: true },
            },
            nutrition: {
              select: { id: true, firstName: true, lastName: true, email: true, image: true },
            },
            sessions: true,
          },
        },
      },
    });

    if (!payment) return res.status(404).json({ message: "Payment not found" });

    if (req.user.role !== "ADMIN" && payment.subscription.patientId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    res.json({ payment });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};