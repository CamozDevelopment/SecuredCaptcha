import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../config/database';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// Pricing configuration
const PRICING = {
  BASIC: {
    priceId: 'price_basic', // Replace with your actual Stripe price ID
    amount: 1900, // $19.00
    limit: 10000
  },
  PRO: {
    priceId: 'price_pro',
    amount: 9900, // $99.00
    limit: 100000
  },
  ENTERPRISE: {
    priceId: 'price_enterprise',
    amount: 49900, // $499.00
    limit: 1000000
  }
};

// Create checkout session
router.post(
  '/create-checkout',
  authenticateJWT,
  [
    body('tier').isIn(['BASIC', 'PRO', 'ENTERPRISE'])
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.body;
      const user = req.user!;

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;
      
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId }
      });
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: PRICING[tier as keyof typeof PRICING].priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing`,
        metadata: {
          userId: user.id,
          tier
        }
      });

      res.json({
        sessionId: session.id,
        url: session.url
      });
    } catch (error) {
      console.error('Checkout creation error:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }
);

// Webhook handler for Stripe events
router.post(
  '/webhook',
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
        
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSub = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(deletedSub);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }
);

// Get usage statistics
router.get('/usage', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get current month usage
    const currentUsage = await prisma.usage.count({
      where: {
        userId: user.id,
        timestamp: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    });

    // Get tier limits
    const tierLimits: { [key: string]: number } = {
      FREE: parseInt(process.env.FREE_TIER_LIMIT || '1000'),
      BASIC: parseInt(process.env.BASIC_TIER_LIMIT || '10000'),
      PRO: parseInt(process.env.PRO_TIER_LIMIT || '100000'),
      ENTERPRISE: parseInt(process.env.ENTERPRISE_TIER_LIMIT || '1000000'),
    };

    const limit = tierLimits[user.tier];
    const percentage = (currentUsage / limit) * 100;
Raw = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE(timestamp) as date, COUNT(*)::int as count
      FROM usage
      WHERE user_id = ${user.id}
        AND timestamp >= ${monthStart}
        AND timestamp <= ${monthEnd}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    const dailyUsage = dailyUsageRaw.map((item: any) => ({
      _id: item.date,
      count: Number(item.count)
    })   $sort: { _id: 1 }
      }
    ]);

    res.json({
      tier: user.tier,
      currentUsage,
      limit,
      remaining: Math.max(0, limit - currentUsage),
      percentage: Math.min(100, Math.round(percentage)),
      dailyUsage,
      billingPeriod: {
        start: monthStart,
        end: monthEnd
      }
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    await stripe.subscriptions.cancel(user.stripeSubscriptionId);

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Helper functions
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;

  if (!userId || !tier) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  user.tier = tier asprisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: tier as any,
      stripeSubscriptionId: session.subscription as string
    }
  }it User.findOne({ stripeSubscriptionId: subscription.id });
  
  if (!user) {
    console.error('User not found for subscription:', subscription.id);
    return;prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });
  
  if (!user) {
    console.error('User not found for subscription:', subscription.id);
    return;
  }

  // Handle subscription status changes
  if (subscription.status === 'active') {
    // Subscription is active
    console.log(`Subscription ${subscription.id} is active`);
  } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    // Downgrade to free tier
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: 'FREE' }
    });
    console.log(`User downgraded to free due to payment issue`);
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });
  
  if (!user) {
    console.error('User not found for subscription:', subscription.id);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tier: 'FREE',
      stripeSubscriptionId: null
    }
  });
}

export default router;
