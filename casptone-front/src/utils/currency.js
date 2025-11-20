// Currency formatting utility
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₱0';
  }
  
  // Convert to number if it's a string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Use Intl.NumberFormat for consistent formatting
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numAmount);
};

// Format number with commas (without currency symbol)
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  
  const number = typeof num === 'string' ? parseFloat(num) : num;
  
  return new Intl.NumberFormat('en-PH').format(number);
};

// Format price with ₱ symbol and commas
export const formatPrice = (price) => {
  if (price === null || price === undefined || isNaN(price)) {
    return '₱0';
  }
  
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  return `₱${new Intl.NumberFormat('en-PH').format(numPrice)}`;
};

