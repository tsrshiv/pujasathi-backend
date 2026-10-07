import mongoose from 'mongoose';
import PanditLedgerEntry from '../models/panditLedgerEntry.model.js';
import User from '../models/user.model.js';

const emptyTotals = () => ({
    balancePaise: 0,
    onlineEarningsPaise: 0,
    payoutsPaise: 0,
    codFeesPaise: 0,
    codFeesPaidPaise: 0,
});

const getTotals = async (match, session) => {
  const aggregate = PanditLedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        balancePaise: { $sum: '$amountPaise' },
        onlineEarningsPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'online_earning'] }, '$amountPaise', 0] },
        },
        payoutsPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'payout'] }, { $multiply: ['$amountPaise', -1] }, 0] },
        },
        codFeesPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'cod_platform_fee'] }, { $multiply: ['$amountPaise', -1] }, 0] },
        },
        codFeesPaidPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'cod_fee_payment'] }, '$amountPaise', 0] },
        },
      },
    },
  ]);
  if (session) aggregate.session(session);
  const [totals] = await aggregate;
  const result = totals || emptyTotals();
  result.codFeeDuePaise = Math.max(0, result.codFeesPaise - result.codFeesPaidPaise);
  return result;
};

const toRupees = (paise) => Number((paise / 100).toFixed(2));

export const getMyPanditLedger = async (req, res) => {
  try {
    const [entries, totals] = await Promise.all([
      PanditLedgerEntry.find({ pandit: req.user._id })
      .populate('booking', 'bookingDate timeSlot totalAmount paymentMethod')
      .sort({ createdAt: -1 })
      .limit(100),
      getTotals({ pandit: req.user._id }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        balance: toRupees(totals.balancePaise),
        availableBalance: toRupees(Math.max(0, totals.balancePaise)),
        onlineEarnings: toRupees(totals.onlineEarningsPaise),
        payouts: toRupees(totals.payoutsPaise),
        codFees: toRupees(totals.codFeesPaise),
        codFeesPaid: toRupees(totals.codFeesPaidPaise),
        codFeeDue: toRupees(totals.codFeeDuePaise),
        entries,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminPanditLedgers = async (req, res) => {
  try {
    const pandits = await User.find({ role: 'pandit' }).select('name email phone city');
    const totals = await PanditLedgerEntry.aggregate([
      { $group: {
        _id: '$pandit',
        balancePaise: { $sum: '$amountPaise' },
        onlineEarningsPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'online_earning'] }, '$amountPaise', 0] },
        },
        payoutsPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'payout'] }, { $multiply: ['$amountPaise', -1] }, 0] },
        },
        codFeesPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'cod_platform_fee'] }, { $multiply: ['$amountPaise', -1] }, 0] },
        },
        codFeesPaidPaise: {
          $sum: { $cond: [{ $eq: ['$type', 'cod_fee_payment'] }, '$amountPaise', 0] },
        },
      } },
    ]);
    const totalsByPandit = new Map(totals.map((item) => [item._id.toString(), item]));

    return res.status(200).json({
      success: true,
      data: pandits.map((pandit) => {
        const panditTotals = totalsByPandit.get(pandit._id.toString()) || emptyTotals();
        return {
          pandit,
          balance: toRupees(panditTotals.balancePaise),
          onlineEarnings: toRupees(panditTotals.onlineEarningsPaise),
          payouts: toRupees(panditTotals.payoutsPaise),
          codFeeDue: toRupees(Math.max(0, panditTotals.codFeesPaise - panditTotals.codFeesPaidPaise)),
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const recordAdminSettlement = async (req, res) => {
  const { type, amount, reference } = req.body;
  if (!['payout', 'cod_fee_payment'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Settlement type must be payout or cod_fee_payment.' });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0
    || Math.round(amount * 100) !== amount * 100) {
    return res.status(400).json({ success: false, message: 'Enter a positive amount with at most two decimal places.' });
  }
  if (typeof reference !== 'string' || !reference.trim()) {
    return res.status(400).json({ success: false, message: 'A bank/UPI transaction reference is required.' });
  }
  if (reference.trim().length > 200) {
    return res.status(400).json({ success: false, message: 'Transaction reference must be 200 characters or fewer.' });
  }

  const pandit = await User.findOne({ _id: req.params.panditId, role: 'pandit' });
  if (!pandit) return res.status(404).json({ success: false, message: 'Pandit not found.' });

  const amountPaise = Math.round(amount * 100);
  const idempotencyKey = `settlement:${pandit._id}:${type}:${reference.trim()}`;
  const session = await mongoose.startSession();
  try {
    let createdEntry;
    await session.withTransaction(async () => {
      if (await PanditLedgerEntry.exists({ idempotencyKey }).session(session)) {
        const error = new Error('This transaction reference has already been recorded.');
        error.statusCode = 409;
        throw error;
      }

      const totals = await getTotals({ pandit: pandit._id }, session);
      if (type === 'payout' && amountPaise > Math.max(0, totals.balancePaise)) {
        const error = new Error('Payout exceeds the pandit’s available positive balance.');
        error.statusCode = 400;
        throw error;
      }
      if (type === 'cod_fee_payment' && amountPaise > totals.codFeeDuePaise) {
        const error = new Error('COD fee payment exceeds the outstanding COD commission.');
        error.statusCode = 400;
        throw error;
      }

      [createdEntry] = await PanditLedgerEntry.create([{
        pandit: pandit._id,
        type,
        amountPaise: type === 'payout' ? -amountPaise : amountPaise,
        reference: reference.trim(),
        idempotencyKey,
        recordedBy: req.user._id,
      }], { session });
    });

    return res.status(201).json({
      success: true,
      message: type === 'payout'
        ? 'Manual pandit payout recorded.'
        : 'COD commission payment recorded.',
      data: createdEntry,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};
