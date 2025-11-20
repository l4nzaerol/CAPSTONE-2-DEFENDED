// Shipping fee calculation utility
// Seller location: Cabuyao City, Laguna

const SELLER_LOCATION = {
  province: "laguna",
  city: "cabuyao"
};

/**
 * Calculate shipping fee based on destination
 * @param {string} provinceId - Province ID from philippineLocations
 * @param {string} cityId - City ID from philippineLocations
 * @returns {number} Shipping fee in PHP
 */
export const calculateShippingFee = (provinceId, cityId) => {
  if (!provinceId) return 0;

  // Same city (Cabuyao) - Free shipping
  if (provinceId === SELLER_LOCATION.province && cityId === SELLER_LOCATION.city) {
    return 0;
  }

  // Same province (Laguna, other cities) - ₱50
  if (provinceId === SELLER_LOCATION.province) {
    return 50;
  }

  // Nearby provinces (Cavite, Rizal, Metro Manila) - ₱100
  const nearbyProvinces = ["cavite", "rizal", "metro-manila"];
  if (nearbyProvinces.includes(provinceId)) {
    return 100;
  }

  // Other Luzon provinces - ₱150
  return 150;
};

/**
 * Check if product is alkansya
 * @param {object} product - Product object
 * @returns {boolean}
 */
export const isAlkansya = (product) => {
  if (!product) return false;
  const productName = (product.name || product.product?.name || "").toLowerCase();
  return productName.includes("alkansya");
};

/**
 * Calculate shipping fee with free shipping logic
 * @param {object} product - Product object
 * @param {number} quantity - Quantity of items
 * @param {string} provinceId - Province ID
 * @param {string} cityId - City ID
 * @returns {object} { shippingFee, isFreeShipping }
 */
export const getShippingFee = (product, quantity, provinceId, cityId) => {
  const baseShippingFee = calculateShippingFee(provinceId, cityId);
  
  // Free shipping for alkansya when quantity >= 3
  if (isAlkansya(product) && quantity >= 3) {
    return {
      shippingFee: 0,
      isFreeShipping: true,
      baseShippingFee
    };
  }

  return {
    shippingFee: baseShippingFee,
    isFreeShipping: false,
    baseShippingFee
  };
};

/**
 * Calculate total shipping fee for multiple items
 * Shipping is charged once per order, not per item
 * @param {array} items - Array of cart items with product, quantity, etc.
 * @param {string} provinceId - Province ID
 * @param {string} cityId - City ID
 * @param {object} quantities - Optional object mapping item IDs to quantities (for cart)
 * @returns {object} { shippingFee, isFreeShipping, baseShippingFee }
 */
export const calculateTotalShippingFee = (items, provinceId, cityId, quantities = {}) => {
  if (!items || items.length === 0 || !provinceId) {
    return {
      shippingFee: 0,
      isFreeShipping: false,
      baseShippingFee: 0
    };
  }

  // Calculate total alkansya quantity
  const totalAlkansyaQuantity = items.reduce((sum, item) => {
    const product = item.product || item;
    const qty = quantities[item.id] || item.quantity || 1;
    return isAlkansya(product) ? sum + qty : sum;
  }, 0);

  // Free shipping if total alkansya quantity >= 3
  if (totalAlkansyaQuantity >= 3) {
    return {
      shippingFee: 0,
      isFreeShipping: true,
      baseShippingFee: calculateShippingFee(provinceId, cityId)
    };
  }

  // Calculate base shipping fee based on location
  const baseShippingFee = calculateShippingFee(provinceId, cityId);
  
  return {
    shippingFee: baseShippingFee,
    isFreeShipping: false,
    baseShippingFee
  };
};

