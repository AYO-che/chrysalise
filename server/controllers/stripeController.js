// controllers/stripeController.js
import Stripe from "stripe";
import prisma from "../prismaClient.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ===============================
// 1️⃣ Create Connected Account
// ===============================
export const createConnectedAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    const existing = await prisma.stripe.findUnique({ where: { userId } });
    if (existing)
      return res.status(400).json({
        message: "Stripe account already exists",
        stripeAccountId: existing.stripeAccountId,
      });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const account = await stripe.accounts.create({
      type: "express",
      country: process.env.STRIPE_COUNTRY || "US",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await prisma.stripe.create({
      data: {
        stripeAccountId: account.id,
        userId,
      },
    });

    res.status(201).json({
      message: "Stripe connected account created",
      stripeAccountId: account.id,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ===============================
// 2️⃣ Generate Onboarding Link
// ===============================
export const generateOnboardingLink = async (req, res) => {
  try {
    const userId = req.user.id;

    const stripeAccount = await prisma.stripe.findUnique({ where: { userId } });
    if (!stripeAccount)
      return res.status(404).json({ message: "Stripe account not found" });

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccount.stripeAccountId,
      refresh_url: `${process.env.CLIENT_URL}/reauth`,
      return_url: `${process.env.CLIENT_URL}/success`,
      type: "account_onboarding",
    });

    res.status(200).json({ onboardingUrl: accountLink.url });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ===============================
// 3️⃣ Check Stripe Account Status
// ===============================
export const getStripeAccountStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const stripeAccount = await prisma.stripe.findUnique({ where: { userId } });
    if (!stripeAccount)
      return res.status(404).json({ message: "Stripe account not found" });

    const account = await stripe.accounts.retrieve(stripeAccount.stripeAccountId);

    res.status(200).json({
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};