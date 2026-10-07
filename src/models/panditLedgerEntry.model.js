import mongoose from 'mongoose';

const panditLedgerEntrySchema = new mongoose.Schema(
  {
    pandit: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    type: {
      type: String,
      enum: ['online_earning', 'cod_platform_fee', 'payout', 'cod_fee_payment'],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      validate: { validator: Number.isSafeInteger, message: 'Ledger amounts must be whole paise.' },
    },
    dueAt: Date,
    reference: { type: String, trim: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model('PanditLedgerEntry', panditLedgerEntrySchema);
