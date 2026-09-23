// Display only: leave combat and saved values unchanged.
export const formatNumber = (value: number): string => String(Number(value.toFixed(2)));

export const formatSignedNumber = (value: number): string => {
  const rounded = formatNumber(value);
  return Number(rounded) > 0 ? `+${rounded}` : rounded;
};
