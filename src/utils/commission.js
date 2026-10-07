export const PLATFORM_COMMISSION_PERCENT = 10;
export const COD_COMMISSION_DUE_DAYS = 7;

export const splitBookingAmount = (amountRupees) => {
  const totalPaise = Math.round(Number(amountRupees) * 100);
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
    throw new Error('Booking amount must be a positive safe monetary value.');
  }

  const platformFeePaise = Math.round(totalPaise * PLATFORM_COMMISSION_PERCENT / 100);
  return {
    totalPaise,
    platformFeePaise,
    panditSharePaise: totalPaise - platformFeePaise,
  };
};
